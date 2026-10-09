use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, State,
    },
    response::Response,
};
use tracing::{error, info};

use crate::auth::Claims;
use crate::sessions::SessionManager;

pub async fn handle_websocket(
    socket: WebSocket,
    State(sessions): State<std::sync::Arc<SessionManager>>,
    Extension(claims): Extension<Claims>,
) {
    info!("New WebSocket connection for user: {}", claims.username);

    if let Err(e) = sessions.handle_websocket(socket, claims).await {
        error!("WebSocket error: {}", e);
    }
}
