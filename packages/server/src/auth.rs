use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Result};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct AuthConfig {
    pub github_client_id: String,
    pub github_client_secret: String,
    pub jwt_secret: Vec<u8>,
}

#[derive(Clone)]
pub struct AuthState {
    config: AuthConfig,
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
        Self { config }
    }

    pub fn oauth_authorize_url(&self) -> String {
        format!(
            "https://github.com/login/oauth/authorize?client_id={}&redirect_uri=https://app.termanch.dev/callback&scope=read:user user:email&state=random_state",
            self.config.github_client_id
        )
    }

    pub async fn exchange_code(&self, _code: String) -> Result<String> {
        // MVP: Simplified - in production, exchange code with GitHub
        // For now, return a mock JWT
        let username = "testuser".to_string();
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

pub async fn oauth_login(State(state): State<Arc<AuthState>>) -> impl axum::response::IntoResponse {
    let url = state.oauth_authorize_url();
    Redirect::to(&url)
}

pub async fn oauth_callback(
    State(state): State<Arc<AuthState>>,
    Query(query): Query<OAuthCallbackQuery>,
) -> impl axum::response::IntoResponse {
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
) -> Result<crate::auth::Claims, StatusCode> {
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

pub fn verify_token(
    auth: &Arc<AuthState>,
    headers: &axum::http::HeaderMap,
) -> Result<Claims, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    auth.verify_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)
}
