use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Path, Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Router,
};
use clap::Parser;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};

mod auth;
mod registration;
mod sessions;
mod websocket;

use auth::{AuthConfig, AuthState};
use registration::{RegistrationConfig, RegistrationState};
use sessions::SessionManager;
use websocket::handle_websocket;

#[derive(Parser, Debug)]
#[command(name = "termanch-server")]
struct Args {
    #[arg(long, env = "TERMANCH_HOST", default_value = "0.0.0.0")]
    host: String,

    #[arg(long, env = "TERMANCH_PORT", default_value = "8080")]
    port: u16,

    #[arg(long, env = "TERMANCH_GITHUB_CLIENT_ID")]
    github_client_id: String,

    #[arg(long, env = "TERMANCH_GITHUB_CLIENT_SECRET")]
    github_client_secret: String,

    #[arg(long, env = "TERMANCH_JWT_SECRET")]
    jwt_secret: String,

    #[arg(long, env = "TERMANCH_REGISTRATION_SECRET")]
    registration_secret: String,

    #[arg(long, env = "TERMANCH_SERVER_NAME", default_value = "termanch-server")]
    server_name: String,

    #[arg(long, default_value = "false")]
    register: bool,
}

#[derive(Clone)]
struct AppState {
    auth: Arc<AuthState>,
    registration: Arc<RegistrationState>,
    sessions: Arc<SessionManager>,
    server_name: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();

    if args.register {
        registration::print_registration_token(&args.registration_secret, &args.server_name);
        return Ok(());
    }

    let auth_config = AuthConfig {
        github_client_id: args.github_client_id,
        github_client_secret: args.github_client_secret,
        jwt_secret: args.jwt_secret.into_bytes(),
    };

    let registration_config = RegistrationConfig {
        secret: args.registration_secret.into_bytes(),
        server_name: args.server_name.clone(),
    };

    let auth = Arc::new(AuthState::new(auth_config));
    let registration = Arc::new(RegistrationState::new(registration_config));
    let sessions = Arc::new(SessionManager::new());

    let state = AppState {
        auth,
        registration,
        sessions,
        server_name: args.server_name.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true);

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/register", post(registration::register_handler))
        .route("/ws", get(ws_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", args.host, args.port).parse()?;
    info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, state, headers))
}
