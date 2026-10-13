export type ClientMessage =
  | { type: 'hello' }
  | { type: 'auth'; cert: string; signature: string; server_token: string }
  | { type: 'revoke_device'; device: string }
  | { type: 'uninstall'; confirm_name: string; delete_user?: boolean; remove_tmux?: boolean; kill_sessions?: boolean }
  | { type: 'agent_sync'; after: Record<string, number> }
  | { type: 'peek'; session: string; hash?: string }
  | { type: 'answer'; session: string; prompt_id: string; seq: number; choice: number }
  | { type: 'reply'; session: string; text: string }
  | { type: 'list_sessions' }
  | { type: 'new_session'; name: string; backend?: string }
  | { type: 'ping' }
  | { type: 'attach'; session_id: string }
  | { type: 'detach' }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

export type ServerMessage =
  | { type: 'challenge'; nonce: string; server_id: string }
  | { type: 'device_revoked'; device: string }
  | { type: 'uninstall_done'; mode: string }
  | { type: 'auth_ok'; user: string; server_name: string; mode?: string; version?: string; backends?: string[] }
  | { type: 'sessions'; sessions: SessionInfo[] }
  | { type: 'session_attached'; session_id: string }
  | { type: 'output'; data: string }
  | { type: 'snapshot'; session: string; text: string; hash: string; unchanged?: boolean }
  | { type: 'agent_snapshot'; states: SessionAgentState[] }
  | { type: 'agent_events'; events: AgentEvent[] }
  | { type: 'agent_event'; event: AgentEventType; agent: string; session_id: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export interface SessionInfo {
  id: string;
  name: string;
  agent: 'herdr' | 'tmux' | 'codex' | null;
  /** The session manager it lives in; set when the server runs more than one (`tmux`, `herdr`). */
  backend?: string;
}

export type AgentState = 'idle' | 'working' | 'needs_input' | 'done' | 'error' | 'unknown';

export interface SessionAgentState {
  session: string;
  state: AgentState;
  seq: number;
  stale: boolean;
  ts: number;
  /** The agent in the session (`claude`, `codex`, `herdr`); absent for a plain shell and from older servers. */
  agent?: string;
  /** When the agent last answered (ms since the epoch); absent until it has. */
  last_response_at?: number;
  /** Start of the continuous human wait; absent on older servers. */
  waiting_since?: number;
}

/** Plan v6: `seq` and `ts` come from the server; unknown `kind`s and extra fields are ignored. */
export type AgentEvent = { session: string; seq: number; ts: number; source: string; confidence: string } & (
  | { kind: 'state'; state: AgentState }
  | { kind: 'tool'; name: string; summary: string; phase: 'started' | 'finished' }
  | { kind: 'plan'; items: { text: string; status: string }[] }
  | { kind: 'prompt'; id: string; prompt_kind: string; choices: string[] }
  | { kind: 'message'; summary: string }
  | { kind: string }
);

/** Legacy message of the parked termanch-agent. */
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
