use std::time::Duration;

use anyhow::Result;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use tracing::{debug, info};

use termanch_core::protocol::{ClientMessage, ServerMessage};

use std::sync::Arc;

use crate::backend::SessionBackend;
use crate::link::{Link, LinkTx};
use crate::pty::Attachment;

/// Clients ping every 5 s, so a minute of silence means the peer is gone.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);

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

    /// Serves one authenticated connection until it ends or goes silent.
    pub async fn serve(
        &self,
        mut link: Link,
        identity: crate::auth::Identity,
        auth: &crate::auth::AuthState,
    ) -> Result<()> {
        let mut attachment: Option<Attachment> = None;
        let (mut cols, mut rows) = (80u16, 24u16);
        let idle = tokio::time::sleep(IDLE_TIMEOUT);
        tokio::pin!(idle);

        loop {
            tokio::select! {
                msg = link.rx.recv() => {
                    let Some(text) = msg else { break };
                    idle.as_mut().reset(tokio::time::Instant::now() + IDLE_TIMEOUT);
                    let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) else { continue };
                    if let Err(e) = self.handle(client_msg, auth, &mut attachment, &mut cols, &mut rows, &link.tx).await {
                        if !send(&link.tx, &ServerMessage::Error { message: e.to_string() }).await { break; }
                    }
                }
                out = next_output(&mut attachment) => {
                    match out {
                        Some(bytes) => {
                            if !send(&link.tx, &ServerMessage::Output { data: B64.encode(bytes) }).await { break; }
                        }
                        None => {
                            // The attach client exited: session killed, or detached from inside.
                            attachment = None;
                            if !send(&link.tx, &ServerMessage::Error { message: "Session ended".into() }).await { break; }
                            let sessions = self.backend.list().await.unwrap_or_default();
                            if !send(&link.tx, &ServerMessage::Sessions { sessions }).await { break; }
                        }
                    }
                }
                _ = &mut idle => {
                    info!("Closing idle connection of {}", identity.login);
                    break;
                }
            }
        }

        info!("Connection closed for {}", identity.login);
        Ok(())
    }

    async fn handle(
        &self,
        msg: ClientMessage,
        auth: &crate::auth::AuthState,
        attachment: &mut Option<Attachment>,
        cols: &mut u16,
        rows: &mut u16,
        tx: &LinkTx,
    ) -> Result<()> {
        match msg {
            // The handshake happens once, before this loop (connection.rs).
            ClientMessage::Hello | ClientMessage::Auth { .. } => {}
            ClientMessage::RevokeDevice { device } => {
                auth.revoke_device(&device)?;
                send_r(tx, &ServerMessage::DeviceRevoked { device }).await?;
            }
            ClientMessage::Ping => send_r(tx, &ServerMessage::Pong).await?,
            ClientMessage::ListSessions => {
                let sessions = self.backend.list().await?;
                send_r(tx, &ServerMessage::Sessions { sessions }).await?;
            }
            ClientMessage::NewSession { name } => {
                self.backend.create(&name).await?;
                let sessions = self.backend.list().await?;
                send_r(tx, &ServerMessage::Sessions { sessions }).await?;
            }
            ClientMessage::Attach { session_id } => {
                *attachment = None; // detach the previous one first
                *attachment = Some(self.backend.attach(&session_id, *cols, *rows)?);
                send_r(tx, &ServerMessage::SessionAttached { session_id }).await?;
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

async fn send(tx: &LinkTx, msg: &ServerMessage) -> bool {
    tx.send(serde_json::to_string(msg).unwrap()).await
}

async fn send_r(tx: &LinkTx, msg: &ServerMessage) -> Result<()> {
    if send(tx, msg).await {
        Ok(())
    } else {
        Err(anyhow::anyhow!("connection closed"))
    }
}

/// Next chunk of terminal output; pends forever while nothing is attached.
async fn next_output(attachment: &mut Option<Attachment>) -> Option<Vec<u8>> {
    match attachment {
        Some(att) => att.rx.recv().await,
        None => std::future::pending().await,
    }
}
