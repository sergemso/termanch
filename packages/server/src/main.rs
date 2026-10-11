use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{ws::WebSocketUpgrade, State},
    http::HeaderMap,
    response::Response,
    routing::get,
    Router,
};
use clap::Parser;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

mod auth;
mod sessions;
mod websocket;

use auth::AuthState;
use sessions::SessionManager;
use websocket::handle_websocket;

#[derive(Parser, Debug)]
#[command(name = "termanch-server")]
struct Args {
    #[arg(long, env = "TERMANCH_HOST", default_value = "0.0.0.0")]
    host: String,

    #[arg(long, env = "TERMANCH_PORT", default_value = "8080")]
    port: u16,

    /// Where the owner binding and claim token are kept (mount a volume here).
    #[arg(
        long,
        env = "TERMANCH_CONFIG_DIR",
        default_value = "/home/termanch/.config/termanch"
    )]
    config_dir: PathBuf,

    #[arg(long, env = "TERMANCH_SERVER_NAME", default_value = "termanch-server")]
    server_name: String,

    /// Public URL of this server (the tunnel address), put into the registration link.
    #[arg(long, env = "TERMANCH_PUBLIC_URL")]
    public_url: Option<String>,

    /// Client that opens the registration link.
    #[arg(
        long,
        env = "TERMANCH_CLIENT_URL",
        default_value = "https://app.termanch.dev"
    )]
    client_url: String,

    /// Print the registration link for this (unclaimed) server and exit.
    #[arg(long, default_value = "false")]
    register: bool,
}

#[derive(Clone)]
pub struct AppState {
    pub auth: Arc<AuthState>,
    pub sessions: Arc<SessionManager>,
    pub server_name: String,
}

fn print_registration(args: &Args, auth: &AuthState) -> anyhow::Result<()> {
    if let Some(owner) = auth.owner() {
        println!("This server is already registered to @{}.", owner.login);
        return Ok(());
    }
    let claim = auth
        .claim_token()?
        .ok_or_else(|| anyhow::anyhow!("no claim token"))?;
    let url = args
        .public_url
        .clone()
        .unwrap_or_else(|| "https://YOUR-TUNNEL-URL".into());
    let link = auth::registration_link(&args.client_url, &url, &args.server_name, &claim);
    println!("Open this link in the browser where you are logged in to Termanch:\n\n  {link}\n");
    println!(
        "The first GitHub user to connect with it becomes the owner; the link then stops working."
    );
    if args.public_url.is_none() {
        println!("Set TERMANCH_PUBLIC_URL to your tunnel URL so the link fills it in for you.");
    }
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();
    let auth = Arc::new(AuthState::new(args.config_dir.clone())?);

    if args.register {
        return print_registration(&args, &auth);
    }

    match auth.owner() {
        Some(owner) => info!("Server owner: @{}", owner.login),
        None => {
            auth.claim_token()?;
            info!("Server is unclaimed; run `termanch-server --register` to get the registration link");
        }
    }

    let state = AppState {
        auth,
        sessions: Arc::new(SessionManager::new()),
        server_name: args.server_name.clone(),
    };

    // No credentials cross origins here: the WebSocket authenticates in its first message.
    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
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
    ws.on_upgrade(|socket| handle_websocket(socket, State(state), headers))
}
