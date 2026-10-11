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
mod backend;
#[cfg(test)]
mod e2e;
mod pty;
mod sessions;
mod websocket;

use auth::AuthState;
use backend::{CommandBackend, SessionBackend, TmuxBackend};
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

    /// Session manager: `tmux` (built in) or `command` (any CLI, see TERMANCH_BACKEND_*).
    #[arg(long, env = "TERMANCH_BACKEND", default_value = "tmux")]
    backend: String,

    /// For `command`: a label shown in logs, e.g. herdr.
    #[arg(long, env = "TERMANCH_BACKEND_NAME", default_value = "command")]
    backend_name: String,

    /// For `command`: prints one session per line (`id` or `id|name`).
    #[arg(long, env = "TERMANCH_BACKEND_LIST")]
    backend_list: Option<String>,

    /// For `command`: creates a detached session; `{name}` is replaced.
    #[arg(long, env = "TERMANCH_BACKEND_CREATE")]
    backend_create: Option<String>,

    /// For `command`: attaches a terminal to a session; `{id}` is replaced.
    #[arg(long, env = "TERMANCH_BACKEND_ATTACH")]
    backend_attach: Option<String>,

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

fn build_backend(args: &Args) -> anyhow::Result<Arc<dyn SessionBackend>> {
    match args.backend.as_str() {
        "tmux" => Ok(Arc::new(TmuxBackend)),
        "command" => {
            let need = |v: &Option<String>, name: &str| {
                v.clone()
                    .ok_or_else(|| anyhow::anyhow!("TERMANCH_BACKEND=command needs {name}"))
            };
            Ok(Arc::new(CommandBackend::new(
                &args.backend_name,
                &need(&args.backend_list, "TERMANCH_BACKEND_LIST")?,
                &need(&args.backend_create, "TERMANCH_BACKEND_CREATE")?,
                &need(&args.backend_attach, "TERMANCH_BACKEND_ATTACH")?,
            )?))
        }
        other => Err(anyhow::anyhow!(
            "unknown TERMANCH_BACKEND `{other}` (tmux or command)"
        )),
    }
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

    let backend = build_backend(&args)?;
    info!("Session backend: {}", backend.name());
    let state = AppState {
        auth,
        sessions: Arc::new(SessionManager::new(backend)),
        server_name: args.server_name.clone(),
    };

    let app = router(state);

    let addr: SocketAddr = format!("{}:{}", args.host, args.port).parse()?;
    info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// No credentials cross origins here: the WebSocket authenticates in its first message.
fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, State(state), headers))
}
