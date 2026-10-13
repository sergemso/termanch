// The agent event store (plan v6, P.6): the latest state per session, kept up to date from the server's
// snapshot and event stream. No UI here (cards are v8). Text in events is untrusted: render it as text only.
import { get, writable } from 'svelte/store';
import type { AgentEvent, AgentState, ClientMessage, ServerMessage, SessionAgentState } from './protocol';

export interface SessionAgent {
  state: AgentState;
  seq: number;
  /** The agent in the session, when the server's scan found one. */
  agent?: string;
  /** When the agent last answered (ms): the server's value, advanced by `done` and `message` events as they arrive. */
  lastResponseAt?: number;
  /** Start of the continuous needs-input/error wait; activity does not advance it. */
  waitingSince?: number;
  /** As the server saw it at the snapshot; use `isStale` for the live answer. */
  stale: boolean;
  /** Server time (ms) of the last event. */
  ts: number;
  tool?: { name: string; summary: string; phase: string };
  /** `seq` and `confidence` are the prompt event's: a one-tap answer carries the seq and needs `high`. */
  prompt?: { id: string; kind: string; choices: string[]; seq: number; confidence: string };
  /** The last tool events, oldest first (capped). */
  timeline?: { name: string; summary: string; phase: string; ts: number }[];
  plan?: { text: string; status: string }[];
  message?: string;
}

export type AgentMap = Record<string, SessionAgent>;

const waiting = (state: AgentState) => state === 'needs_input' || state === 'error';

export const STALE_AFTER_MS = 60_000;
export const TIMELINE_CAP = 10;

export const agents = writable<AgentMap>({});

/** The latest state is `working` but nothing has been heard for a minute: it may be out of date. */
export function isStale(a: SessionAgent, nowMs: number, skewMs = 0): boolean {
  return a.state === 'working' && (a.stale || nowMs + skewMs - a.ts > STALE_AFTER_MS);
}

/** A snapshot replaces what we know about a session's state but keeps the details we already have. */
export function applySnapshot(map: AgentMap, states: SessionAgentState[]): AgentMap {
  const next: AgentMap = {};
  for (const s of states) {
    const old = map[s.session];
    // A lower seq than ours means the server restarted its counters: what we hold is from before, drop it.
    const keep = old && old.seq <= s.seq ? old : {};
    next[s.session] = { ...keep, state: s.state, seq: s.seq, stale: s.stale, ts: s.ts, agent: s.agent, lastResponseAt: s.last_response_at,
      waitingSince: waiting(s.state) ? s.waiting_since ?? (old && old.seq <= s.seq && waiting(old.state) ? old.waitingSince ?? old.ts : s.ts) : undefined };
  }
  return next;
}

/** Applies events in order. `gap` is true when a `seq` was skipped: ask the server for a new snapshot. */
export function applyEvents(map: AgentMap, events: AgentEvent[]): { map: AgentMap; gap: boolean } {
  let gap = false;
  const next: AgentMap = { ...map };
  for (const e of events) {
    const cur = next[e.session];
    if (cur && e.seq <= cur.seq) continue; // already seen
    if (e.seq !== (cur ? cur.seq + 1 : 1)) gap = true;
    const a: SessionAgent = { ...(cur ?? { state: 'unknown' as AgentState }), seq: e.seq, ts: e.ts, stale: false } as SessionAgent;
    const ev = e as Record<string, unknown>;
    switch (e.kind) {
      case 'state':
        a.waitingSince = waiting(ev.state as AgentState) ? (waiting(a.state) ? a.waitingSince ?? cur?.ts ?? e.ts : e.ts) : undefined;
        if (ev.state === 'done' || (a.state === 'working' && (ev.state === 'idle' || ev.state === 'needs_input'))) a.lastResponseAt = e.ts;
        a.state = ev.state as AgentState;
        if (a.state !== 'needs_input') delete a.prompt;
        break;
      case 'tool':
        a.tool = { name: String(ev.name ?? ''), summary: String(ev.summary ?? ''), phase: String(ev.phase ?? '') };
        a.timeline = [...(a.timeline ?? []), { ...a.tool, ts: e.ts }].slice(-TIMELINE_CAP);
        break;
      case 'prompt':
        a.prompt = { id: String(ev.id ?? ''), kind: String(ev.prompt_kind ?? ''), choices: Array.isArray(ev.choices) ? ev.choices.map(String) : [], seq: e.seq, confidence: e.confidence };
        break;
      case 'plan':
        a.plan = Array.isArray(ev.items) ? ev.items.map((i: { text?: unknown; status?: unknown }) => ({ text: String(i.text ?? ''), status: String(i.status ?? '') })) : [];
        break;
      case 'message':
        a.message = String(ev.summary ?? '');
        a.lastResponseAt = e.ts;
        break;
      default:
        break; // a kind this client does not know
    }
    next[e.session] = a;
  }
  return { map: next, gap };
}

/** What to send in `agent_sync`: the last `seq` seen per session. */
export function syncRequest(map: AgentMap): Record<string, number> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.seq]));
}

export function resetAgents() {
  agents.set({});
}

/** Feeds the store from the server's messages. Returns false for any other message (an old client simply never calls this). */
export function handleAgentMessage(msg: ServerMessage, send: (m: ClientMessage) => void): boolean {
  if (msg.type === 'agent_snapshot') {
    agents.update((m) => applySnapshot(m, msg.states));
    return true;
  }
  if (msg.type === 'agent_events') {
    const r = applyEvents(get(agents), msg.events);
    agents.set(r.map);
    // A skipped seq: take a fresh snapshot instead of guessing what was missed.
    if (r.gap) send({ type: 'agent_sync', after: syncRequest(r.map) });
    return true;
  }
  return false;
}

export function requestAgentSync(send: (m: ClientMessage) => void) {
  send({ type: 'agent_sync', after: syncRequest(get(agents)) });
}
