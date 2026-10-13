use std::time::Duration;

use anyhow::Result;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use tracing::{debug, info};

use termanch_core::protocol::{ClientMessage, ServerMessage};

use std::sync::Arc;

use crate::backend::{RunMode, SessionBackend};
use crate::events::EventHub;
use crate::link::{Link, LinkTx};
use crate::pty::Attachment;

/// Clients ping every 5 s, so a minute of silence means the peer is gone.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);

/// Serves one authenticated WebSocket: lists/creates tmux sessions and bridges one attached session.
/// Persistence lives in the session backend (tmux by default); a dropped connection only detaches (see pty.rs).
#[derive(Clone)]
pub struct SessionManager {
    backend: Arc<dyn SessionBackend>,
    mode: RunMode,
    server_name: String,
    /// Called after an uninstall has wiped the configuration and told the client; stops the process.
    on_uninstalled: Arc<dyn Fn() + Send + Sync>,
    events: Option<EventHub>,
}

impl SessionManager {
    pub fn new(backend: Arc<dyn SessionBackend>, mode: RunMode) -> Self {
        Self {
            backend,
            mode,
            server_name: String::new(),
            on_uninstalled: Arc::new(|| {}),
            events: None,
        }
    }

    /// The session managers a client may pick from when it creates a session.
    pub fn backends(&self) -> Vec<String> {
        self.backend.kinds()
    }

    /// Serves the agent event stream (plan v6) to every connection.
    pub fn with_events(mut self, hub: EventHub) -> Self {
        self.events = Some(hub);
        self
    }

    /// Enables remote uninstall: `server_name` is what the owner must type, `on_uninstalled` stops the server.
    pub fn with_uninstall(
        mut self,
        server_name: String,
        on_uninstalled: Arc<dyn Fn() + Send + Sync>,
    ) -> Self {
        self.server_name = server_name;
        self.on_uninstalled = on_uninstalled;
        self
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
        let mut agent_rx = self.events.as_ref().map(|h| h.subscribe());

        loop {
            tokio::select! {
                msg = link.rx.recv() => {
                    let Some(text) = msg else { break };
                    idle.as_mut().reset(tokio::time::Instant::now() + IDLE_TIMEOUT);
                    let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) else { continue };
                    if let (true, ClientMessage::Attach { session_id }) = (self.mode.is_host(), &client_msg) {
                        // Who got a shell on the host and as whom; never what they typed.
                        info!(target: "audit", event = "host_session", github_id = identity.id, login = %identity.login, run_as = %self.mode.label(), session = %session_id);
                    }
                    if let Err(e) = self.handle(client_msg, auth, &identity, &mut attachment, &mut cols, &mut rows, &link.tx).await {
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
                batch = next_events(&mut agent_rx) => {
                    let msg = match batch {
                        Some(events) => ServerMessage::AgentEvents { events },
                        // Too slow to keep up: the client resyncs from a snapshot.
                        None => ServerMessage::AgentSnapshot { states: self.events.as_ref().map(|h| h.snapshot()).unwrap_or_default() },
                    };
                    if !send(&link.tx, &msg).await { break; }
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

    #[allow(clippy::too_many_arguments)] // one connection's state, passed explicitly
    async fn handle(
        &self,
        msg: ClientMessage,
        auth: &crate::auth::AuthState,
        identity: &crate::auth::Identity,
        attachment: &mut Option<Attachment>,
        cols: &mut u16,
        rows: &mut u16,
        tx: &LinkTx,
    ) -> Result<()> {
        match msg {
            // The handshake happens once, before this loop (connection.rs).
            ClientMessage::Hello | ClientMessage::Auth { .. } => {}
            ClientMessage::Uninstall { confirm_name, .. } => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                if let Err(reason) = crate::uninstall::authorize(
                    &self.server_name,
                    &confirm_name,
                    identity.issued_at,
                    now,
                ) {
                    info!(target: "audit", event = "uninstall_refused", github_id = identity.id, reason);
                    return Err(anyhow::anyhow!(reason));
                }
                info!(target: "audit", event = "uninstall_started", github_id = identity.id, login = %identity.login, mode = %self.mode.label());
                *attachment = None;
                crate::uninstall::wipe(auth.dir())?;
                info!(target: "audit", event = "uninstall_config_wiped");
                send_r(
                    tx,
                    &ServerMessage::UninstallDone {
                        mode: self.mode.label(),
                    },
                )
                .await?;
                (self.on_uninstalled)();
            }
            ClientMessage::RevokeDevice { device } => {
                auth.revoke_device(&device)?;
                send_r(tx, &ServerMessage::DeviceRevoked { device }).await?;
            }
            ClientMessage::Ping => send_r(tx, &ServerMessage::Pong).await?,
            ClientMessage::AgentSync { after } => {
                let Some(hub) = &self.events else {
                    return Ok(());
                };
                let states = hub.snapshot();
                let mut events = Vec::new();
                for st in &states {
                    if let Some(seq) = after.get(&st.session) {
                        events.extend(hub.since(&st.session, *seq));
                    }
                }
                send_r(tx, &ServerMessage::AgentSnapshot { states }).await?;
                if !events.is_empty() {
                    send_r(tx, &ServerMessage::AgentEvents { events }).await?;
                }
            }
            ClientMessage::ListSessions => {
                let sessions = self.backend.list().await?;
                send_r(tx, &ServerMessage::Sessions { sessions }).await?;
            }
            ClientMessage::NewSession { name, backend } => {
                self.backend.create_in(&name, backend.as_deref()).await?;
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

/// The next agent events (up to 20 at once); `None` when this connection fell behind; pends forever
/// when events are off.
async fn next_events(
    rx: &mut Option<tokio::sync::broadcast::Receiver<termanch_core::events::AgentEvent>>,
) -> Option<Vec<termanch_core::events::AgentEvent>> {
    use tokio::sync::broadcast::error::{RecvError, TryRecvError};
    let Some(rx) = rx else {
        return std::future::pending().await;
    };
    let mut out = match rx.recv().await {
        Ok(e) => vec![e],
        Err(RecvError::Lagged(_)) => return None,
        Err(RecvError::Closed) => return std::future::pending().await,
    };
    while out.len() < 20 {
        match rx.try_recv() {
            Ok(e) => out.push(e),
            Err(TryRecvError::Lagged(_)) => return None,
            Err(_) => break,
        }
    }
    Some(out)
}
