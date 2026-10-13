//! Whole-server tests: a real client over each transport (WebSocket and WebRTC data channel),
//! a mock GitHub, and real tmux. Every scenario runs over both transports.
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Router;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use str0m::channel::{ChannelConfig, ChannelId};
use str0m::config::Fingerprint;
use str0m::ice::IceCreds;
use str0m::net::{Protocol, Receive};
use str0m::{Candidate, Event, Input, Output, Rtc};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::auth::AuthState;
use crate::cert::testing::{now, Device, Signer};
use crate::rtc::{self, RtcInfo, CHANNEL_ID, SERVER_PWD, SERVER_UFRAG};
use crate::sessions::SessionManager;
use crate::{router, AppState};

async fn serve(app: Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("127.0.0.1:{}", addr.port())
}

struct Fixture {
    ws_addr: String,
    rtc: RtcInfo,
    claim: String,
    signer: Signer,
    server_id: String,
    auth: Arc<AuthState>,
    dir: std::path::PathBuf,
    stopped: Arc<std::sync::atomic::AtomicBool>,
    hub: crate::events::EventHub,
    events_socket: std::path::PathBuf,
}

/// A browser: its device key and the certificate the hosted function issued for it.
struct Who {
    device: Device,
    cert: String,
}

impl Fixture {
    fn who(&self, id: u64, login: &str) -> Who {
        let device = Device::new();
        let cert = self.signer.issue(&device, id, login, now() + 3600);
        Who { device, cert }
    }
}

async fn fixture() -> Fixture {
    let dir = std::env::temp_dir().join(format!("termanch-e2e-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let signer = Signer::new("k1");
    let server_id = "test-server-id".to_string();
    let auth = Arc::new(AuthState::new(dir.clone(), signer.keys(), server_id.clone()).unwrap());
    let claim = auth.claim_token().unwrap().unwrap();
    let stopped = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_flag = stopped.clone();
    let hub = crate::events::EventHub::new([9; 32]);
    let events_socket = dir.join("events.sock");
    tokio::spawn(crate::events::serve_socket(
        hub.clone(),
        events_socket.clone(),
    ));
    let env = crate::events::EventEnv {
        hub: hub.clone(),
        socket: events_socket.clone(),
    };
    let mut state = AppState {
        auth: auth.clone(),
        sessions: Arc::new(
            SessionManager::new(
                Arc::new(crate::backend::TmuxBackend::default().with_events(env)),
                crate::backend::RunMode::Container,
            )
            .with_events(hub.clone())
            .with_uninstall(
                "test-vps".into(),
                Arc::new(move || stop_flag.store(true, std::sync::atomic::Ordering::SeqCst)),
            ),
        ),
        server_name: "test-vps".into(),
        mode: "container".into(),
        rtc_info: None,
    };
    let cert = rtc::load_or_create_cert(&dir).unwrap();
    let rtc = rtc::start(
        SocketAddr::new(Ipv4Addr::LOCALHOST.into(), 0),
        Ipv4Addr::LOCALHOST.into(),
        cert,
        rtc::Limits::default(),
        state.clone(),
    )
    .await
    .unwrap();
    state.rtc_info = Some(rtc.clone());
    Fixture {
        ws_addr: serve(router(state, false)).await,
        rtc,
        claim,
        signer,
        server_id,
        auth,
        dir,
        stopped,
        hub,
        events_socket,
    }
}

// --- test clients -------------------------------------------------------------------------------

#[derive(Clone, Copy, Debug)]
enum Kind {
    Ws,
    Rtc,
}

enum Conn {
    Ws(
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    ),
    Rtc(RtcClient),
}

impl Conn {
    async fn open(kind: Kind, f: &Fixture) -> Conn {
        match kind {
            Kind::Ws => Conn::Ws(
                connect_async(format!("ws://{}/ws", f.ws_addr))
                    .await
                    .unwrap()
                    .0,
            ),
            Kind::Rtc => Conn::Rtc(
                RtcClient::connect(&f.rtc, &f.rtc.fingerprint)
                    .await
                    .unwrap(),
            ),
        }
    }

    /// Runs the handshake as `who`, signing for `server_id`; the reply (`auth_ok` or `error`) is next.
    async fn login(&mut self, f: &Fixture, who: &Who, claim: &str) {
        self.login_for(&f.server_id, who, &who.cert, claim).await
    }

    async fn login_for(&mut self, server_id: &str, who: &Who, cert: &str, claim: &str) {
        self.send(json!({"type":"hello"})).await;
        let ch = self.recv_type("challenge").await;
        let nonce = ch["nonce"].as_str().unwrap();
        self.send(json!({
            "type":"auth","cert":cert,"server_token":claim,
            "signature": who.device.sign(server_id, nonce),
        }))
        .await;
    }

    async fn send(&mut self, v: Value) {
        match self {
            Conn::Ws(ws) => ws.send(Message::Text(v.to_string())).await.unwrap(),
            Conn::Rtc(c) => c.send(v.to_string()),
        }
    }

    async fn recv(&mut self) -> Option<Value> {
        match self {
            Conn::Ws(ws) => loop {
                match tokio::time::timeout(Duration::from_secs(5), ws.next()).await {
                    Ok(Some(Ok(Message::Text(t)))) => {
                        return Some(serde_json::from_str(&t).unwrap())
                    }
                    Ok(Some(Ok(_))) => continue,
                    _ => return None,
                }
            },
            Conn::Rtc(c) => match tokio::time::timeout(Duration::from_secs(5), c.rx.recv()).await {
                Ok(Some(t)) => Some(serde_json::from_str(&t).unwrap()),
                _ => None,
            },
        }
    }

    async fn recv_type(&mut self, ty: &str) -> Value {
        for _ in 0..50 {
            let v = self.recv().await.expect("connection closed early");
            if v["type"] == ty {
                return v;
            }
        }
        panic!("no {ty} message");
    }

    async fn output_contains(&mut self, needle: &str) -> bool {
        let mut seen = String::new();
        for _ in 0..100 {
            let Some(v) = self.recv().await else {
                return false;
            };
            if v["type"] == "output" {
                seen.push_str(&String::from_utf8_lossy(
                    &B64.decode(v["data"].as_str().unwrap()).unwrap(),
                ));
                if seen.contains(needle) {
                    return true;
                }
            }
        }
        false
    }
}

/// A WebRTC data-channel client built the way the browser builds it: from the server's IP, port and
/// pinned fingerprint only, with its own ICE ufrag/pwd set to one random string.
struct RtcClient {
    to_net: mpsc::UnboundedSender<String>,
    rx: mpsc::UnboundedReceiver<String>,
}

fn parse_fingerprint(s: &str) -> Fingerprint {
    let (func, hex) = s.split_once(' ').unwrap();
    Fingerprint {
        hash_func: func.into(),
        bytes: hex
            .split(':')
            .map(|b| u8::from_str_radix(b, 16).unwrap())
            .collect(),
    }
}

impl RtcClient {
    /// Resolves once the data channel is open, or errors after 5 s.
    async fn connect(info: &RtcInfo, pinned_fingerprint: &str) -> Result<RtcClient, String> {
        let socket = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let local = socket.local_addr().unwrap();
        let server = SocketAddr::new(info.ip, info.port);
        let ufrag: String = uuid::Uuid::new_v4().simple().to_string();

        let mut rtc = Rtc::builder().build(Instant::now());
        rtc.add_local_candidate(Candidate::host(local, "udp").unwrap());
        rtc.add_remote_candidate(Candidate::host(server, "udp").unwrap());
        let cid: ChannelId;
        {
            let mut d = rtc.direct_api();
            d.set_ice_controlling(true);
            d.set_local_ice_credentials(IceCreds {
                ufrag: ufrag.clone(),
                pass: ufrag.clone(),
            });
            d.set_remote_ice_credentials(IceCreds {
                ufrag: SERVER_UFRAG.into(),
                pass: SERVER_PWD.into(),
            });
            d.set_remote_fingerprint(parse_fingerprint(pinned_fingerprint));
            d.start_dtls(true).unwrap();
            d.start_sctp(true);
            cid = d.create_data_channel(ChannelConfig {
                label: "t".into(),
                negotiated: Some(CHANNEL_ID),
                ..Default::default()
            });
        }

        let (to_net, mut from_app) = mpsc::unbounded_channel::<String>();
        let (to_app, rx) = mpsc::unbounded_channel::<String>();
        let (open_tx, open_rx) = tokio::sync::oneshot::channel::<()>();
        let mut open_tx = Some(open_tx);
        tokio::spawn(async move {
            let mut buf = vec![0u8; 2000];
            let mut pending: Vec<String> = vec![];
            let mut open = false;
            loop {
                let mut next = Instant::now() + Duration::from_millis(100);
                loop {
                    if open {
                        if let Some(mut ch) = rtc.channel(cid) {
                            while let Some(m) = pending.first() {
                                if ch.write(false, m.as_bytes()).unwrap_or(false) {
                                    pending.remove(0);
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                    match rtc.poll_output() {
                        Ok(Output::Transmit(t)) => {
                            let _ = socket.send_to(&t.contents, t.destination).await;
                        }
                        Ok(Output::Timeout(t)) => {
                            next = next.min(t);
                            break;
                        }
                        Ok(Output::Event(Event::ChannelOpen(..))) => {
                            open = true;
                            if let Some(tx) = open_tx.take() {
                                let _ = tx.send(());
                            }
                        }
                        Ok(Output::Event(Event::ChannelData(d))) => {
                            let _ = to_app.send(String::from_utf8_lossy(&d.data).into_owned());
                        }
                        Ok(Output::Event(_)) => {}
                        Err(_) => return,
                    }
                }
                tokio::select! {
                    r = socket.recv_from(&mut buf) => {
                        if let Ok((n, source)) = r {
                            if let Ok(contents) = (&buf[..n]).try_into() {
                                let _ = rtc.handle_input(Input::Receive(Instant::now(), Receive {
                                    proto: Protocol::Udp, source, destination: local, contents,
                                }));
                            }
                        }
                    }
                    m = from_app.recv() => match m { Some(m) => pending.push(m), None => return },
                    _ = tokio::time::sleep_until(tokio::time::Instant::from_std(next)) => {}
                }
                let _ = rtc.handle_input(Input::Timeout(Instant::now()));
                if !rtc.is_alive() {
                    return;
                }
            }
        });

        match tokio::time::timeout(Duration::from_secs(5), open_rx).await {
            Ok(Ok(())) => Ok(RtcClient { to_net, rx }),
            _ => Err("data channel did not open".into()),
        }
    }

    fn send(&self, text: String) {
        let _ = self.to_net.send(text);
    }
}

// --- scenarios, each run over both transports ---------------------------------------------------

async fn only_the_claiming_github_user_gets_in(kind: Kind) {
    let f = fixture().await;
    let (alice, bob) = (f.who(1, "alice"), f.who(2, "bob"));

    // Unclaimed: no claim token, no entry.
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, "").await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("not registered"));

    // A certificate from an unknown signer is rejected.
    let mallory = Who {
        cert: Signer::new("k1").issue(&alice.device, 1, "alice", now() + 60),
        device: Device::new(),
    };
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &mallory, &f.claim).await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("invalid"));

    // Alice claims it.
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, &f.claim).await;
    let ok = c.recv_type("auth_ok").await;
    assert_eq!(
        (
            ok["user"].as_str().unwrap(),
            ok["server_name"].as_str().unwrap()
        ),
        ("alice", "test-vps")
    );

    // Bob cannot, even with the (now spent) claim token; Alice returns without it.
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &bob, &f.claim).await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("another GitHub user"));
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, "").await;
    c.recv_type("auth_ok").await;
}

async fn a_connection_for_another_server_expired_or_revoked_certificates_fail(kind: Kind) {
    let f = fixture().await;
    let alice = f.who(1, "alice");
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, &f.claim).await;
    c.recv_type("auth_ok").await;

    // A signature a rogue server collected for itself does not work here.
    let mut c = Conn::open(kind, &f).await;
    c.login_for("some-other-server", &alice, &alice.cert, "")
        .await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("sign in again"));

    // An expired certificate.
    let old = f.signer.issue(&alice.device, 1, "alice", now() - 5);
    let mut c = Conn::open(kind, &f).await;
    c.login_for(&f.server_id, &alice, &old, "").await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("expired"));

    // A certificate from a signer under an unknown kid.
    let unknown = Signer::new("unknown").issue(&alice.device, 1, "alice", now() + 60);
    let mut c = Conn::open(kind, &f).await;
    c.login_for(&f.server_id, &alice, &unknown, "").await;
    c.recv_type("error").await;

    // The old wire format, which carried a GitHub token, is not accepted.
    let mut c = Conn::open(kind, &f).await;
    c.send(json!({"type":"auth","token":"gho_secret","server_token":""}))
        .await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("Authenticate first"));

    // Revoking a device (as the owner, from another device) locks it out.
    let phone = f.who(1, "alice");
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &phone, "").await;
    c.recv_type("auth_ok").await;
    c.send(json!({"type":"revoke_device","device":phone.device.id()}))
        .await;
    c.recv_type("device_revoked").await;
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &phone, "").await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("revoked"));
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, "").await;
    c.recv_type("auth_ok").await;
    assert_eq!(f.auth.revoked_devices(), vec![phone.device.id()]);
}

async fn uninstall_needs_the_name_and_a_recent_login_then_wipes_the_config(kind: Kind) {
    let f = fixture().await;
    let alice = f.who(1, "alice");
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, &f.claim).await;
    c.recv_type("auth_ok").await;

    // Wrong name.
    c.send(json!({"type":"uninstall","confirm_name":"other"}))
        .await;
    let msg = c.recv_type("error").await;
    assert!(msg["message"].as_str().unwrap().contains("does not match"));

    // A certificate older than an hour, and one from before certificates carried an issue time.
    for iat in [Some(now() - 7200), None] {
        let cert = f
            .signer
            .issue_at(&alice.device, 1, "alice", now() + 3600, iat);
        let mut stale = Conn::open(kind, &f).await;
        stale.login_for(&f.server_id, &alice, &cert, "").await;
        stale.recv_type("auth_ok").await;
        stale
            .send(json!({"type":"uninstall","confirm_name":"test-vps"}))
            .await;
        let msg = stale.recv_type("error").await;
        assert!(
            msg["message"].as_str().unwrap().contains("Sign in again"),
            "{msg}"
        );
    }
    assert!(!f.stopped.load(std::sync::atomic::Ordering::SeqCst));
    assert!(f.dir.join("owner.json").exists());

    // Right name and a fresh certificate.
    c.send(json!({"type":"uninstall","confirm_name":"test-vps"}))
        .await;
    let done = c.recv_type("uninstall_done").await;
    assert_eq!(done["mode"], "container");
    let left: Vec<_> = std::fs::read_dir(&f.dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(left, vec!["uninstalled".to_string()]);
    assert!(f.stopped.load(std::sync::atomic::Ordering::SeqCst));
}

async fn nothing_is_served_before_auth(kind: Kind) {
    let f = fixture().await;
    let mut c = Conn::open(kind, &f).await;
    c.send(json!({"type":"list_sessions"})).await;
    assert!(c.recv_type("error").await["message"]
        .as_str()
        .unwrap()
        .contains("Authenticate first"));
}

async fn reconnect_resumes_the_tmux_session_with_its_screen(kind: Kind) {
    if std::process::Command::new("tmux")
        .arg("-V")
        .output()
        .is_err()
    {
        eprintln!("tmux not installed; skipping");
        return;
    }
    let f = fixture().await;
    let name = format!("e2e{}", &uuid::Uuid::new_v4().simple().to_string()[..8]);

    let alice = f.who(1, "alice");
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, &f.claim).await;
    c.recv_type("auth_ok").await;
    c.send(json!({"type":"new_session","name":name})).await;
    let sessions = c.recv_type("sessions").await;
    assert!(sessions["sessions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["id"] == name.as_str()));

    c.send(json!({"type":"attach","session_id":name})).await;
    c.recv_type("session_attached").await;
    c.send(json!({"type":"input","data":B64.encode("echo resume$((40+2))\n")}))
        .await;
    assert!(c.output_contains("resume42").await);

    // The network drops.
    drop(c);

    // The client reconnects without a claim token, lists, and re-attaches: the screen comes back.
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, "").await;
    c.recv_type("auth_ok").await;
    c.send(json!({"type":"attach","session_id":name})).await;
    c.recv_type("session_attached").await;
    assert!(
        c.output_contains("resume42").await,
        "earlier output is repainted"
    );

    let _ = std::process::Command::new("tmux")
        .args(["kill-session", "-t", &name])
        .output();
}

/// A session gets its event variables; what a tool writes to the socket reaches a connected client
/// sanitised and in order, and a client that connects later gets the snapshot and the missed events.
async fn agent_events_flow_from_a_session_tool_to_the_client(kind: Kind) {
    use tokio::io::AsyncWriteExt;
    if std::process::Command::new("tmux")
        .arg("-V")
        .output()
        .is_err()
    {
        eprintln!("tmux not installed; skipping");
        return;
    }
    let f = fixture().await;
    let name = format!("ev{}", &uuid::Uuid::new_v4().simple().to_string()[..8]);
    let alice = f.who(1, "alice");
    let mut c = Conn::open(kind, &f).await;
    c.login(&f, &alice, &f.claim).await;
    c.recv_type("auth_ok").await;
    c.send(json!({"type":"new_session","name":name})).await;
    c.recv_type("sessions").await;
    c.send(json!({"type":"attach","session_id":name})).await;
    c.recv_type("session_attached").await;
    c.send(json!({"type":"input","data":B64.encode("echo who:$TERMANCH_SESSION; test -S \"$TERMANCH_EVENT_SOCKET\" && echo sock:ok\n")})).await;
    assert!(
        c.output_contains(&format!("who:{name}")).await,
        "the session knows its name"
    );

    let send = |data: Value, token: String| {
        let line = json!({"session": name, "token": token, "adapter": "claude", "data": data})
            .to_string()
            + "\n";
        let sock = f.events_socket.clone();
        async move {
            let mut s = tokio::net::UnixStream::connect(sock).await.unwrap();
            s.write_all(line.as_bytes()).await.unwrap();
        }
    };
    send(
        json!({"hook_event_name": "UserPromptSubmit"}),
        "forged".into(),
    )
    .await;
    send(
        json!({"hook_event_name": "UserPromptSubmit"}),
        f.hub.token(&name),
    )
    .await;
    send(
        json!({"hook_event_name": "PreToolUse", "tool_name": "Bash",
               "tool_input": {"command": "curl -H \"Authorization: Bearer hunter2hunter2\" 10.1.2.3:8080\nrm -rf /"}}),
        f.hub.token(&name),
    )
    .await;

    let mut seen = Vec::new();
    for _ in 0..50 {
        let v = c.recv().await.expect("closed");
        if v["type"] == "agent_events" {
            seen.extend(v["events"].as_array().unwrap().clone());
        }
        if seen.len() >= 2 {
            break;
        }
    }
    let wire = serde_json::to_string(&seen).unwrap();
    assert_eq!(seen[0]["kind"], "state");
    assert_eq!(seen[0]["state"], "working");
    assert_eq!(
        seen[0]["seq"], 1,
        "the forged event was refused and consumed no seq"
    );
    assert_eq!(seen[1]["kind"], "tool");
    for leaked in ["hunter2", "10.1.2.3", "\\n", "\\u001b"] {
        assert!(!wire.contains(leaked), "{leaked} leaked: {wire}");
    }

    // A client that connects later: snapshot first, then what it missed.
    let mut d = Conn::open(kind, &f).await;
    d.login(&f, &alice, "").await;
    d.recv_type("auth_ok").await;
    d.send(json!({"type":"agent_sync","after":{name.clone(): 1}}))
        .await;
    let snap = d.recv_type("agent_snapshot").await;
    assert_eq!(snap["states"][0]["session"], name.as_str());
    assert_eq!(snap["states"][0]["state"], "working");
    assert_eq!(snap["states"][0]["seq"], 2);
    assert_eq!(snap["states"][0]["stale"], false);
    let missed = d.recv_type("agent_events").await;
    assert_eq!(
        missed["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["seq"].as_u64().unwrap())
            .collect::<Vec<_>>(),
        [2]
    );

    let _ = std::process::Command::new("tmux")
        .args(["kill-session", "-t", &name])
        .output();
}

macro_rules! over_both_transports {
    ($($name:ident),*) => {$(
        mod $name {
            #[tokio::test] async fn ws() { super::$name(super::Kind::Ws).await }
            #[tokio::test] async fn rtc() { super::$name(super::Kind::Rtc).await }
        }
    )*};
}

over_both_transports!(
    only_the_claiming_github_user_gets_in,
    a_connection_for_another_server_expired_or_revoked_certificates_fail,
    uninstall_needs_the_name_and_a_recent_login_then_wipes_the_config,
    nothing_is_served_before_auth,
    reconnect_resumes_the_tmux_session_with_its_screen,
    agent_events_flow_from_a_session_tool_to_the_client
);

// --- WebRTC-specific ----------------------------------------------------------------------------

#[tokio::test]
async fn a_client_that_pins_the_wrong_fingerprint_never_connects() {
    let f = fixture().await;
    let wrong = format!("sha-256 {}", vec!["AB"; 32].join(":"));
    assert!(RtcClient::connect(&f.rtc, &wrong).await.is_err());
}

#[tokio::test]
async fn garbage_and_foreign_stun_create_no_peers_and_the_server_stays_up() {
    let f = fixture().await;
    let sock = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let server = SocketAddr::new(f.rtc.ip, f.rtc.port);
    for payload in [&b"hello"[..], &[0u8; 64][..], &[0xffu8; 1500][..]] {
        sock.send_to(payload, server).await.unwrap();
    }
    // A real client still connects afterwards.
    let mut c = Conn::open(Kind::Rtc, &f).await;
    c.send(json!({"type":"list_sessions"})).await;
    c.recv_type("error").await;
}

#[tokio::test]
async fn half_open_flood_is_capped_and_real_clients_still_get_in() {
    let f = fixture().await;
    let server = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), f.rtc.port);
    // 200 distinct sources (ports) from one IP: at most `max_per_ip` can become peers.
    let mut socks = vec![];
    for i in 0..200u32 {
        let s = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let u = format!("{}:{:016x}{:016x}", SERVER_UFRAG, i, i);
        let mut attr = vec![0, 6, 0, u.len() as u8];
        attr.extend_from_slice(u.as_bytes());
        attr.extend(std::iter::repeat(0).take((4 - u.len() % 4) % 4));
        let mut m = vec![
            0,
            1,
            (attr.len() >> 8) as u8,
            attr.len() as u8,
            0x21,
            0x12,
            0xA4,
            0x42,
        ];
        m.extend([9u8; 12]);
        m.extend(attr);
        s.send_to(&m, server).await.unwrap();
        socks.push(s);
    }
    // The flood came from 127.0.0.1, which is also where the test client lives, so the per-IP cap
    // applies to it as well; after the half-open peers expire it must get in again.
    tokio::time::sleep(Duration::from_secs(11)).await;
    let mut c = Conn::open(Kind::Rtc, &f).await;
    c.send(json!({"type":"list_sessions"})).await;
    c.recv_type("error").await;
}
