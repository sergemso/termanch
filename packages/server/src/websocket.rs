use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use tracing::{error, info};

use crate::auth::Claims;
use crate::sessions::SessionManager;

pub async fn handle_websocket(
    socket: WebSocket,
    State(state): State<crate::AppState>,
    headers: axum::http::HeaderMap,
) {
    // Extract claims from JWT in headers
    let claims = match crate::auth::verify_token(&state.auth, &headers) {
        Ok(c) => c,
        Err(_) => {
            error!("Invalid auth");
            return;
        }
    };

    info!("New WebSocket connection for user: {}", claims.username);

    if let Err(e) = state.sessions.handle_websocket(socket, claims).await {
        error!("WebSocket error: {}", e);
    }
}
