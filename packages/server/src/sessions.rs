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
            ClientMessage::Answer {
                session,
                prompt_id,
                seq,
                choice,
            } => {
                let hub = self
                    .events
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("Answers are not available"))?;
                answer(
                    self.backend.as_ref(),
                    hub,
                    &session,
                    &prompt_id,
                    seq,
                    choice,
                )
                .await?;
                info!(target: "audit", event = "answer_sent", github_id = identity.id, session = %session, choice);
            }
            ClientMessage::Reply { session, text } => {
                // One line, no control characters: it is typed, then Enter.
                let line: String = text.chars().filter(|c| !c.is_control()).take(500).collect();
                if line.trim().is_empty() {
                    return Ok(());
                }
                self.backend
                    .send_text(&session, &format!("{line}\r"))
                    .await?;
                info!(target: "audit", event = "reply_sent", github_id = identity.id, session = %session);
            }
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
            ClientMessage::Peek { session, hash } => {
                // Only a counter in the audit log: what is on the screen is never logged.
                audit_peek(identity.id, &session);
                let reply = peek(self.backend.as_ref(), &session, hash.as_deref()).await;
                send_r(tx, &reply).await?;
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

fn audit_peek(github_id: u64, session: &str) {
    info!(target: "audit", event = "peek", github_id, session = %session);
}

/// The most a snapshot carries; a phone screen is a few KB, this only stops a huge pane from being sent.
pub const SNAPSHOT_MAX: usize = 16 * 1024;

/// A session's visible screen for the client to draw at once (decision 0084). Never fails: a manager that cannot
/// capture (herdr) gets an empty snapshot, which the client reads as "attach normally".
pub async fn peek(
    backend: &dyn SessionBackend,
    session: &str,
    known: Option<&str>,
) -> ServerMessage {
    use sha2::{Digest, Sha256};
    let none = || ServerMessage::Snapshot {
        session: session.to_string(),
        text: String::new(),
        hash: String::new(),
        unchanged: false,
    };
    let Ok(raw) = backend.capture_styled(session).await else {
        return none();
    };
    // Blank lines below the cursor carry nothing; keep the end of the text when it is too long.
    let mut text = raw.trim_end().to_string();
    if text.len() > SNAPSHOT_MAX {
        let mut cut = text.len() - SNAPSHOT_MAX;
        while !text.is_char_boundary(cut) {
            cut += 1;
        }
        text = text[cut..].to_string();
    }
    let hash: String = Sha256::digest(text.as_bytes())[..8]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    if known == Some(hash.as_str()) {
        return ServerMessage::Snapshot {
            session: session.to_string(),
            text: String::new(),
            hash,
            unchanged: true,
        };
    }
    ServerMessage::Snapshot {
        session: session.to_string(),
        text,
        hash,
        unchanged: false,
    }
}

const PROMPT_CHANGED: &str = "That prompt changed";

/// A one-tap answer (plan v8, K.4). It acts only on the prompt the user saw: the session's current prompt, with
/// the same id and event number, confirmed by the agent's own hook (`confidence=high`), and still on the pane.
/// The keys are the ones the screen's own choice list defines, never text from the client.
pub async fn answer(
    backend: &dyn SessionBackend,
    hub: &EventHub,
    session: &str,
    prompt_id: &str,
    seq: u64,
    choice: u8,
) -> Result<()> {
    use termanch_core::events::{Confidence, EventKind};
    let current = hub
        .current_prompt(session)
        .ok_or_else(|| anyhow::anyhow!(PROMPT_CHANGED))?;
    let EventKind::Prompt { id, .. } = &current.kind else {
        return Err(anyhow::anyhow!(PROMPT_CHANGED));
    };
    if id != prompt_id || current.seq != seq {
        return Err(anyhow::anyhow!(PROMPT_CHANGED));
    }
    if current.confidence != Confidence::High {
        return Err(anyhow::anyhow!(
            "This prompt is not confirmed by the agent; open the terminal to answer"
        ));
    }
    let screen = backend.capture(session).await?;
    let info = crate::adapters::parse_prompt(&screen)
        .filter(|i| id.ends_with(&crate::agentwatch::hex8(&i.question)))
        .ok_or_else(|| anyhow::anyhow!(PROMPT_CHANGED))?;
    let (_, keys) = info
        .choices
        .get(choice as usize)
        .ok_or_else(|| anyhow::anyhow!("No such choice"))?;
    backend.send_text(session, keys).await
}

#[cfg(test)]
mod answer_tests {
    use super::*;
    use crate::agentwatch::hex8;
    use std::sync::Mutex;
    use termanch_core::events::{AgentState, Confidence, EventKind, Source};

    struct Fake {
        screen: Mutex<String>,
        sent: Mutex<Vec<String>>,
    }
    #[async_trait::async_trait]
    impl SessionBackend for Fake {
        fn name(&self) -> &str {
            "fake"
        }
        async fn list(&self) -> Result<Vec<termanch_core::protocol::SessionInfo>> {
            Ok(vec![])
        }
        async fn create(&self, _: &str) -> Result<()> {
            Ok(())
        }
        fn attach(&self, _: &str, _: u16, _: u16) -> Result<Attachment> {
            Err(anyhow::anyhow!("no"))
        }
        async fn capture(&self, _: &str) -> Result<String> {
            Ok(self.screen.lock().unwrap().clone())
        }
        async fn send_text(&self, _: &str, text: &str) -> Result<()> {
            self.sent.lock().unwrap().push(text.to_string());
            Ok(())
        }
    }

    const SCREEN: &str =
        "Edit file?\n Do you want to proceed?\n ❯ 1. Yes\n   2. Yes, always\n   3. No\n";

    fn setup(confidence: Confidence, screen: &str) -> (Fake, EventHub, String, u64) {
        let hub = EventHub::new([3; 32]);
        let question = crate::adapters::detect_prompt(SCREEN).unwrap();
        let id = format!("1-{}", hex8(&question));
        hub.push(
            "s",
            Source::Hook,
            Confidence::High,
            EventKind::State {
                state: AgentState::NeedsInput,
            },
            1,
        );
        hub.push(
            "s",
            Source::Screen,
            confidence,
            EventKind::Prompt {
                id: id.clone(),
                prompt_kind: "choice".into(),
                choices: vec![],
            },
            2,
        );
        let seq = hub.current_prompt("s").unwrap().seq;
        (
            Fake {
                screen: Mutex::new(screen.into()),
                sent: Mutex::default(),
            },
            hub,
            id,
            seq,
        )
    }

    #[tokio::test]
    async fn the_choice_sends_exactly_its_own_keys() {
        for (choice, keys) in [(0u8, "1"), (1, "2"), (2, "3")] {
            let (b, hub, id, seq) = setup(Confidence::High, SCREEN);
            answer(&b, &hub, "s", &id, seq, choice).await.unwrap();
            assert_eq!(*b.sent.lock().unwrap(), vec![keys.to_string()]);
        }
    }

    #[tokio::test]
    async fn a_stale_wrong_changed_or_unconfirmed_prompt_is_refused_and_nothing_is_sent() {
        let (b, hub, id, seq) = setup(Confidence::High, SCREEN);
        for (pid, s) in [("9-ffffffff", seq), (id.as_str(), seq + 5)] {
            let e = answer(&b, &hub, "s", pid, s, 0)
                .await
                .unwrap_err()
                .to_string();
            assert!(e.contains("changed"), "{e}");
        }
        assert!(answer(&b, &hub, "s", &id, seq, 7)
            .await
            .unwrap_err()
            .to_string()
            .contains("No such choice"));
        assert!(answer(&b, &hub, "other", &id, seq, 0).await.is_err());
        // the pane no longer shows the question
        *b.screen.lock().unwrap() = "$ ls\nfile\n".into();
        assert!(answer(&b, &hub, "s", &id, seq, 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("changed"));
        // the agent moved on
        *b.screen.lock().unwrap() = SCREEN.into();
        hub.push(
            "s",
            Source::Hook,
            Confidence::High,
            EventKind::State {
                state: AgentState::Working,
            },
            3,
        );
        assert!(answer(&b, &hub, "s", &id, seq, 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("changed"));
        // low confidence
        let (b2, hub2, id2, seq2) = setup(Confidence::Low, SCREEN);
        assert!(answer(&b2, &hub2, "s", &id2, seq2, 0)
            .await
            .unwrap_err()
            .to_string()
            .contains("not confirmed"));
        assert!(b.sent.lock().unwrap().is_empty() && b2.sent.lock().unwrap().is_empty());
    }
}

#[cfg(test)]
mod peek_tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    struct Fake(Mutex<Option<String>>);
    #[async_trait::async_trait]
    impl SessionBackend for Fake {
        fn name(&self) -> &str {
            "fake"
        }
        async fn list(&self) -> Result<Vec<termanch_core::protocol::SessionInfo>> {
            Ok(vec![])
        }
        async fn create(&self, _: &str) -> Result<()> {
            Ok(())
        }
        fn attach(&self, _: &str, _: u16, _: u16) -> Result<Attachment> {
            Err(anyhow::anyhow!("no"))
        }
        async fn capture_styled(&self, _: &str) -> Result<String> {
            self.0
                .lock()
                .unwrap()
                .clone()
                .ok_or_else(|| anyhow::anyhow!("no pane"))
        }
    }

    fn parts(m: ServerMessage) -> (String, String, bool) {
        match m {
            ServerMessage::Snapshot {
                text,
                hash,
                unchanged,
                ..
            } => (text, hash, unchanged),
            other => panic!("{other:?}"),
        }
    }

    #[tokio::test]
    async fn a_snapshot_carries_the_text_then_says_unchanged_for_a_known_hash() {
        let b = Fake(Mutex::new(Some("\x1b[31mred\x1b[0m word\n\n\n".into())));
        let (text, hash, unchanged) = parts(peek(&b, "s", None).await);
        assert_eq!(
            text, "\x1b[31mred\x1b[0m word",
            "colour codes stay, trailing blank lines go"
        );
        assert!(!unchanged && hash.len() == 16);
        let (text2, hash2, unchanged2) = parts(peek(&b, "s", Some(&hash)).await);
        assert!(text2.is_empty() && unchanged2 && hash2 == hash);
        *b.0.lock().unwrap() = Some("changed".into());
        assert!(
            !parts(peek(&b, "s", Some(&hash)).await).2,
            "a different screen is sent in full"
        );
    }

    #[tokio::test]
    async fn a_huge_pane_is_cut_to_its_end_and_a_manager_that_cannot_capture_gets_an_empty_snapshot(
    ) {
        let big = format!("{}END", "x".repeat(40_000));
        let b = Fake(Mutex::new(Some(big)));
        let (text, _, _) = parts(peek(&b, "s", None).await);
        assert_eq!(text.len(), SNAPSHOT_MAX);
        assert!(text.ends_with("END"));
        let none = Fake(Mutex::new(None));
        assert_eq!(
            parts(peek(&none, "s", None).await),
            (String::new(), String::new(), false)
        );
    }

    #[derive(Clone, Default)]
    struct Buf(Arc<Mutex<Vec<u8>>>);
    impl std::io::Write for Buf {
        fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(b);
            Ok(b.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for Buf {
        type Writer = Buf;
        fn make_writer(&'a self) -> Buf {
            self.clone()
        }
    }

    /// The audit line the handler writes names the session and nothing from the screen.
    #[tokio::test]
    async fn the_audit_line_for_a_peek_holds_no_pane_text() {
        let buf = Buf::default();
        let sub = tracing_subscriber::fmt()
            .with_writer(buf.clone())
            .with_ansi(false)
            .finish();
        let secret = "SECRET-SCREEN-TEXT";
        let b = Fake(Mutex::new(Some(secret.into())));
        let _guard = tracing::subscriber::set_default(sub);
        audit_peek(1, "s");
        let reply = peek(&b, "s", None).await;
        assert!(parts(reply).0.contains(secret));
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(
            logged.contains("peek") && !logged.contains(secret),
            "{logged}"
        );
    }
}
