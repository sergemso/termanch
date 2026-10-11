use std::time::Duration;

use termanch_core::protocol::{ClientMessage, ServerMessage};

use crate::link::Link;
use crate::AppState;

const AUTH_TIMEOUT: Duration = Duration::from_secs(10);

async fn send(link: &Link, msg: &ServerMessage) -> bool {
    link.tx.send(serde_json::to_string(msg).unwrap()).await
}

/// One client connection from first byte to last, on any transport.
/// Browsers cannot set headers on a WebSocket and a data channel has none, so the first message
/// must be `auth`; nothing else is read until GitHub has vouched for the token and the user owns
/// this server. Returning drops the link, which makes the transport close the connection.
pub async fn run(mut link: Link, state: AppState) {
    let first = tokio::time::timeout(AUTH_TIMEOUT, link.rx.recv()).await;
    let (token, claim) = match first {
        Ok(Some(text)) => match serde_json::from_str::<ClientMessage>(&text) {
            Ok(ClientMessage::Auth {
                token,
                server_token,
            }) => (token, Some(server_token).filter(|t| !t.is_empty())),
            _ => {
                send(
                    &link,
                    &ServerMessage::Error {
                        message: "Authenticate first".into(),
                    },
                )
                .await;
                return;
            }
        },
        _ => return,
    };

    let identity = match state
        .auth
        .check(&token, claim.as_deref(), link.peer_ip.as_deref())
        .await
    {
        Ok(i) => i,
        Err(e) => {
            send(
                &link,
                &ServerMessage::Error {
                    message: e.message().into(),
                },
            )
            .await;
            return;
        }
    };

    tracing::info!("Authenticated {}", identity.login);
    let ok = ServerMessage::AuthOk {
        user: identity.login.clone(),
        server_name: state.server_name.clone(),
    };
    if !send(&link, &ok).await {
        return;
    }

    if let Err(e) = state.sessions.serve(link, identity).await {
        tracing::error!("Session error: {e}");
    }
}
