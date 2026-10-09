use serde::{Deserialize, Serialize};

/// Client → Server (WebSocket)
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum ClientMessage {
    Auth { token: String, server_token: String },
    ListSessions,
    Attach { session_id: String },
    Input { data: String },
    Resize { cols: u16, rows: u16 },
}

/// Server → Client (WebSocket)
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub agent: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum AgentEventType {
    Spawned,
    Completed,
    Error,
}

/// Registration (HTTP POST /register)
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisterRequest {
    pub token: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisterResponse {
    pub server_url: String,
    pub server_name: String,
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn test_register_roundtrip() {
        let req = RegisterRequest {
            token: "abc".into(),
        };
        let json = serde_json::to_string(&req).unwrap();
        let parsed: RegisterRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req, parsed);
    }
}
