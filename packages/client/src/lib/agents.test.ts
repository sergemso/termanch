import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { agents, applyEvents, applySnapshot, handleAgentMessage, isStale, resetAgents, syncRequest, type AgentMap } from './agents';
import type { AgentEvent, ClientMessage, ServerMessage } from './protocol';

const ev = (seq: number, rest: object, session = 's'): AgentEvent => ({ session, seq, ts: 1000 + seq, source: 'hook', confidence: 'high', ...rest }) as AgentEvent;

describe('agent events', () => {
  it('follows state, tool, prompt and message events in order', () => {
    const r = applyEvents({}, [
      ev(1, { kind: 'state', state: 'working' }),
      ev(2, { kind: 'tool', name: 'Bash', summary: 'ls', phase: 'started' }),
      ev(3, { kind: 'state', state: 'needs_input' }),
      ev(4, { kind: 'prompt', id: 'p1', prompt_kind: 'yes_no', choices: ['yes', 'no'] }),
    ]);
    expect(r.gap).toBe(false);
    expect(r.map.s.state).toBe('needs_input');
    expect(r.map.s.tool?.name).toBe('Bash');
    expect(r.map.s.prompt?.choices).toEqual(['yes', 'no']);
    const done = applyEvents(r.map, [ev(5, { kind: 'state', state: 'done' }), ev(6, { kind: 'message', summary: 'ok' })]);
    expect(done.map.s.prompt).toBeUndefined();
    expect(done.map.s.message).toBe('ok');
  });

  it('ignores kinds and fields it does not know', () => {
    const r = applyEvents({}, [ev(1, { kind: 'hologram', x: 1 }), ev(2, { kind: 'state', state: 'working', extra: true })]);
    expect(r.map.s.state).toBe('working');
    expect(r.gap).toBe(false); // an unknown kind still uses its seq
  });

  it('skips duplicates and flags a gap in seq', () => {
    const base = applyEvents({}, [ev(1, { kind: 'state', state: 'idle' })]).map;
    expect(applyEvents(base, [ev(1, { kind: 'state', state: 'working' })]).map.s.state).toBe('idle');
    const r = applyEvents(base, [ev(3, { kind: 'state', state: 'working' })]);
    expect(r.gap).toBe(true);
  });

  it('recovers from a gap with a snapshot and asks only for what is newer', () => {
    let map: AgentMap = applyEvents({}, [ev(1, { kind: 'state', state: 'idle' })]).map;
    expect(syncRequest(map)).toEqual({ s: 1 });
    map = applySnapshot(map, [{ session: 's', state: 'working', seq: 7, stale: false, ts: 9000 }, { session: 't', state: 'idle', seq: 2, stale: false, ts: 1 }]);
    expect(map.s.seq).toBe(7);
    expect(map.s.state).toBe('working');
    expect(applyEvents(map, [ev(8, { kind: 'state', state: 'done' })]).gap).toBe(false);
  });

  it('drops sessions the snapshot no longer lists and survives a server counter reset', () => {
    const map = applyEvents({}, [ev(1, { kind: 'state', state: 'idle' }), ev(1, { kind: 'state', state: 'idle' }, 'gone')]).map;
    const snap = applySnapshot(map, [{ session: 's', state: 'idle', seq: 1, stale: false, ts: 1 }]);
    expect(Object.keys(snap)).toEqual(['s']);
    const restarted = applySnapshot({ s: { ...map.s, seq: 40 } }, [{ session: 's', state: 'working', seq: 2, stale: false, ts: 5 }]);
    expect(restarted.s.seq).toBe(2);
    expect(restarted.s.state).toBe('working');
  });

  it('calls working stale after a minute without news', () => {
    const a = { state: 'working' as const, seq: 1, stale: false, ts: 1000 };
    expect(isStale(a, 30_000)).toBe(false);
    expect(isStale(a, 62_000)).toBe(true);
    expect(isStale({ ...a, state: 'idle' }, 999_999)).toBe(false);
  });
});

describe('the message handler', () => {
  it('feeds the store, requests a sync on a gap and leaves every other message alone', () => {
    resetAgents();
    const sent: ClientMessage[] = [];
    const send = (m: ClientMessage) => sent.push(m);
    expect(handleAgentMessage({ type: 'agent_snapshot', states: [{ session: 's', state: 'idle', seq: 4, stale: false, ts: 1 }] }, send)).toBe(true);
    expect(get(agents).s.seq).toBe(4);
    handleAgentMessage({ type: 'agent_events', events: [ev(5, { kind: 'state', state: 'working' })] }, send);
    expect(sent).toEqual([]);
    handleAgentMessage({ type: 'agent_events', events: [ev(9, { kind: 'state', state: 'done' })] }, send);
    expect(sent).toEqual([{ type: 'agent_sync', after: { s: 9 } }]);
    expect(handleAgentMessage({ type: 'pong' } as ServerMessage, send)).toBe(false);
    expect(handleAgentMessage({ type: 'from_the_future' } as unknown as ServerMessage, send)).toBe(false);
  });
});
