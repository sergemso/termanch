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
/// A claim secret works for this long after it is issued, then once only.
const CLAIM_TTL: Duration = Duration::from_secs(15 * 60);

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
    claim_ttl: Duration,
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
            claim_ttl: CLAIM_TTL,
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

    #[cfg(test)]
    pub fn set_claim_ttl(&mut self, ttl: Duration) {
        self.claim_ttl = ttl;
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }

    /// The unexpired claim secret, if the server is unclaimed. Stored as `secret\nexpires_ms`.
    pub fn active_claim(&self) -> Option<String> {
        if self.owner().is_some() {
            return None;
        }
        let text = std::fs::read_to_string(self.claim_path()).ok()?;
        let (secret, expires) = text.split_once('\n')?;
        let expires: u64 = expires.trim().parse().ok()?;
        (!secret.is_empty() && Self::now_ms() < expires).then(|| secret.to_string())
    }

    fn store_claim(&self, secret: &str) -> Result<()> {
        let expires = Self::now_ms() + self.claim_ttl.as_millis() as u64;
        write_private(
            &self.claim_path(),
            format!("{secret}\n{expires}").as_bytes(),
        )
    }

    /// Uses a secret chosen by the client (from the install command) as the claim token.
    pub fn provide_claim(&self, secret: &str) -> Result<()> {
        if self.owner().is_none() && !secret.is_empty() {
            self.store_claim(secret)?;
        }
        Ok(())
    }

    /// The claim token of an unclaimed server, made fresh when none is valid. `None` once claimed.
    pub fn claim_token(&self) -> Result<Option<String>> {
        if self.owner().is_some() {
            return Ok(None);
        }
        if let Some(secret) = self.active_claim() {
            return Ok(Some(secret));
        }
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let token = URL_SAFE_NO_PAD.encode(bytes);
        self.store_claim(&token)?;
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

pub fn write_private(path: &std::path::Path, bytes: &[u8]) -> Result<()> {
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

/// What `--register` shows (as text and as a QR): opening it, with the camera app or by scanning in the
/// client, starts Add Server with this secret. The fragment never reaches any server.
pub fn claim_link(client_url: &str, claim: &str) -> String {
    format!("{}/#claim={}", client_url.trim_end_matches('/'), claim)
}

/// The same link as a terminal QR code: modules drawn light-on-dark for dark terminals; the client's
/// decoder tries both polarities.
pub fn claim_qr(link: &str) -> Option<String> {
    use qrcode::render::unicode::Dense1x2;
    let code = qrcode::QrCode::new(link.as_bytes()).ok()?;
    Some(
        code.render::<Dense1x2>()
            .dark_color(Dense1x2::Light)
            .light_color(Dense1x2::Dark)
            .quiet_zone(true)
            .build(),
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
    fn a_client_supplied_secret_claims_the_server_until_it_expires() {
        let mut a = auth();
        a.provide_claim("from-the-install-command").unwrap();
        assert_eq!(
            a.active_claim().as_deref(),
            Some("from-the-install-command")
        );
        assert_eq!(
            a.authorize(&id(1), Some("from-the-install-command"))
                .unwrap(),
            Decision::Allowed
        );
        assert!(a.active_claim().is_none(), "spent");

        let mut b = auth();
        b.set_claim_ttl(Duration::from_millis(1));
        b.provide_claim("late").unwrap();
        std::thread::sleep(Duration::from_millis(5));
        assert!(b.active_claim().is_none());
        assert_eq!(
            b.authorize(&id(1), Some("late")).unwrap(),
            Decision::NeedsClaim,
            "expired secrets are refused"
        );
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
    fn the_claim_link_carries_only_the_secret_in_the_fragment() {
        assert_eq!(
            claim_link("https://app.example.dev/", "tok"),
            "https://app.example.dev/#claim=tok"
        );
    }

    #[test]
    fn the_qr_encodes_the_link_and_fits_a_terminal() {
        let link = claim_link("https://app.termanch.dev", &"A".repeat(43));
        let qr = claim_qr(&link).unwrap();
        let widest = qr.lines().map(|l| l.chars().count()).max().unwrap();
        assert!(widest <= 60, "QR is {widest} columns wide");
        assert!(qr.lines().count() <= 32);
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
