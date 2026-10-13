use serde::{Deserialize, Serialize};
use std::fmt::Display;

/// Client → Server (WebSocket)
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Opens the handshake; the server answers with a `challenge`.
    Hello,
    /// Device certificate plus a signature over the challenge (DECISION-0062); no GitHub token.
    Auth {
        cert: String,
        signature: String,
        server_token: String,
    },
    /// Owner-only: refuse this device key from now on.
    RevokeDevice {
        device: String,
    },
    /// Owner-only, recently signed in: remove this server (decision 0072). `confirm_name` must equal the
    /// server's name; the flags choose the optional host cleanup (all off by default).
    Uninstall {
        confirm_name: String,
        #[serde(default)]
        delete_user: bool,
        #[serde(default)]
        remove_tmux: bool,
        #[serde(default)]
        kill_sessions: bool,
    },
    /// Asks for the agent state of every session and for the events after `after[session]` (plan v6, P.6).
    AgentSync {
        #[serde(default)]
        after: std::collections::HashMap<String, u64>,
    },
    /// A one-tap answer to a prompt the user saw: accepted only while that prompt (`prompt_id` at event `seq`) is
    /// still the session's current one, reliable (hook-confirmed) and still on the pane (plan v8, K.4).
    Answer {
        session: String,
        prompt_id: String,
        seq: u64,
        choice: u8,
    },
    /// Types a short reply into a session's pane without attaching to it (plan v8, K.5).
    Reply {
        session: String,
        text: String,
    },
    ListSessions,
    NewSession {
        name: String,
        /// Which session manager to create it in (`tmux`, `herdr`); the first one when absent.
        #[serde(default)]
        backend: Option<String>,
    },
    Ping,
    Attach {
        session_id: String,
    },
    Input {
        data: String,
    },
    Resize {
        cols: u16,
        rows: u16,
    },
}

/// Server → Client (WebSocket)
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Fresh per connection; the device signs it together with the `server_id`.
    Challenge {
        nonce: String,
        server_id: String,
    },
    DeviceRevoked {
        device: String,
    },
    /// The server wiped its configuration and will stop; `mode` is `container` or `host:<user>`.
    UninstallDone {
        mode: String,
    },
    AuthOk {
        user: String,
        server_name: String,
        /// `container` or `host:<user>`; absent from older servers.
        #[serde(default)]
        mode: String,
        /// Server version and build (`0.1.0+abc1234`); absent from older servers.
        #[serde(default)]
        version: String,
        /// Session managers this server offers; more than one means "New session" asks which.
        #[serde(default)]
        backends: Vec<String>,
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
    /// Latest agent state per session; answers `agent_sync`.
    AgentSnapshot {
        states: Vec<crate::events::SessionAgentState>,
    },
    /// New agent events, in `seq` order per session. A gap in `seq` means the client should `agent_sync`.
    AgentEvents {
        events: Vec<crate::events::AgentEvent>,
    },
    /// Legacy message of the parked termanch-agent.
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
    /// The session manager it lives in (`tmux`, `herdr`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backend: Option<String>,
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
            mode: "container".into(),
            version: "0.1.0+dev".into(),
            backends: vec!["tmux".into()],
        })
        .unwrap();
        assert_eq!(v["type"], "auth_ok");
        let v = serde_json::to_value(ClientMessage::AgentSync {
            after: [("a".to_string(), 4u64)].into(),
        })
        .unwrap();
        assert_eq!(v["type"], "agent_sync");
        assert_eq!(v["after"]["a"], 4);
        let v = serde_json::to_value(ClientMessage::Answer {
            session: "s".into(),
            prompt_id: "1-ab".into(),
            seq: 3,
            choice: 1,
        })
        .unwrap();
        assert_eq!(v["type"], "answer");
        assert_eq!(v["choice"], 1);
        let v = serde_json::to_value(ServerMessage::AgentSnapshot { states: vec![] }).unwrap();
        assert_eq!(v["type"], "agent_snapshot");
        let v = serde_json::to_value(ServerMessage::AgentEvents { events: vec![] }).unwrap();
        assert_eq!(v["type"], "agent_events");
        let v = serde_json::to_value(ServerMessage::SessionAttached {
            session_id: "x".into(),
        })
        .unwrap();
        assert_eq!(v["type"], "session_attached");
        let v = serde_json::to_value(ClientMessage::NewSession {
            name: "n".into(),
            backend: None,
        })
        .unwrap();
        assert_eq!(v["type"], "new_session");
        let v = serde_json::to_value(ClientMessage::Hello).unwrap();
        assert_eq!(v["type"], "hello");
        let v = serde_json::to_value(ServerMessage::Challenge {
            nonce: "n".into(),
            server_id: "s".into(),
        })
        .unwrap();
        assert_eq!(v["type"], "challenge");
        let v = serde_json::to_value(ClientMessage::RevokeDevice { device: "d".into() }).unwrap();
        assert_eq!(v["type"], "revoke_device");
        let v: ClientMessage =
            serde_json::from_str(r#"{"type":"uninstall","confirm_name":"vps"}"#).unwrap();
        assert_eq!(
            v,
            ClientMessage::Uninstall {
                confirm_name: "vps".into(),
                delete_user: false,
                remove_tmux: false,
                kill_sessions: false
            }
        );
        let v = serde_json::to_value(ServerMessage::UninstallDone {
            mode: "container".into(),
        })
        .unwrap();
        assert_eq!(v["type"], "uninstall_done");
    }

    #[test]
    fn test_client_message_roundtrip() {
        let msg = ClientMessage::Auth {
            cert: "cert".into(),
            signature: "sig".into(),
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
                backend: None,
            }],
        };
        let json = serde_json::to_string(&msg).unwrap();
        let parsed: ServerMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, parsed);
    }
}
