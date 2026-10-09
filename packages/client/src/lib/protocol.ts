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

export interface ServerListItem {
  server_url: string;
  server_name: string;
  registered_at: number;
}