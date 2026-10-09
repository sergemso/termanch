use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Result};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Redirect},
    Json,
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use oauth2::{
    basic::BasicClient, AuthUrl, ClientId, ClientSecret, RedirectUrl, Scope, TokenResponse,
    TokenUrl,
};
use serde::{Deserialize, Serialize};
use tower::ServiceExt;
use tracing::{debug, error, info, warn};

#[derive(Clone)]
pub struct AuthConfig {
    pub github_client_id: String,
    pub github_client_secret: String,
    pub jwt_secret: Vec<u8>,
}

#[derive(Clone)]
pub struct AuthState {
    config: AuthConfig,
    oauth_client: BasicClient,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

impl AuthState {
    pub fn new(config: AuthConfig) -> Self {
        let oauth_client = BasicClient::new(
            ClientId::new(config.github_client_id.clone()),
            Some(ClientSecret::new(config.github_client_secret.clone())),
            AuthUrl::new("https://github.com/login/oauth/authorize".into()).unwrap(),
            Some(TokenUrl::new("https://github.com/login/oauth/access_token".into()).unwrap()),
        )
        .set_redirect_uri(RedirectUrl::new("https://app.termanch.dev/callback".into()).unwrap());

        Self {
            config,
            oauth_client,
        }
    }

    pub fn oauth_authorize_url(&self) -> String {
        let (url, _csrf_token) = self
            .oauth_client
            .authorize_url(oauth2::CsrfToken::new_random)
            .add_scope(Scope::new("read:user".into()))
            .add_scope(Scope::new("user:email".into()))
            .url();
        url.to_string()
    }

    pub async fn exchange_code(&self, code: String) -> Result<String> {
        let token_result = self
            .oauth_client
            .exchange_code(oauth2::AuthorizationCode::new(code))
            .request_async(oauth2::reqwest::async_http_client)
            .await?;

        let access_token = token_result.access_token().secret().to_string();

        let client = reqwest::Client::new();
        let user_resp = client
            .get("https://api.github.com/user")
            .bearer_auth(&access_token)
            .header("User-Agent", "termanch-server")
            .send()
            .await?;

        if !user_resp.status().is_success() {
            return Err(anyhow!("GitHub API error: {}", user_resp.status()));
        }

        let user: serde_json::Value = user_resp.json().await?;
        let username = user["login"].as_str().unwrap_or("unknown").to_string();

        let claims = Claims {
            sub: username.clone(),
            username: username.clone(),
            exp: (SystemTime::now() + Duration::from_secs(7 * 24 * 60 * 60))
                .duration_since(UNIX_EPOCH)?
                .as_secs() as usize,
            iat: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as usize,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.config.jwt_secret),
        )?;

        Ok(token)
    }

    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(&self.config.jwt_secret),
            &validation,
        )?;
        Ok(token_data.claims)
    }
}

pub async fn oauth_login(State(state): State<Arc<AuthState>>) -> impl IntoResponse {
    let url = state.oauth_authorize_url();
    Redirect::to(&url)
}

pub async fn oauth_callback(
    State(state): State<Arc<AuthState>>,
    Query(query): Query<OAuthCallbackQuery>,
) -> impl IntoResponse {
    match state.exchange_code(query.code).await {
        Ok(jwt) => {
            let html = format!(
                r#"<html><body><script>
localStorage.setItem('termanch_jwt', '{}');
window.location.href = '/';
</script></body></html>"#,
                jwt
            );
            Html(html).into_response()
        }
        Err(e) => {
            error!("OAuth exchange failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Authentication failed").into_response()
        }
    }
}

pub async fn verify_auth(
    State(state): State<Arc<AuthState>>,
    headers: HeaderMap,
) -> Result<Claims, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    state
        .verify_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)
}
