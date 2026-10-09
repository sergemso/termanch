use std::sync::Arc;

use clap::Parser;
use tokio::net::UnixListener;
use tokio::sync::mpsc;
use tracing::{error, info};

mod pty;
mod server_client;
mod tmux;

use pty::PtyManager;
use server_client::ServerClient;
use tmux::TmuxManager;

#[derive(Parser, Debug)]
#[command(name = "termanch-agent")]
struct Args {
    #[arg(long, env = "TERMANCH_SERVER_URL")]
    server_url: String,

    #[arg(long, env = "TERMANCH_SERVER_TOKEN")]
    server_token: String,

    #[arg(
        long,
        env = "TERMANCH_SOCKET_PATH",
        default_value = "/tmp/termanch-agent.sock"
    )]
    socket_path: String,

    #[arg(long, default_value = "false")]
    register: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();

    if args.register {
        println!("Agent registration not implemented yet");
        return Ok(());
    }

    let pty_manager = Arc::new(PtyManager::new());
    let tmux_manager = Arc::new(TmuxManager::new());

    let mut server_client = ServerClient::new(
        args.server_url,
        args.server_token,
        pty_manager.clone(),
        tmux_manager.clone(),
    );

    let socket_path = args.socket_path.clone();
    let _ = std::fs::remove_file(&socket_path);
    let listener = UnixListener::bind(&socket_path)?;
    info!("Agent listening on {}", socket_path);

    let (shutdown_tx, mut shutdown_rx) = mpsc::unbounded_channel::<()>();

    let server_task = tokio::spawn(async move {
        if let Err(e) = server_client.run().await {
            error!("Server client error: {}", e);
        }
    });

    let socket_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = shutdown_rx.recv() => break,
                result = listener.accept() => {
                    match result {
                        Ok((stream, _)) => {
                            let pty_manager = pty_manager.clone();
                            let tmux_manager = tmux_manager.clone();
                            tokio::spawn(async move {
                                handle_socket(stream, pty_manager, tmux_manager).await;
                            });
                        }
                        Err(e) => {
                            error!("Socket accept error: {}", e);
                        }
                    }
                }
            }
        }
    });

    tokio::signal::ctrl_c().await?;
    info!("Shutting down...");
    let _ = shutdown_tx.send(());
    server_task.abort();
    socket_task.abort();

    Ok(())
}

async fn handle_socket(
    mut stream: tokio::net::UnixStream,
    pty_manager: Arc<PtyManager>,
    tmux_manager: Arc<TmuxManager>,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buf = [0u8; 1024];
    loop {
        match stream.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => {
                let msg = String::from_utf8_lossy(&buf[..n]);
                info!("Socket received: {}", msg);
                // Handle local commands
                let response = handle_local_command(&msg, &pty_manager, &tmux_manager).await;
                let _ = stream.write_all(response.as_bytes()).await;
            }
            Err(e) => {
                error!("Socket read error: {}", e);
                break;
            }
        }
    }
}

async fn handle_local_command(
    msg: &str,
    pty_manager: &PtyManager,
    tmux_manager: &TmuxManager,
) -> String {
    let parts: Vec<&str> = msg.trim().split_whitespace().collect();
    if parts.is_empty() {
        return "ERROR: Empty command\n".into();
    }

    match parts[0] {
        "list-sessions" => match tmux_manager.list_sessions().await {
            Ok(sessions) => serde_json::to_string(&sessions).unwrap() + "\n",
            Err(e) => format!("ERROR: {}\n", e),
        },
        "create-session" => {
            if parts.len() < 2 {
                return "ERROR: Missing session name\n".into();
            }
            match tmux_manager.create_session(parts[1]).await {
                Ok(session) => serde_json::to_string(&session).unwrap() + "\n",
                Err(e) => format!("ERROR: {}\n", e),
            }
        }
        "attach" => {
            if parts.len() < 2 {
                return "ERROR: Missing session id\n".into();
            }
            match pty_manager.attach(parts[1]).await {
                Ok(_) => "OK\n".into(),
                Err(e) => format!("ERROR: {}\n", e),
            }
        }
        _ => format!("ERROR: Unknown command: {}\n", parts[0]),
    }
}
