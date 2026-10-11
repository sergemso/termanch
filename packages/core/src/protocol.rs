use serde::{Deserialize, Serialize};
use std::fmt::Display;

/// Client → Server (WebSocket)
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Auth { token: String, server_token: String },
    ListSessions,
    NewSession { name: String },
    Ping,
    Attach { session_id: String },
    Input { data: String },
    Resize { cols: u16, rows: u16 },
}

/// Server → Client (WebSocket)
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    AuthOk {
        user: String,
        server_name: String,
    },
    Sessions {
        sessions: Vec<SessionInfo>,
    },
    SessionAttached {
        session_id: String,
    },
    Output {
        data: String,
    },
    AgentEvent {
        event: AgentEventType,
        agent: String,
        session_id: String,
    },
    Error {
        message: String,
    },
    Pong,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub agent: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentEventType {
    Spawned,
    Completed,
    Error,
}

impl Display for AgentEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentEventType::Spawned => write!(f, "spawned"),
            AgentEventType::Completed => write!(f, "completed"),
            AgentEventType::Error => write!(f, "error"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The browser client speaks these exact strings (packages/client/src/lib/protocol.ts).
    #[test]
    fn test_wire_names_match_the_client() {
        let v = serde_json::to_value(ClientMessage::ListSessions).unwrap();
        assert_eq!(v["type"], "list_sessions");
        let v = serde_json::to_value(ServerMessage::AuthOk {
            user: "u".into(),
            server_name: "s".into(),
        })
        .unwrap();
        assert_eq!(v["type"], "auth_ok");
        let v = serde_json::to_value(ServerMessage::SessionAttached {
            session_id: "x".into(),
        })
        .unwrap();
        assert_eq!(v["type"], "session_attached");
        let v = serde_json::to_value(ClientMessage::NewSession { name: "n".into() }).unwrap();
        assert_eq!(v["type"], "new_session");
    }

    #[test]
    fn test_client_message_roundtrip() {
        let msg = ClientMessage::Auth {
            token: "test".into(),
            server_token: "server".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let parsed: ClientMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, parsed);
    }

    #[test]
    fn test_server_message_roundtrip() {
        let msg = ServerMessage::Sessions {
            sessions: vec![SessionInfo {
                id: "1".into(),
                name: "main".into(),
                agent: Some("tmux".into()),
            }],
        };
        let json = serde_json::to_string(&msg).unwrap();
        let parsed: ServerMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, parsed);
    }
}
