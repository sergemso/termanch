export type ClientMessage =
  | { type: 'auth'; token: string; server_token: string }
  | { type: 'list_sessions' }
  | { type: 'new_session'; name: string }
  | { type: 'ping' }
  | { type: 'attach'; session_id: string }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

export type ServerMessage =
  | { type: 'auth_ok'; user: string; server_name: string }
  | { type: 'sessions'; sessions: SessionInfo[] }
  | { type: 'session_attached'; session_id: string }
  | { type: 'output'; data: string }
  | { type: 'agent_event'; event: AgentEventType; agent: string; session_id: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export interface SessionInfo {
  id: string;
  name: string;
  agent: 'herdr' | 'tmux' | 'codex' | null;
}

export type AgentEventType = 'spawned' | 'completed' | 'error';

export interface ServerListItem {
  /** Tunnel (WebSocket) fallback or manually entered address; optional once a directory record exists. */
  server_url: string;
  /** Pinned Ed25519 public key of the server (base64url); the directory is trusted only through it. */
  server_id?: string;
  /** Last verified directory record, tried first before asking the directory again. */
  record?: import('./directory').DirRecord;
  server_name: string;
  registered_at: number;
  /** One-time claim token from the registration link; dropped after the first successful connect. */
  claim?: string;
}