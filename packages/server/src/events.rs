//! The agent event hub (plan v6, P.2): sanitises, stamps and stores what agents report, and fans it out.
//! Agent text is untrusted: it is cleaned before it is stored, logged or sent anywhere.
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::{Arc, Mutex};

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use termanch_core::events::{
    AgentEvent, AgentState, Confidence, EventKind, PlanItem, SessionAgentState, Source,
};
use tokio::sync::broadcast;

pub const RING: usize = 50;
pub const MAX_SESSIONS: usize = 20;
pub const SUMMARY_CHARS: usize = 120;
pub const PLAN_ITEM_CHARS: usize = 200;
pub const PLAN_ITEMS: usize = 20;
pub const STALE_AFTER_MS: u64 = 60_000;

// ---------------------------------------------------------------------------------------------------
// Sanitiser
// ---------------------------------------------------------------------------------------------------

fn is_token_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | ':')
}

fn scrub_token(tok: &str) -> Option<&'static str> {
    let core = tok.trim_matches(|c| matches!(c, '.' | ':' | '-'));
    let long = |s: &str| {
        s.len() >= 32
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    };
    if ["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_", "sk-"]
        .iter()
        .any(|p| core.starts_with(p) && core.len() >= p.len() + 20)
    {
        return Some("[token]");
    }
    // certificate: two long base64url halves joined by a dot
    if let Some((a, b)) = core.split_once('.') {
        let half = |s: &str| {
            s.len() >= 16
                && s.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        };
        if half(a) && half(b) {
            return Some("[cert]");
        }
    }
    if long(core) {
        return Some("[secret]");
    }
    let host_port = core
        .rsplit_once(':')
        .filter(|(_, p)| (2..=5).contains(&p.len()) && p.chars().all(|c| c.is_ascii_digit()));
    let ip4 = |s: &str| {
        let parts: Vec<&str> = s.split('.').collect();
        parts.len() == 4
            && parts
                .iter()
                .all(|p| (1..=3).contains(&p.len()) && p.chars().all(|c| c.is_ascii_digit()))
    };
    if ip4(core) || host_port.map(|(h, _)| ip4(h)).unwrap_or(false) {
        return Some("[ip]");
    }
    if core.matches(':').count() >= 2
        && core
            .split(':')
            .all(|g| g.len() <= 4 && g.chars().all(|c| c.is_ascii_hexdigit()))
    {
        return Some("[ip]");
    }
    if let Some((h, _)) = host_port {
        if h.contains('.')
            && h.rsplit('.')
                .next()
                .map(|t| t.len() >= 2 && t.chars().all(|c| c.is_ascii_alphabetic()))
                .unwrap_or(false)
        {
            return Some("[host]");
        }
    }
    None
}

/// Control characters become spaces (so an escape sequence or newline cannot reshape a log line or a
/// card), secrets and addresses are replaced, whitespace is collapsed and the result is capped at `max`.
pub fn sanitize_text(input: &str, max: usize) -> String {
    let flat: String = input
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    // Values that follow an authorization keyword are secrets whatever they look like.
    let mut out = String::new();
    let mut hide_next = 0u8;
    let mut tok = String::new();
    let flush = |tok: &mut String, out: &mut String, hide_next: &mut u8| {
        if tok.is_empty() {
            return;
        }
        let lower = tok.to_ascii_lowercase();
        let word = lower.trim_matches(|c: char| !c.is_ascii_alphanumeric());
        if *hide_next > 0 && !word.is_empty() {
            out.push_str("[secret]");
            *hide_next -= 1;
        } else if let Some(r) = scrub_token(tok) {
            out.push_str(r);
        } else {
            out.push_str(tok);
        }
        if matches!(
            word,
            "authorization"
                | "bearer"
                | "password"
                | "passwd"
                | "token"
                | "secret"
                | "apikey"
                | "api_key"
                | "--token"
                | "--password"
        ) {
            *hide_next = if word == "authorization" { 2 } else { 1 };
        }
        tok.clear();
    };
    for c in flat.chars() {
        if is_token_char(c) {
            tok.push(c);
        } else {
            flush(&mut tok, &mut out, &mut hide_next);
            out.push(c);
        }
    }
    flush(&mut tok, &mut out, &mut hide_next);
    let collapsed = out.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.chars().take(max).collect()
}

/// Cleans every text field of an event and enforces the plan limits.
pub fn sanitize_kind(kind: EventKind) -> EventKind {
    match kind {
        EventKind::Tool {
            name,
            summary,
            phase,
        } => EventKind::Tool {
            name: sanitize_text(&name, 40),
            summary: sanitize_text(&summary, SUMMARY_CHARS),
            phase,
        },
        EventKind::Message { summary } => EventKind::Message {
            summary: sanitize_text(&summary, SUMMARY_CHARS),
        },
        EventKind::Plan { items } => EventKind::Plan {
            items: items
                .into_iter()
                .take(PLAN_ITEMS)
                .map(|i| PlanItem {
                    text: sanitize_text(&i.text, PLAN_ITEM_CHARS),
                    status: sanitize_text(&i.status, 20),
                })
                .collect(),
        },
        EventKind::Prompt {
            id,
            prompt_kind,
            choices,
        } => EventKind::Prompt {
            id: sanitize_text(&id, 40),
            prompt_kind: sanitize_text(&prompt_kind, 20),
            choices: choices
                .iter()
                .take(6)
                .map(|c| sanitize_text(c, 40))
                .collect(),
        },
        other => other,
    }
}

// ---------------------------------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------------------------------

struct Ring {
    events: VecDeque<AgentEvent>,
    seq: u64,
    state: AgentState,
    state_seq: u64,
    last_event_at: u64,
    last_response_at: Option<u64>,
}

/// A session id as events know it: a plain name, or `manager:name` when several managers run.
pub fn valid_event_session(id: &str) -> bool {
    match id.split_once(':') {
        Some((kind, name)) => crate::backend::valid_name(kind) && crate::backend::valid_name(name),
        None => crate::backend::valid_name(id),
    }
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Clone)]
pub struct EventHub {
    key: Arc<[u8; 32]>,
    rings: Arc<Mutex<HashMap<String, Ring>>>,
    /// The agent the scan found in each session; only sessions that have events report it.
    agents: Arc<Mutex<HashMap<String, String>>>,
    tx: broadcast::Sender<AgentEvent>,
}

impl EventHub {
    pub fn new(key: [u8; 32]) -> Self {
        Self {
            key: Arc::new(key),
            rings: Arc::default(),
            agents: Arc::default(),
            tx: broadcast::channel(256).0,
        }
    }

    /// The hub key lives in the state directory (0600) so sessions that outlive a server restart keep a
    /// working token.
    pub fn load_or_create(dir: &Path) -> Result<Self> {
        let path = dir.join("event.key");
        let key = match std::fs::read(&path) {
            Ok(b) if b.len() == 32 => b.try_into().unwrap(),
            _ => {
                let mut k = [0u8; 32];
                rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut k);
                std::fs::create_dir_all(dir)?;
                write_private(&path, &k)?;
                k
            }
        };
        Ok(Self::new(key))
    }

    fn mac(&self, session: &str) -> Hmac<Sha256> {
        let mut m = Hmac::<Sha256>::new_from_slice(&*self.key).expect("any key length");
        m.update(b"termanch-event-session\0");
        m.update(session.as_bytes());
        m
    }

    /// The token a session's agent tools present; valid for that session name only.
    pub fn token(&self, session: &str) -> String {
        URL_SAFE_NO_PAD.encode(self.mac(session).finalize().into_bytes())
    }

    pub fn token_matches(&self, session: &str, token: &str) -> bool {
        URL_SAFE_NO_PAD
            .decode(token)
            .map(|t| self.mac(session).verify_slice(&t).is_ok())
            .unwrap_or(false)
    }

    pub fn subscribe(&self) -> broadcast::Receiver<AgentEvent> {
        self.tx.subscribe()
    }

    /// An event reported by a session's own tool: accepted only with that session's token.
    pub fn ingest(
        &self,
        session: &str,
        token: &str,
        source: Source,
        confidence: Confidence,
        kinds: Vec<EventKind>,
    ) -> Result<()> {
        if !valid_event_session(session) || !self.token_matches(session, token) {
            tracing::info!(target: "audit", event = "agent_event_refused", session = %session);
            return Err(anyhow!("token does not match the session"));
        }
        for k in kinds {
            self.push(session, source, confidence, k, now_ms());
        }
        Ok(())
    }

    /// An event from the server's own adapters (scan, herdr). A repeated state is not an event.
    pub fn report(&self, session: &str, source: Source, confidence: Confidence, kind: EventKind) {
        self.push(session, source, confidence, kind, now_ms());
    }

    pub fn push(
        &self,
        session: &str,
        source: Source,
        confidence: Confidence,
        kind: EventKind,
        now: u64,
    ) {
        let kind = sanitize_kind(kind);
        if matches!(kind, EventKind::Unknown) {
            return;
        }
        let mut rings = self.rings.lock().unwrap();
        if !rings.contains_key(session) && rings.len() >= MAX_SESSIONS {
            if let Some(oldest) = rings
                .iter()
                .min_by_key(|(_, r)| r.last_event_at)
                .map(|(k, _)| k.clone())
            {
                rings.remove(&oldest);
            }
        }
        let ring = rings.entry(session.to_string()).or_insert_with(|| Ring {
            events: VecDeque::new(),
            seq: 0,
            state: AgentState::Unknown,
            state_seq: 0,
            last_event_at: now,
            last_response_at: None,
        });
        if let EventKind::State { state } = &kind {
            // The same state again only refreshes the clock; a low-confidence source never overrides a
            // fresher state from a precise one within a minute.
            if *state == ring.state {
                ring.last_event_at = now;
                return;
            }
            if confidence == Confidence::Low && source != Source::Screen {
                if let Some(last) = ring
                    .events
                    .iter()
                    .rev()
                    .find(|e| matches!(e.kind, EventKind::State { .. }))
                {
                    if last.confidence != Confidence::Low
                        && now.saturating_sub(last.ts) < STALE_AFTER_MS
                    {
                        return;
                    }
                }
            }
        }
        ring.seq += 1;
        ring.last_event_at = now;
        let event = AgentEvent {
            session: session.to_string(),
            seq: ring.seq,
            ts: now,
            source,
            confidence,
            kind,
        };
        match &event.kind {
            EventKind::State { state } => {
                let was_working = ring.state == AgentState::Working;
                ring.state = *state;
                ring.state_seq = event.seq;
                // A finished turn, or the agent going quiet after working, is a response.
                if *state == AgentState::Done
                    || (was_working && matches!(state, AgentState::Idle | AgentState::NeedsInput))
                {
                    ring.last_response_at = Some(event.ts);
                }
            }
            EventKind::Message { .. } => ring.last_response_at = Some(event.ts),
            _ => {}
        }
        ring.events.push_back(event.clone());
        while ring.events.len() > RING {
            ring.events.pop_front();
        }
        drop(rings);
        // Counts and kinds only, never content (audit-logging-no-secrets).
        tracing::info!(target: "audit", event = "agent_event", session = %event.session, source = ?event.source, seq = event.seq);
        let _ = self.tx.send(event);
    }

    /// Forget a session that no longer exists.
    /// Only ids that start with `prefix` are considered (one per session manager when several run).
    pub fn forget_except(&self, prefix: &str, live: &[String]) {
        self.agents
            .lock()
            .unwrap()
            .retain(|k, _| !k.starts_with(prefix) || live.contains(k));
        self.rings
            .lock()
            .unwrap()
            .retain(|k, _| !k.starts_with(prefix) || live.contains(k));
    }

    /// Records which agent the process scan found in `session`.
    pub fn set_agent(&self, session: &str, agent: &str) {
        let mut agents = self.agents.lock().unwrap();
        if agents.get(session).map(String::as_str) != Some(agent) {
            agents.insert(session.to_string(), agent.to_string());
        }
    }

    pub fn snapshot(&self) -> Vec<SessionAgentState> {
        self.snapshot_at(now_ms())
    }

    pub fn snapshot_at(&self, now: u64) -> Vec<SessionAgentState> {
        let rings = self.rings.lock().unwrap();
        let agents = self.agents.lock().unwrap();
        let mut out: Vec<_> = rings
            .iter()
            .map(|(session, r)| SessionAgentState {
                session: session.clone(),
                state: r.state,
                seq: r.seq,
                stale: r.state == AgentState::Working
                    && now.saturating_sub(r.last_event_at) > STALE_AFTER_MS,
                ts: r.last_event_at,
                agent: agents.get(session).cloned(),
                last_response_at: r.last_response_at,
            })
            .collect();
        out.sort_by(|a, b| a.session.cmp(&b.session));
        out
    }

    /// The prompt a one-tap answer may target: the session's latest `prompt` event, unless the agent has
    /// moved on (a later state other than `needs_input`).
    pub fn current_prompt(&self, session: &str) -> Option<AgentEvent> {
        let rings = self.rings.lock().unwrap();
        let ring = rings.get(session)?;
        let prompt = ring
            .events
            .iter()
            .rev()
            .find(|e| matches!(e.kind, EventKind::Prompt { .. }))?;
        let moved_on = ring.events.iter().any(|e| {
            e.seq > prompt.seq
                && matches!(e.kind, EventKind::State { state } if state != AgentState::NeedsInput)
        });
        (!moved_on).then(|| prompt.clone())
    }

    /// Source and confidence of the session's latest state event, and when it happened.
    pub fn last_state_event(&self, session: &str) -> Option<(Source, Confidence, u64)> {
        let rings = self.rings.lock().unwrap();
        let ring = rings.get(session)?;
        ring.events
            .iter()
            .rev()
            .find(|e| matches!(e.kind, EventKind::State { .. }))
            .map(|e| (e.source, e.confidence, e.ts))
    }

    /// The agent's own hook reported `needs_input` within the last minute and nothing newer has changed the state.
    pub fn hook_says_needs_input(&self, session: &str) -> bool {
        let now = now_ms();
        matches!(
            self.last_state_event(session),
            Some((Source::Hook, Confidence::High, ts)) if now.saturating_sub(ts) < STALE_AFTER_MS
        ) && self
            .snapshot_at(now)
            .iter()
            .any(|s| s.session == session && s.state == AgentState::NeedsInput)
    }

    /// Events of `session` after `seq`, oldest first (only what the ring still holds).
    pub fn since(&self, session: &str, seq: u64) -> Vec<AgentEvent> {
        self.rings
            .lock()
            .unwrap()
            .get(session)
            .map(|r| r.events.iter().filter(|e| e.seq > seq).cloned().collect())
            .unwrap_or_default()
    }

    pub fn sessions_with_events(&self) -> usize {
        self.rings.lock().unwrap().len()
    }
}

fn write_private(path: &Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let mut f = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)?;
    f.write_all(bytes)?;
    Ok(())
}

/// Unix socket paths are limited to about 108 bytes; a long state directory falls back to a private
/// directory (0700) under the temp dir.
pub fn socket_path(state_dir: &Path) -> std::path::PathBuf {
    let preferred = state_dir.join("events.sock");
    if preferred.as_os_str().len() <= 100 {
        return preferred;
    }
    let dir = std::env::temp_dir().join(format!("termanch-{}", unsafe { libc::geteuid() }));
    let _ = std::fs::create_dir_all(&dir);
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700));
    }
    dir.join("events.sock")
}

/// What a session's shell gets so its tools can report: who it is, its token and where to send.
#[derive(Clone)]
pub struct EventEnv {
    pub hub: EventHub,
    pub socket: std::path::PathBuf,
}

impl EventEnv {
    pub fn vars(&self, session: &str) -> Vec<String> {
        vec![
            format!("TERMANCH_SESSION={session}"),
            format!("TERMANCH_EVENT_TOKEN={}", self.hub.token(session)),
            format!("TERMANCH_EVENT_SOCKET={}", self.socket.display()),
        ]
    }
}

// ---------------------------------------------------------------------------------------------------
// Ingest socket
// ---------------------------------------------------------------------------------------------------

/// One line a tool (via `termanch-server hook`) writes: which session, its token, which adapter, and the
/// tool's own JSON, untouched.
#[derive(serde::Deserialize)]
struct Wire {
    session: String,
    token: String,
    adapter: String,
    data: serde_json::Value,
}

const MAX_LINE: u64 = 64 * 1024;

/// A Unix socket in the state directory, mode 0600, never TCP. Every connection carries one line and is
/// answered with nothing; refusals only show in the audit log.
pub async fn serve_socket(hub: EventHub, path: std::path::PathBuf) -> Result<()> {
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
    let _ = std::fs::remove_file(&path);
    let listener = tokio::net::UnixListener::bind(&path)?;
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
    }
    loop {
        let (stream, _) = listener.accept().await?;
        let hub = hub.clone();
        tokio::spawn(async move {
            let mut line = String::new();
            let mut r = BufReader::new(stream.take(MAX_LINE));
            let read =
                tokio::time::timeout(std::time::Duration::from_secs(2), r.read_line(&mut line))
                    .await;
            if !matches!(read, Ok(Ok(n)) if n > 0) {
                return;
            }
            let Ok(w) = serde_json::from_str::<Wire>(&line) else {
                return;
            };
            let Some((source, confidence, kinds)) = crate::adapters::adapt(&w.adapter, &w.data)
            else {
                return;
            };
            let _ = hub.ingest(&w.session, &w.token, source, confidence, kinds);
        });
    }
}

// ---------------------------------------------------------------------------------------------------
// The hook command a tool runs: `termanch-server --hook <adapter>`
// ---------------------------------------------------------------------------------------------------

/// Copies the tool's JSON from stdin to the ingest socket. It never fails and never waits long: whatever
/// goes wrong (no socket, server down, slow disk), it returns, because the agent must not be held up by us.
pub fn run_hook(adapter: &str) {
    let env = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    run_hook_with(
        adapter,
        env("TERMANCH_SESSION"),
        env("TERMANCH_EVENT_TOKEN"),
        env("TERMANCH_EVENT_SOCKET"),
    );
}

pub fn run_hook_with(
    adapter: &str,
    session: Option<String>,
    token: Option<String>,
    socket: Option<String>,
) {
    use std::io::{Read, Write};
    let (Some(session), Some(token), Some(socket)) = (session, token, socket) else {
        return;
    };
    // The deadline covers the whole run, including a stdin that never closes.
    let adapter = adapter.to_string();
    let (done_tx, done_rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut raw = String::new();
        let mut stdin = std::io::stdin().take(MAX_LINE);
        let _ = stdin.read_to_string(&mut raw);
        let data =
            serde_json::from_str::<serde_json::Value>(&raw).unwrap_or(serde_json::Value::Null);
        let line = serde_json::json!({"session": session, "token": token, "adapter": adapter, "data": data}).to_string() + "\n";
        if let Ok(mut s) = std::os::unix::net::UnixStream::connect(&socket) {
            let _ = s.set_write_timeout(Some(std::time::Duration::from_millis(500)));
            let _ = s.write_all(line.as_bytes());
        }
        let _ = done_tx.send(());
    });
    let _ = done_rx.recv_timeout(std::time::Duration::from_millis(1500));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hub() -> EventHub {
        EventHub::new([7; 32])
    }
    fn state(s: AgentState) -> EventKind {
        EventKind::State { state: s }
    }

    #[test]
    fn a_long_state_directory_gets_a_socket_path_that_fits() {
        let short = socket_path(Path::new("/var/lib/termanch"));
        assert_eq!(short, Path::new("/var/lib/termanch/events.sock"));
        let long = socket_path(&Path::new("/tmp").join("x".repeat(120)));
        assert!(
            long.as_os_str().len() <= 100 && long.ends_with("events.sock"),
            "{long:?}"
        );
    }

    #[test]
    fn event_session_ids_may_carry_a_manager_prefix() {
        assert!(valid_event_session("work") && valid_event_session("herdr:work"));
        assert!(
            !valid_event_session("a:b:c")
                && !valid_event_session(":x")
                && !valid_event_session("x:")
        );
    }

    #[test]
    fn forgetting_is_limited_to_one_managers_prefix() {
        let h = hub();
        h.push(
            "tmux:a",
            Source::Scan,
            Confidence::Low,
            state(AgentState::Idle),
            1,
        );
        h.push(
            "herdr:b",
            Source::Herdr,
            Confidence::High,
            state(AgentState::Idle),
            1,
        );
        h.forget_except("tmux:", &[]);
        assert_eq!(
            h.snapshot()
                .iter()
                .map(|s| s.session.as_str())
                .collect::<Vec<_>>(),
            ["herdr:b"]
        );
    }

    #[test]
    fn a_token_only_works_for_its_own_session() {
        let h = hub();
        let t = h.token("one");
        assert!(h.token_matches("one", &t));
        assert!(!h.token_matches("two", &t));
        assert!(!h.token_matches("one", "garbage"));
        assert!(h
            .ingest(
                "two",
                &t,
                Source::Hook,
                Confidence::High,
                vec![state(AgentState::Working)]
            )
            .is_err());
        assert!(h
            .ingest(
                "one",
                &t,
                Source::Hook,
                Confidence::High,
                vec![state(AgentState::Working)]
            )
            .is_ok());
        assert_eq!(h.snapshot().len(), 1);
        assert_eq!(h.snapshot()[0].session, "one");
        assert!(
            EventHub::new([8; 32]).token("one") != t,
            "tokens depend on the key"
        );
    }

    #[test]
    fn control_characters_and_secrets_are_removed() {
        let dirty = "ls\x1b[31m\nrm -rf /\r\n curl -H \"Authorization: Bearer abcDEF123\" http://10.0.0.5:8080/x \
                     ghp_abcdefghijklmnopqrstuvwxyz0123456789 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA \
                     my.host.example.com:4443 2001:db8:0:0:0:0:0:1";
        let clean = sanitize_text(dirty, 500);
        for bad in [
            "\x1b",
            "\n",
            "\r",
            "abcDEF123",
            "ghp_abc",
            "10.0.0.5",
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "my.host.example.com",
            "2001:db8",
        ] {
            assert!(!clean.contains(bad), "{bad:?} leaked: {clean}");
        }
        assert!(clean.contains("[token]") && clean.contains("[secret]") && clean.contains("[ip]"));
        assert!(clean.starts_with("ls"));
    }

    #[test]
    fn text_is_capped_by_characters() {
        assert_eq!(sanitize_text(&"é ".repeat(300), 120).chars().count(), 120);
        let EventKind::Plan { items } = sanitize_kind(EventKind::Plan {
            items: (0..30)
                .map(|i| PlanItem {
                    text: format!("item {i} {}", "x ".repeat(300)),
                    status: "todo".into(),
                })
                .collect(),
        }) else {
            panic!()
        };
        assert_eq!(items.len(), PLAN_ITEMS);
        assert!(items
            .iter()
            .all(|i| i.text.chars().count() <= PLAN_ITEM_CHARS));
    }

    #[test]
    fn rings_stay_bounded_and_seq_is_stamped_by_the_server() {
        let h = hub();
        for i in 0..200 {
            h.push(
                "a",
                Source::Hook,
                Confidence::High,
                EventKind::Message {
                    summary: format!("m{i}"),
                },
                1000 + i,
            );
        }
        let all = h.since("a", 0);
        assert_eq!(all.len(), RING);
        assert_eq!(all.last().unwrap().seq, 200);
        assert_eq!(all[0].seq, 151);
        assert_eq!(h.since("a", 195).len(), 5);
        for i in 0..40 {
            h.push(
                &format!("s{i}"),
                Source::Hook,
                Confidence::High,
                state(AgentState::Idle),
                5000 + i,
            );
        }
        assert_eq!(h.sessions_with_events(), MAX_SESSIONS);
    }

    #[test]
    fn unknown_kinds_are_ignored_and_repeated_states_are_not_events() {
        let h = hub();
        h.push("a", Source::Hook, Confidence::High, EventKind::Unknown, 1);
        assert_eq!(h.sessions_with_events(), 0);
        h.push(
            "a",
            Source::Scan,
            Confidence::Low,
            state(AgentState::Idle),
            1,
        );
        h.push(
            "a",
            Source::Scan,
            Confidence::Low,
            state(AgentState::Idle),
            2,
        );
        assert_eq!(h.since("a", 0).len(), 1);
    }

    #[test]
    fn a_working_state_with_no_news_is_reported_stale_and_a_precise_source_beats_the_scan() {
        let h = hub();
        h.push(
            "a",
            Source::Hook,
            Confidence::High,
            state(AgentState::Working),
            1_000,
        );
        assert!(!h.snapshot_at(30_000)[0].stale);
        assert!(h.snapshot_at(70_000)[0].stale);
        assert_eq!(h.snapshot_at(70_000)[0].state, AgentState::Working);
        h.push(
            "a",
            Source::Scan,
            Confidence::Low,
            state(AgentState::Idle),
            20_000,
        );
        assert_eq!(
            h.snapshot_at(21_000)[0].state,
            AgentState::Working,
            "the scan must not override a fresh hook"
        );
        h.push(
            "a",
            Source::Scan,
            Confidence::Low,
            state(AgentState::Idle),
            90_000,
        );
        assert_eq!(h.snapshot_at(91_000)[0].state, AgentState::Idle);
    }

    #[tokio::test]
    async fn the_socket_is_private_and_a_wrong_token_changes_nothing() {
        use std::os::unix::fs::PermissionsExt;
        use tokio::io::AsyncWriteExt;
        let dir = std::env::temp_dir().join(format!("tm-ev-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let sock = dir.join("events.sock");
        let h = hub();
        tokio::spawn(serve_socket(h.clone(), sock.clone()));
        for _ in 0..50 {
            if sock.exists() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        assert_eq!(
            std::fs::metadata(&sock).unwrap().permissions().mode() & 0o777,
            0o600
        );
        let send = |session: &str, token: String| {
            let line = serde_json::json!({"session": session, "token": token, "adapter": "claude",
                "data": {"hook_event_name": "UserPromptSubmit", "prompt": "secret prompt"}})
            .to_string()
                + "\n";
            let sock = sock.clone();
            async move {
                let mut s = tokio::net::UnixStream::connect(sock).await.unwrap();
                s.write_all(line.as_bytes()).await.unwrap();
            }
        };
        send("one", "wrong".into()).await;
        send("one", h.token("two")).await;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        assert_eq!(h.sessions_with_events(), 0);
        send("one", h.token("one")).await;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let ev = h.since("one", 0);
        assert_eq!(ev.len(), 1);
        assert_eq!(ev[0].kind, state(AgentState::Working));
        assert!(
            !serde_json::to_string(&ev)
                .unwrap()
                .contains("secret prompt"),
            "prompt text never leaves the hook payload"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 20 sessions at 20 events per second for a minute of events, processed in one go: memory is bounded
    /// by the rings and the CPU cost is tiny (the budget is 5% of one core, i.e. 3 s per minute).
    #[test]
    fn load_20_sessions_at_20_events_per_second_for_a_minute() {
        let h = hub();
        let started = std::time::Instant::now();
        for sec in 0..60u64 {
            for n in 0..20 {
                for e in 0..20u64 {
                    let kind = if e % 2 == 0 {
                        EventKind::Tool { name: "Bash".into(), summary: "cargo test --workspace -- --nocapture token=abcdefghijklmnopqrstuvwxyz0123456789".into(), phase: termanch_core::events::ToolPhase::Started }
                    } else {
                        EventKind::Message {
                            summary: "working on the next step of the plan".into(),
                        }
                    };
                    h.push(
                        &format!("s{n}"),
                        Source::Hook,
                        Confidence::High,
                        kind,
                        1_000 + sec * 1000 + e,
                    );
                }
            }
        }
        let took = started.elapsed();
        assert_eq!(h.sessions_with_events(), 20);
        assert!(took.as_secs_f64() < 3.0, "24000 events took {took:?}");
        let bytes: usize = (0..20)
            .map(|n| {
                serde_json::to_string(&h.since(&format!("s{n}"), 0))
                    .unwrap()
                    .len()
            })
            .sum();
        assert!(bytes < 500_000, "rings hold {bytes} bytes");
        eprintln!("24000 events in {took:?}, rings {bytes} bytes");
    }
}
