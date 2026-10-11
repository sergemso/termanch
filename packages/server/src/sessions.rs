use std::time::Duration;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use tracing::{debug, info};

use termanch_core::protocol::{ClientMessage, ServerMessage};

use std::sync::Arc;

use crate::backend::SessionBackend;
use crate::pty::Attachment;

const PING_EVERY: Duration = Duration::from_secs(20);

/// Serves one authenticated WebSocket: lists/creates tmux sessions and bridges one attached session.
/// Persistence lives in the session backend (tmux by default); a dropped connection only detaches (see pty.rs).
#[derive(Clone)]
pub struct SessionManager {
    backend: Arc<dyn SessionBackend>,
}

impl SessionManager {
    pub fn new(backend: Arc<dyn SessionBackend>) -> Self {
        Self { backend }
    }

    pub async fn handle_websocket(
        &self,
        mut socket: WebSocket,
        identity: crate::auth::Identity,
    ) -> Result<()> {
        let mut attachment: Option<Attachment> = None;
        let (mut cols, mut rows) = (80u16, 24u16);
        let mut ping = tokio::time::interval(PING_EVERY);

        loop {
            tokio::select! {
                msg = socket.recv() => {
                    let Some(Ok(msg)) = msg else { break };
                    match msg {
                        Message::Text(text) => {
                            let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) else { continue };
                            match self.handle(client_msg, &mut attachment, &mut cols, &mut rows, &mut socket).await {
                                Ok(()) => {}
                                Err(e) => {
                                    send(&mut socket, &ServerMessage::Error { message: e.to_string() }).await?;
                                }
                            }
                        }
                        Message::Binary(data) => {
                            if let Some(att) = attachment.as_mut() {
                                att.write(&data)?;
                            }
                        }
                        Message::Close(_) => break,
                        _ => {}
                    }
                }
                out = next_output(&mut attachment) => {
                    match out {
                        Some(bytes) => send(&mut socket, &ServerMessage::Output { data: B64.encode(bytes) }).await?,
                        None => {
                            // The tmux client exited: session killed or detached from inside.
                            attachment = None;
                            send(&mut socket, &ServerMessage::Error { message: "Session ended".into() }).await?;
                            let sessions = self.backend.list().await.unwrap_or_default();
                            send(&mut socket, &ServerMessage::Sessions { sessions }).await?;
                        }
                    }
                }
                _ = ping.tick() => {
                    if socket.send(Message::Ping(Vec::new())).await.is_err() { break; }
                }
            }
        }

        info!("WebSocket closed for {}", identity.login);
        Ok(())
    }

    async fn handle(
        &self,
        msg: ClientMessage,
        attachment: &mut Option<Attachment>,
        cols: &mut u16,
        rows: &mut u16,
        socket: &mut WebSocket,
    ) -> Result<()> {
        match msg {
            ClientMessage::Auth { .. } => {} // handled once, before this loop (websocket.rs)
            ClientMessage::Ping => send(socket, &ServerMessage::Pong).await?,
            ClientMessage::ListSessions => {
                let sessions = self.backend.list().await?;
                send(socket, &ServerMessage::Sessions { sessions }).await?;
            }
            ClientMessage::NewSession { name } => {
                self.backend.create(&name).await?;
                let sessions = self.backend.list().await?;
                send(socket, &ServerMessage::Sessions { sessions }).await?;
            }
            ClientMessage::Attach { session_id } => {
                *attachment = None; // detach the previous one first
                *attachment = Some(self.backend.attach(&session_id, *cols, *rows)?);
                send(socket, &ServerMessage::SessionAttached { session_id }).await?;
            }
            ClientMessage::Input { data } => {
                if let Some(att) = attachment.as_mut() {
                    att.write(&B64.decode(data)?)?;
                }
            }
            ClientMessage::Resize { cols: c, rows: r } => {
                if c == 0 || r == 0 || c > 1000 || r > 1000 {
                    return Ok(());
                }
                *cols = c;
                *rows = r;
                if let Some(att) = attachment.as_ref() {
                    debug!("resize {c}x{r}");
                    att.resize(c, r)?;
                }
            }
        }
        Ok(())
    }
}

async fn send(socket: &mut WebSocket, msg: &ServerMessage) -> Result<()> {
    socket
        .send(Message::Text(serde_json::to_string(msg)?))
        .await?;
    Ok(())
}

/// Next chunk of terminal output; pends forever while nothing is attached.
async fn next_output(attachment: &mut Option<Attachment>) -> Option<Vec<u8>> {
    match attachment {
        Some(att) => att.rx.recv().await,
        None => std::future::pending().await,
    }
}
