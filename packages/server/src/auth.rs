use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

const GITHUB_API: &str = "https://api.github.com";
const IDENTITY_TTL: Duration = Duration::from_secs(60);

/// A GitHub user, as reported by GitHub for an access token.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Identity {
    pub id: u64,
    pub login: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Decision {
    /// The user is the owner (already bound, or bound just now with the claim token).
    Allowed,
    /// The server is unclaimed and the claim token is missing or wrong.
    NeedsClaim,
    /// The server belongs to someone else.
    Denied,
}

/// Verifies GitHub access tokens and decides who may use this server (DECISION-0053).
/// The server holds no OAuth secret: the token is checked by asking GitHub who it belongs to.
pub struct AuthState {
    http: reqwest::Client,
    github_api: String,
    dir: PathBuf,
    cache: Mutex<HashMap<String, (Identity, Instant)>>,
    // Serialises owner binding so two clients cannot both claim.
    bind_lock: Mutex<()>,
}

impl AuthState {
    pub fn new(dir: PathBuf) -> Result<Self> {
        Self::with_api(dir, GITHUB_API.to_string())
    }

    pub fn with_api(dir: PathBuf, github_api: String) -> Result<Self> {
        std::fs::create_dir_all(&dir)?;
        Ok(Self {
            http: reqwest::Client::builder()
                .user_agent("termanch-server")
                .timeout(Duration::from_secs(10))
                .build()?,
            github_api,
            dir,
            cache: Mutex::new(HashMap::new()),
            bind_lock: Mutex::new(()),
        })
    }

    fn owner_path(&self) -> PathBuf {
        self.dir.join("owner.json")
    }

    fn claim_path(&self) -> PathBuf {
        self.dir.join("claim_token")
    }

    pub fn owner(&self) -> Option<Identity> {
        let text = std::fs::read_to_string(self.owner_path()).ok()?;
        serde_json::from_str(&text).ok()
    }

    /// Returns the claim token of an unclaimed server, creating it if needed. `None` once claimed.
    pub fn claim_token(&self) -> Result<Option<String>> {
        if self.owner().is_some() {
            return Ok(None);
        }
        if let Ok(existing) = std::fs::read_to_string(self.claim_path()) {
            let existing = existing.trim().to_string();
            if !existing.is_empty() {
                return Ok(Some(existing));
            }
        }
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let token = URL_SAFE_NO_PAD.encode(bytes);
        write_private(&self.claim_path(), token.as_bytes())?;
        Ok(Some(token))
    }

    /// Asks GitHub who the access token belongs to (cached briefly).
    pub async fn identify(&self, token: &str) -> Result<Identity> {
        if let Some((identity, at)) = self.cache.lock().unwrap().get(token) {
            if at.elapsed() < IDENTITY_TTL {
                return Ok(identity.clone());
            }
        }
        let resp = self
            .http
            .get(format!("{}/user", self.github_api))
            .bearer_auth(token)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("GitHub rejected the token ({})", resp.status()));
        }
        let identity: Identity = resp.json().await?;
        let mut cache = self.cache.lock().unwrap();
        cache.retain(|_, (_, at)| at.elapsed() < IDENTITY_TTL);
        cache.insert(token.to_string(), (identity.clone(), Instant::now()));
        Ok(identity)
    }

    /// Decides whether `identity` may use the server; binds the first user who presents the claim token.
    pub fn authorize(&self, identity: &Identity, claim: Option<&str>) -> Result<Decision> {
        let _guard = self.bind_lock.lock().unwrap();
        if let Some(owner) = self.owner() {
            return Ok(if owner.id == identity.id {
                Decision::Allowed
            } else {
                Decision::Denied
            });
        }
        let expected = self
            .claim_token()?
            .ok_or_else(|| anyhow!("no claim token"))?;
        match claim {
            Some(c) if constant_time_eq(c.as_bytes(), expected.as_bytes()) => {
                write_private(
                    &self.owner_path(),
                    serde_json::to_string(identity)?.as_bytes(),
                )?;
                let _ = std::fs::remove_file(self.claim_path());
                info!(target: "audit", event = "server_claimed", github_id = identity.id, login = %identity.login);
                Ok(Decision::Allowed)
            }
            _ => Ok(Decision::NeedsClaim),
        }
    }

    /// Full check for one connection: identify, authorize, and write the audit record (never the token).
    pub async fn check(
        &self,
        token: &str,
        claim: Option<&str>,
        ip: Option<&str>,
    ) -> Result<Identity, AuthError> {
        let identity = match self.identify(token).await {
            Ok(i) => i,
            Err(e) => {
                warn!(target: "audit", event = "auth", success = false, reason = "bad_token", ip = ip.unwrap_or("-"));
                tracing::debug!("identify failed: {e}");
                return Err(AuthError::BadToken);
            }
        };
        let decision = self
            .authorize(&identity, claim)
            .map_err(|_| AuthError::Internal)?;
        let (success, reason) = match decision {
            Decision::Allowed => (true, "ok"),
            Decision::NeedsClaim => (false, "needs_claim"),
            Decision::Denied => (false, "not_owner"),
        };
        info!(target: "audit", event = "auth", success, reason, github_id = identity.id, login = %identity.login, ip = ip.unwrap_or("-"));
        match decision {
            Decision::Allowed => Ok(identity),
            Decision::NeedsClaim => Err(AuthError::NeedsClaim),
            Decision::Denied => Err(AuthError::NotOwner),
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum AuthError {
    BadToken,
    NeedsClaim,
    NotOwner,
    Internal,
}

impl AuthError {
    pub fn message(&self) -> &'static str {
        match self {
            AuthError::BadToken => "GitHub login is invalid or expired",
            AuthError::NeedsClaim => {
                "This server is not registered yet; add it with its registration link"
            }
            AuthError::NotOwner => "This server belongs to another GitHub user",
            AuthError::Internal => "Authentication failed",
        }
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn write_private(path: &std::path::Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    #[cfg(unix)]
    use std::os::unix::fs::OpenOptionsExt;
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    opts.mode(0o600);
    opts.open(path)?.write_all(bytes)?;
    Ok(())
}

/// The link printed by `--register`: the hosted client reads `#add=` from the fragment, which never reaches a server.
pub fn registration_link(client_url: &str, server_url: &str, name: &str, claim: &str) -> String {
    let payload = serde_json::json!({ "u": server_url, "t": claim, "n": name });
    format!(
        "{}/#add={}",
        client_url.trim_end_matches('/'),
        URL_SAFE_NO_PAD.encode(payload.to_string())
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{extract::State, http::HeaderMap, routing::get, Json, Router};
    use std::sync::Arc;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("termanch-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn id(n: u64) -> Identity {
        Identity {
            id: n,
            login: format!("user{n}"),
        }
    }

    fn auth() -> AuthState {
        AuthState::with_api(temp_dir(), "http://127.0.0.1:1".into()).unwrap()
    }

    #[test]
    fn first_claim_binds_owner_and_removes_token() {
        let a = auth();
        let claim = a.claim_token().unwrap().unwrap();
        assert_eq!(
            a.authorize(&id(1), Some(&claim)).unwrap(),
            Decision::Allowed
        );
        assert_eq!(a.owner().unwrap().id, 1);
        assert!(a.claim_token().unwrap().is_none());
    }

    #[test]
    fn owner_is_allowed_without_claim_and_others_denied() {
        let a = auth();
        let claim = a.claim_token().unwrap().unwrap();
        a.authorize(&id(1), Some(&claim)).unwrap();
        assert_eq!(a.authorize(&id(1), None).unwrap(), Decision::Allowed);
        assert_eq!(a.authorize(&id(2), None).unwrap(), Decision::Denied);
        assert_eq!(a.authorize(&id(2), Some(&claim)).unwrap(), Decision::Denied);
    }

    #[test]
    fn unclaimed_server_rejects_missing_or_wrong_claim() {
        let a = auth();
        let _ = a.claim_token().unwrap();
        assert_eq!(a.authorize(&id(1), None).unwrap(), Decision::NeedsClaim);
        assert_eq!(
            a.authorize(&id(1), Some("nope")).unwrap(),
            Decision::NeedsClaim
        );
        assert!(a.owner().is_none());
    }

    #[test]
    fn claim_token_is_stable_until_used() {
        let a = auth();
        assert_eq!(a.claim_token().unwrap(), a.claim_token().unwrap());
    }

    #[test]
    fn owner_survives_restart() {
        let dir = temp_dir();
        let a = AuthState::with_api(dir.clone(), "http://127.0.0.1:1".into()).unwrap();
        let claim = a.claim_token().unwrap().unwrap();
        a.authorize(&id(7), Some(&claim)).unwrap();
        let b = AuthState::with_api(dir, "http://127.0.0.1:1".into()).unwrap();
        assert_eq!(b.authorize(&id(7), None).unwrap(), Decision::Allowed);
        assert_eq!(b.authorize(&id(8), None).unwrap(), Decision::Denied);
    }

    #[test]
    fn registration_link_carries_url_token_and_name_in_the_fragment() {
        let link = registration_link(
            "https://app.example.dev/",
            "https://s.example.dev",
            "vps",
            "tok",
        );
        let (base, frag) = link.split_once("/#add=").unwrap();
        assert_eq!(base, "https://app.example.dev");
        let json: serde_json::Value =
            serde_json::from_slice(&URL_SAFE_NO_PAD.decode(frag).unwrap()).unwrap();
        assert_eq!(json["u"], "https://s.example.dev");
        assert_eq!(json["t"], "tok");
        assert_eq!(json["n"], "vps");
    }

    async fn mock_github() -> String {
        async fn user(
            State(_): State<Arc<()>>,
            headers: HeaderMap,
        ) -> Result<Json<Identity>, axum::http::StatusCode> {
            match headers.get("authorization").and_then(|v| v.to_str().ok()) {
                Some("Bearer good") => Ok(Json(Identity {
                    id: 42,
                    login: "octo".into(),
                })),
                _ => Err(axum::http::StatusCode::UNAUTHORIZED),
            }
        }
        let app = Router::new()
            .route("/user", get(user))
            .with_state(Arc::new(()));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        format!("http://{addr}")
    }

    #[tokio::test]
    async fn check_identifies_with_github_and_enforces_ownership() {
        let api = mock_github().await;
        let a = AuthState::with_api(temp_dir(), api).unwrap();
        assert_eq!(
            a.check("bad", None, None).await.unwrap_err(),
            AuthError::BadToken
        );
        assert_eq!(
            a.check("good", None, None).await.unwrap_err(),
            AuthError::NeedsClaim
        );
        let claim = a.claim_token().unwrap().unwrap();
        let who = a.check("good", Some(&claim), None).await.unwrap();
        assert_eq!(who.id, 42);
        assert_eq!(a.check("good", None, None).await.unwrap().login, "octo");
    }
}
