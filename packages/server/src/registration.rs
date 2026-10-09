use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::Result;
use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tracing::{debug, info, warn};

use termanch_core::protocol::{RegisterRequest, RegisterResponse};

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone)]
pub struct RegistrationConfig {
    pub secret: Vec<u8>,
    pub server_name: String,
}

#[derive(Clone)]
pub struct RegistrationState {
    config: RegistrationConfig,
    pending: Arc<tokio::sync::RwLock<std::collections::HashMap<String, PendingRegistration>>>,
}

#[derive(Debug, Clone)]
struct PendingRegistration {
    token: String,
    expires_at: u64,
    server_url: Option<String>,
}

#[derive(Deserialize)]
pub struct RegisterQuery {
    pub token: String,
}

impl RegistrationState {
    pub fn new(config: RegistrationConfig) -> Self {
        let state = Self {
            config,
            pending: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        };

        let cleanup_state = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                cleanup_state.cleanup_expired().await;
            }
        });

        state
    }

    async fn cleanup_expired(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let mut pending = self.pending.write().await;
        pending.retain(|_, v| v.expires_at > now);
    }

    pub fn generate_token(&self) -> String {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        URL_SAFE_NO_PAD.encode(bytes)
    }

    pub fn compute_hmac(&self, token: &str) -> String {
        let mut mac = HmacSha256::new_from_slice(&self.config.secret).unwrap();
        mac.update(token.as_bytes());
        let result = mac.finalize();
        URL_SAFE_NO_PAD.encode(result.into_bytes())
    }

    pub fn create_registration(&self, token: String) -> String {
        let hmac = self.compute_hmac(&token);
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 600;

        let pending = PendingRegistration {
            token: token.clone(),
            expires_at,
            server_url: None,
        };

        let mut map = self.pending.blocking_write();
        map.insert(hmac.clone(), pending);

        hmac
    }

    pub async fn complete_registration(&self, hmac_token: &str, server_url: String) -> bool {
        let mut pending = self.pending.write().await;
        if let Some(entry) = pending.get_mut(hmac_token) {
            entry.server_url = Some(server_url);
            true
        } else {
            false
        }
    }

    pub async fn poll_registration(&self, hmac_token: &str) -> Option<RegisterResponse> {
        let pending = self.pending.read().await;
        pending.get(hmac_token).and_then(|p| {
            p.server_url.as_ref().map(|url| RegisterResponse {
                server_url: url.clone(),
                server_name: self.config.server_name.clone(),
            })
        })
    }
}

pub fn print_registration_token(secret: &str, server_name: &str) {
    let config = RegistrationConfig {
        secret: secret.as_bytes().to_vec(),
        server_name: server_name.to_string(),
    };
    let state = RegistrationState::new(config);
    let token = state.generate_token();
    let hmac = state.compute_hmac(&token);

    println!("Registration Token: {}", token);
    println!("HMAC Token (for QR): {}", hmac);
    println!("Server Name: {}", server_name);
    println!("\nRun this on your VPS:");
    println!("  docker compose exec termanch-server termanch-server --register");
    println!("\nThen scan the QR code with the HMAC token in the Termanch app.");
}

pub async fn register_handler(
    State(state): State<Arc<RegistrationState>>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let hmac_token = req.token;

    match state.poll_registration(&hmac_token).await {
        Some(response) => {
            info!("Registration completed for token");
            Json(response).into_response()
        }
        None => {
            warn!("Registration token not found or not ready: {}", hmac_token);
            (StatusCode::NOT_FOUND, "Registration not found or pending").into_response()
        }
    }
}