use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State,
    },
    http::HeaderMap,
};
use tracing::{error, info};

use termanch_core::protocol::{ClientMessage, ServerMessage};

const AUTH_TIMEOUT: Duration = Duration::from_secs(10);

async fn send(socket: &mut WebSocket, msg: &ServerMessage) -> bool {
    socket
        .send(Message::Text(serde_json::to_string(msg).unwrap()))
        .await
        .is_ok()
}

/// Tell the client why, then close properly. Dropping the socket right after the error would reset
/// the connection and the browser could lose the message.
async fn reject(socket: &mut WebSocket, message: &str) {
    let _ = send(
        socket,
        &ServerMessage::Error {
            message: message.into(),
        },
    )
    .await;
    let _ = socket.send(Message::Close(None)).await;
    let _ = tokio::time::timeout(Duration::from_secs(1), socket.recv()).await;
}

/// Browsers cannot set headers on a WebSocket, so the first message must be `auth`.
/// Nothing else is read until GitHub has vouched for the token and the user owns this server.
pub async fn handle_websocket(
    mut socket: WebSocket,
    State(state): State<crate::AppState>,
    headers: HeaderMap,
) {
    let first = tokio::time::timeout(AUTH_TIMEOUT, socket.recv()).await;
    let (token, claim) = match first {
        Ok(Some(Ok(Message::Text(text)))) => match serde_json::from_str::<ClientMessage>(&text) {
            Ok(ClientMessage::Auth {
                token,
                server_token,
            }) => (token, Some(server_token).filter(|t| !t.is_empty())),
            _ => {
                reject(&mut socket, "Authenticate first").await;
                return;
            }
        },
        _ => return,
    };

    // Behind the Cloudflare tunnel the peer address is the tunnel; the real client is in this header.
    let ip = headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok());

    let identity = match state.auth.check(&token, claim.as_deref(), ip).await {
        Ok(i) => i,
        Err(e) => {
            reject(&mut socket, e.message()).await;
            return;
        }
    };

    info!("WebSocket authenticated for {}", identity.login);
    let ok = ServerMessage::AuthOk {
        user: identity.login.clone(),
        server_name: state.server_name.clone(),
    };
    if !send(&mut socket, &ok).await {
        return;
    }

    if let Err(e) = state.sessions.handle_websocket(socket, identity).await {
        error!("WebSocket error: {}", e);
    }
}
