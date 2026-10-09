# MVP-02: Shared Protocol Types

**Owner**: Core Dev | **Duration**: 1 day | **Depends on**: mvp-01

## Goal
Minimal JSON-serializable types for WebSocket protocol + HTTP registration (no postcard, no WASM).

## Do
1. **`packages/core/Cargo.toml`**
   ```toml
   [package]
   name = "termanch-core"
   version = "0.1.0"
   edition = "2021"

   [dependencies]
   serde = { version = "1.0", features = ["derive"] }
   serde_json = "1.0"
   thiserror = "1.0"
   ```

2. **`packages/core/src/protocol.rs`** — Define MVP message types:
   ```rust
   use serde::{Deserialize, Serialize};

   // Client → Server (WebSocket)
   #[derive(Serialize, Deserialize, Debug, Clone)]
   #[serde(tag = "type")]
   pub enum ClientMessage {
       Auth { token: String, server_token: String },
       ListSessions,
       Attach { session_id: String },
       Input { data: String },  // base64 encoded
       Resize { cols: u16, rows: u16 },
   }

   // Server → Client (WebSocket)
   #[derive(Serialize, Deserialize, Debug, Clone)]
   #[serde(tag = "type")]
   pub enum ServerMessage {
       AuthOk { user: String, server_name: String },
       Sessions { sessions: Vec<SessionInfo> },
       SessionAttached { session_id: String },
       Output { data: String },  // base64 encoded
       AgentEvent { event: AgentEventType, agent: String, session_id: String },
       Error { message: String },
   }

   #[derive(Serialize, Deserialize, Debug, Clone)]
   pub struct SessionInfo {
       pub id: String,
       pub name: String,
       pub agent: Option<String>, // "herdr" | "tmux" | "codex" | null
   }

   #[derive(Serialize, Deserialize, Debug, Clone)]
   #[serde(rename_all = "snake_case")]
   pub enum AgentEventType {
       Spawned,
       Completed,
       Error,
   }

   // Registration (HTTP POST /register)
   #[derive(Serialize, Deserialize, Debug, Clone)]
   pub struct RegisterRequest {
       pub token: String,
   }

   #[derive(Serialize, Deserialize, Debug, Clone)]
   pub struct RegisterResponse {
       pub server_url: String,   // wss://<tunnel>.trycloudflare.com/ws
       pub server_name: String,  // user-defined or hostname
   }
   ```

3. **`packages/core/src/lib.rs`** — Re-export protocol

4. **Unit tests**: Serialize/deserialize round-trip for each type

5. **TS types**: Manual `packages/client/src/protocol.ts` mirror (no codegen for MVP):
   ```typescript
   export type ClientMessage =
     | { type: 'auth'; token: string; server_token: string }
     | { type: 'list_sessions' }
     | { type: 'attach'; session_id: string }
     | { type: 'input'; data: string }
     | { type: 'resize'; cols: number; rows: number };

   export type ServerMessage =
     | { type: 'auth_ok'; user: string; server_name: string }
     | { type: 'sessions'; sessions: SessionInfo[] }
     | { type: 'session_attached'; session_id: string }
     | { type: 'output'; data: string }
     | { type: 'agent_event'; event: AgentEventType; agent: string; session_id: string }
     | { type: 'error'; message: string };

   export interface SessionInfo {
     id: string;
     name: string;
     agent: 'herdr' | 'tmux' | 'codex' | null;
   }

   export type AgentEventType = 'spawned' | 'completed' | 'error';

   export interface RegisterRequest {
     token: string;
   }

   export interface RegisterResponse {
     server_url: string;
     server_name: string;
   }
   ```

## Check
```bash
cargo test -p termanch-core
# TS types importable in client
```