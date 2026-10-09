use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State,
    },
    response::IntoResponse,
};
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use termanch_core::protocol::{ClientMessage, ServerMessage, SessionInfo};

#[derive(Clone)]
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    agent_tx: mpsc::UnboundedSender<AgentCommand>,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub agent: Option<String>,
    pub pty_tx: Option<mpsc::UnboundedSender<Vec<u8>>>,
    pub created_at: u64,
    pub last_activity: u64,
}

#[derive(Debug)]
pub enum AgentCommand {
    ListSessions {
        respond_to: mpsc::UnboundedSender<Vec<SessionInfo>>,
    },
    CreateSession {
        name: String,
        respond_to: mpsc::UnboundedSender<Result<Session>>,
    },
    AttachSession {
        session_id: String,
        pty_tx: mpsc::UnboundedSender<Vec<u8>>,
        respond_to: mpsc::UnboundedSender<Result<()>>,
    },
    SendInput {
        session_id: String,
        data: Vec<u8>,
    },
    ResizeSession {
        session_id: String,
        cols: u16,
        rows: u16,
    },
    CloseSession {
        session_id: String,
    },
}

impl SessionManager {
    pub fn new() -> Self {
        let (agent_tx, mut agent_rx) = mpsc::unbounded_channel();
        let sessions = Arc::new(RwLock::new(HashMap::<String, Session>::new()));

        let sessions_clone = sessions.clone();
        tokio::spawn(async move {
            while let Some(cmd) = agent_rx.recv().await {
                match cmd {
                    AgentCommand::ListSessions { respond_to } => {
                        let sessions = sessions_clone.read().await;
                        let infos: Vec<SessionInfo> = sessions
                            .values()
                            .map(|s| SessionInfo {
                                id: s.id.clone(),
                                name: s.name.clone(),
                                agent: s.agent.clone(),
                            })
                            .collect();
                        let _ = respond_to.send(infos);
                    }
                    AgentCommand::CreateSession { name, respond_to } => {
                        let mut sessions = sessions_clone.write().await;
                        let id = Uuid::new_v4().to_string();
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs();
                        let session = Session {
                            id: id.clone(),
                            name: name.clone(),
                            agent: None,
                            pty_tx: None,
                            created_at: now,
                            last_activity: now,
                        };
                        sessions.insert(id.clone(), session.clone());
                        let _ = respond_to.send(Ok(session));
                    }
                    AgentCommand::AttachSession {
                        session_id,
                        pty_tx,
                        respond_to,
                    } => {
                        let mut sessions = sessions_clone.write().await;
                        if let Some(session) = sessions.get_mut(&session_id) {
                            session.pty_tx = Some(pty_tx);
                            session.last_activity = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_secs();
                            let _ = respond_to.send(Ok(()));
                        } else {
                            let _ = respond_to.send(Err(anyhow::anyhow!("Session not found")));
                        }
                    }
                    AgentCommand::SendInput { session_id, data } => {
                        let sessions = sessions_clone.read().await;
                        if let Some(session) = sessions.get(&session_id) {
                            if let Some(tx) = &session.pty_tx {
                                let _ = tx.send(data);
                            }
                        }
                    }
                    AgentCommand::ResizeSession {
                        session_id,
                        cols,
                        rows,
                    } => {
                        let sessions = sessions_clone.read().await;
                        if let Some(session) = sessions.get(&session_id) {
                            if let Some(tx) = &session.pty_tx {
                                let resize_data = format!("\x1b[8;{};{}t", rows, cols).into_bytes();
                                let _ = tx.send(resize_data);
                            }
                        }
                    }
                    AgentCommand::CloseSession { session_id } => {
                        let mut sessions = sessions_clone.write().await;
                        sessions.remove(&session_id);
                    }
                }
            }
        });

        Self { sessions, agent_tx }
    }

    pub async fn list_sessions(&self) -> Vec<SessionInfo> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let _ = self
            .agent_tx
            .send(AgentCommand::ListSessions { respond_to: tx });
        rx.recv().await.unwrap_or_default()
    }

    pub async fn create_session(&self, name: String) -> Result<Session> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let _ = self.agent_tx.send(AgentCommand::CreateSession {
            name,
            respond_to: tx,
        });
        rx.recv()
            .await
            .unwrap_or_else(|| Err(anyhow::anyhow!("Failed to create session")))
    }

    pub async fn attach_session(
        &self,
        session_id: String,
        pty_tx: mpsc::UnboundedSender<Vec<u8>>,
    ) -> Result<()> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let _ = self.agent_tx.send(AgentCommand::AttachSession {
            session_id,
            pty_tx,
            respond_to: tx,
        });
        rx.recv()
            .await
            .unwrap_or_else(|| Err(anyhow::anyhow!("Failed to attach session")))
    }

    pub async fn send_input(&self, session_id: String, data: Vec<u8>) {
        let _ = self
            .agent_tx
            .send(AgentCommand::SendInput { session_id, data });
    }

    pub async fn resize_session(&self, session_id: String, cols: u16, rows: u16) {
        let _ = self.agent_tx.send(AgentCommand::ResizeSession {
            session_id,
            cols,
            rows,
        });
    }

    pub async fn close_session(&self, session_id: String) {
        let _ = self
            .agent_tx
            .send(AgentCommand::CloseSession { session_id });
    }

    pub async fn handle_websocket(
        &self,
        mut socket: WebSocket,
        claims: crate::auth::Claims,
    ) -> Result<()> {
        let mut current_session: Option<String> = None;
        let (pty_tx, mut pty_rx) = mpsc::unbounded_channel::<Vec<u8>>();

        loop {
            tokio::select! {
                msg = socket.recv() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            debug!("Received WS message: {}", text);
                            if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                                match self.handle_client_message(client_msg, &mut current_session, &pty_tx, &mut socket, &claims).await {
                                    Ok(should_break) => {
                                        if should_break { break; }
                                    }
                                    Err(e) => {
                                        error!("Error handling message: {}", e);
                                        let _ = socket.send(Message::Text(serde_json::to_string(&ServerMessage::Error {
                                            message: e.to_string(),
                                        }).unwrap())).await;
                                    }
                                }
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Some(session_id) = &current_session {
                                self.send_input(session_id.clone(), data.to_vec()).await;
                            }
                        }
                        Some(Ok(Message::Ping(_))) => {
                            // Respond with Pong automatically handled by axum
                        }
                        Some(Ok(Message::Pong(_))) => {
                            // Ignore Pong
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("WebSocket closed");
                            break;
                        }
                        Some(Err(e)) => {
                            error!("WebSocket error: {}", e);
                            break;
                        }
                        None => break,
                    }
                }
                data = pty_rx.recv() => {
                    if let Some(output) = data {
                        let encoded = base64::encode(&output);
                        let msg = ServerMessage::Output { data: encoded };
                        if socket.send(Message::Text(serde_json::to_string(&msg).unwrap())).await.is_err() {
                            break;
                        }
                    }
                }
            }
        }

        if let Some(session_id) = current_session {
            self.close_session(session_id).await;
        }

        Ok(())
    }

    async fn handle_client_message(
        &self,
        msg: ClientMessage,
        current_session: &mut Option<String>,
        pty_tx: &mpsc::UnboundedSender<Vec<u8>>,
        socket: &mut WebSocket,
        claims: &crate::auth::Claims,
    ) -> Result<bool> {
        match msg {
            ClientMessage::Auth {
                token: _,
                server_token: _,
            } => {
                let resp = ServerMessage::AuthOk {
                    user: claims.username.clone(),
                    server_name: "termanch-server".to_string(),
                };
                socket
                    .send(Message::Text(serde_json::to_string(&resp).unwrap()))
                    .await?;
            }
            ClientMessage::ListSessions => {
                let sessions = self.list_sessions().await;
                let resp = ServerMessage::Sessions { sessions };
                socket
                    .send(Message::Text(serde_json::to_string(&resp).unwrap()))
                    .await?;
            }
            ClientMessage::Attach { session_id } => {
                self.attach_session(session_id.clone(), pty_tx.clone())
                    .await?;
                *current_session = Some(session_id.clone());
                let resp = ServerMessage::SessionAttached { session_id };
                socket
                    .send(Message::Text(serde_json::to_string(&resp).unwrap()))
                    .await?;
            }
            ClientMessage::Input { data } => {
                if let Some(session_id) = current_session {
                    let decoded = base64::decode(&data)?;
                    self.send_input(session_id.clone(), decoded).await;
                }
            }
            ClientMessage::Resize { cols, rows } => {
                if let Some(session_id) = current_session {
                    self.resize_session(session_id.clone(), cols, rows).await;
                }
            }
        }
        Ok(false)
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
