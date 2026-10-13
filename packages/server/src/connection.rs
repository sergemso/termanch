use std::time::Duration;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use termanch_core::protocol::{ClientMessage, ServerMessage};

use crate::link::Link;
use crate::AppState;

const AUTH_TIMEOUT: Duration = Duration::from_secs(10);

/// The next message within the auth window; `None` on timeout, close, or unparseable input.
async fn next(link: &mut Link) -> Option<ClientMessage> {
    let text = tokio::time::timeout(AUTH_TIMEOUT, link.rx.recv())
        .await
        .ok()??;
    serde_json::from_str(&text).ok()
}

async fn send(link: &Link, msg: &ServerMessage) -> bool {
    link.tx.send(serde_json::to_string(msg).unwrap()).await
}

/// One client connection from first byte to last, on any transport.
/// Browsers cannot set headers on a WebSocket and a data channel has none, so the handshake is in-band:
/// `hello`, a `challenge` carrying a fresh nonce and this server's id, then `auth` with the device
/// certificate and a signature over the challenge. Nothing else is read until that checks out and the
/// user owns this server. Returning drops the link, which makes the transport close the connection.
pub async fn run(mut link: Link, state: AppState) {
    if !matches!(next(&mut link).await, Some(ClientMessage::Hello)) {
        send(
            &link,
            &ServerMessage::Error {
                message: "Authenticate first".into(),
            },
        )
        .await;
        return;
    }
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let nonce = URL_SAFE_NO_PAD.encode(bytes);
    let challenge = ServerMessage::Challenge {
        nonce: nonce.clone(),
        server_id: state.auth.server_id().to_string(),
    };
    if !send(&link, &challenge).await {
        return;
    }
    let (cert, signature, claim) = match next(&mut link).await {
        Some(ClientMessage::Auth {
            cert,
            signature,
            server_token,
        }) => (
            cert,
            signature,
            Some(server_token).filter(|t| !t.is_empty()),
        ),
        Some(_) => {
            send(
                &link,
                &ServerMessage::Error {
                    message: "Authenticate first".into(),
                },
            )
            .await;
            return;
        }
        None => return,
    };

    let identity = match state.auth.check(
        &cert,
        &signature,
        &nonce,
        claim.as_deref(),
        link.peer_ip.as_deref(),
    ) {
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
        mode: state.mode.clone(),
        version: crate::version(),
        backends: state.sessions.backends(),
    };
    if !send(&link, &ok).await {
        return;
    }

    if let Err(e) = state.sessions.serve(link, identity, &state.auth).await {
        tracing::error!("Session error: {e}");
    }
}
