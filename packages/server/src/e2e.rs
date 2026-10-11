//! Whole-server tests: a real WebSocket client against the router, a mock GitHub, and real tmux.
use std::sync::Arc;
use std::time::Duration;

use axum::{http::HeaderMap, routing::get, Json, Router};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::auth::{AuthState, Identity};
use crate::sessions::SessionManager;
use crate::{router, AppState};

type Ws =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

async fn serve(app: Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("127.0.0.1:{}", addr.port())
}

/// Tokens "alice" and "bob" are valid GitHub users 1 and 2.
async fn mock_github() -> String {
    async fn user(headers: HeaderMap) -> Result<Json<Identity>, axum::http::StatusCode> {
        match headers.get("authorization").and_then(|v| v.to_str().ok()) {
            Some("Bearer alice") => Ok(Json(Identity {
                id: 1,
                login: "alice".into(),
            })),
            Some("Bearer bob") => Ok(Json(Identity {
                id: 2,
                login: "bob".into(),
            })),
            _ => Err(axum::http::StatusCode::UNAUTHORIZED),
        }
    }
    format!(
        "http://{}",
        serve(Router::new().route("/user", get(user))).await
    )
}

struct Fixture {
    addr: String,
    claim: String,
}

async fn fixture() -> Fixture {
    let dir = std::env::temp_dir().join(format!("termanch-e2e-{}", uuid::Uuid::new_v4()));
    let auth = Arc::new(AuthState::with_api(dir, mock_github().await).unwrap());
    let claim = auth.claim_token().unwrap().unwrap();
    let state = AppState {
        auth,
        sessions: Arc::new(SessionManager::new()),
        server_name: "test-vps".into(),
    };
    Fixture {
        addr: serve(router(state)).await,
        claim,
    }
}

async fn connect(addr: &str) -> Ws {
    connect_async(format!("ws://{addr}/ws")).await.unwrap().0
}

async fn send(ws: &mut Ws, v: Value) {
    ws.send(Message::Text(v.to_string())).await.unwrap();
}

async fn recv(ws: &mut Ws) -> Option<Value> {
    loop {
        match tokio::time::timeout(Duration::from_secs(5), ws.next()).await {
            Ok(Some(Ok(Message::Text(t)))) => return Some(serde_json::from_str(&t).unwrap()),
            Ok(Some(Ok(_))) => continue,
            _ => return None,
        }
    }
}

async fn recv_type(ws: &mut Ws, ty: &str) -> Value {
    for _ in 0..50 {
        let v = recv(ws).await.expect("connection closed early");
        if v["type"] == ty {
            return v;
        }
    }
    panic!("no {ty} message");
}

async fn output_contains(ws: &mut Ws, needle: &str) -> bool {
    let mut seen = String::new();
    for _ in 0..100 {
        let Some(v) = recv(ws).await else {
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

#[tokio::test]
async fn only_the_claiming_github_user_gets_in() {
    let f = fixture().await;

    // Unclaimed: no claim token, no entry.
    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"alice","server_token":""}),
    )
    .await;
    assert!(recv_type(&mut ws, "error").await["message"]
        .as_str()
        .unwrap()
        .contains("not registered"));

    // A bad GitHub token is rejected.
    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"mallory","server_token":f.claim}),
    )
    .await;
    assert!(recv_type(&mut ws, "error").await["message"]
        .as_str()
        .unwrap()
        .contains("invalid"));

    // Alice claims it.
    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"alice","server_token":f.claim}),
    )
    .await;
    let ok = recv_type(&mut ws, "auth_ok").await;
    assert_eq!(
        (
            ok["user"].as_str().unwrap(),
            ok["server_name"].as_str().unwrap()
        ),
        ("alice", "test-vps")
    );

    // Bob cannot, even with the (now spent) claim token; Alice returns without it.
    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"bob","server_token":f.claim}),
    )
    .await;
    assert!(recv_type(&mut ws, "error").await["message"]
        .as_str()
        .unwrap()
        .contains("another GitHub user"));
    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"alice","server_token":""}),
    )
    .await;
    recv_type(&mut ws, "auth_ok").await;
}

#[tokio::test]
async fn nothing_is_served_before_auth() {
    let f = fixture().await;
    let mut ws = connect(&f.addr).await;
    send(&mut ws, json!({"type":"list_sessions"})).await;
    assert!(recv_type(&mut ws, "error").await["message"]
        .as_str()
        .unwrap()
        .contains("Authenticate first"));
}

#[tokio::test]
async fn reconnect_resumes_the_tmux_session_with_its_screen() {
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

    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"alice","server_token":f.claim}),
    )
    .await;
    recv_type(&mut ws, "auth_ok").await;
    send(&mut ws, json!({"type":"new_session","name":name})).await;
    let sessions = recv_type(&mut ws, "sessions").await;
    assert!(sessions["sessions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["id"] == name.as_str()));

    send(&mut ws, json!({"type":"attach","session_id":name})).await;
    recv_type(&mut ws, "session_attached").await;
    send(
        &mut ws,
        json!({"type":"input","data":B64.encode("echo resume$((40+2))\n")}),
    )
    .await;
    assert!(output_contains(&mut ws, "resume42").await);

    // The network drops.
    drop(ws);

    // The client reconnects without a claim token, lists, and re-attaches: the screen comes back.
    let mut ws = connect(&f.addr).await;
    send(
        &mut ws,
        json!({"type":"auth","token":"alice","server_token":""}),
    )
    .await;
    recv_type(&mut ws, "auth_ok").await;
    send(&mut ws, json!({"type":"attach","session_id":name})).await;
    recv_type(&mut ws, "session_attached").await;
    assert!(
        output_contains(&mut ws, "resume42").await,
        "earlier output is repainted"
    );

    let _ = std::process::Command::new("tmux")
        .args(["kill-session", "-t", &name])
        .output();
}
