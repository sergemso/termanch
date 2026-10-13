import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { ServerHub, serverKey, type HubConnection } from './hub';
import type { ConnectionOptions } from './connection';
import type { ClientMessage, ServerListItem, ServerMessage } from './protocol';

const server = (id: string): ServerListItem => ({ server_id: id, server_url: '', server_name: id, registered_at: 0 });
class Fake implements HubConnection {
  started = 0;
  closed = 0;
  sent: ClientMessage[] = [];
  listener?: (m: ServerMessage) => void;
  constructor(readonly opts: ConnectionOptions) {}
  start() { this.started++; this.opts.onState('connecting'); }
  close() { this.closed++; this.opts.onState('closed'); }
  send(m: ClientMessage) { this.sent.push(m); }
  subscribe(fn: (m: ServerMessage) => void) { this.listener = fn; return () => { this.listener = undefined; }; }
  ready(reconnect = false) { this.opts.onState('connected'); this.opts.onReady({ type: 'auth_ok', user: 'u', server_name: 'host', backends: ['tmux'] }, reconnect); }
  emit(m: ServerMessage) { this.listener?.(m); }
}
function setup() {
  const connections: Fake[] = [];
  const ready: boolean[] = [];
  const hub = new ServerHub({ credentials: async () => ({ cert: 'c', sign: async () => 's' }), onReady: (_id, _msg, reconnect) => ready.push(reconnect), factory: (opts) => {
    const c = new Fake(opts); connections.push(c); return c;
  } });
  return { hub, connections, ready };
}

describe('ServerHub', () => {
  it('starts every saved server once, even if start or add is repeated', () => {
    const { hub, connections } = setup();
    hub.start([server('a'), server('b')]); hub.start([server('a'), server('b')]); hub.add(server('a'));
    expect(connections.map(c => c.started)).toEqual([1, 1]);
    expect(get(hub.servers).map(s => s.state)).toEqual(['connecting', 'connecting']);
  });
  it('pauses only that server, hides its sessions, and resumes with a fresh connection', () => {
    const { hub, connections } = setup(); hub.start([server('a'), server('b')]);
    connections[0].emit({ type: 'sessions', sessions: [{ id: 'x', name: 'x', agent: null }] });
    hub.pause('a');
    expect(connections.map(c => c.closed)).toEqual([1, 0]);
    expect(get(hub.servers)[0].state).toBe('paused');
    expect(get(hub.allSessions)).toEqual([]);
    hub.retry('a'); expect(connections).toHaveLength(2); // Retry does not override Pause
    hub.resume('a'); expect(connections).toHaveLength(3);
  });
  it('a drop leaves other connections and the dropped server’s last sessions intact, with a reason and Retry', () => {
    const { hub, connections } = setup(); hub.start([server('a'), server('b')]); connections.forEach(c => c.ready());
    connections[0].emit({ type: 'sessions', sessions: [{ id: 'x', name: 'x', agent: null }] });
    connections[0].opts.onDrop?.('no reply', 1000); connections[0].opts.onState('reconnecting');
    expect(get(hub.servers)[0]).toMatchObject({ state: 'reconnecting', reason: 'no reply' });
    expect(get(hub.servers)[1].state).toBe('connected'); expect(get(hub.allSessions)).toHaveLength(1);
    hub.retry('a'); expect(connections[1].closed).toBe(0); expect(connections[2].started).toBe(1);
    connections[0].opts.onState('unreachable', 'late callback');
    expect(get(hub.servers)[0].state).toBe('connecting');
  });
  it('warns above six connected servers without dropping any, including a late addition', () => {
    const { hub, connections } = setup(); hub.start(Array.from({ length: 7 }, (_, i) => server(String(i))));
    connections.forEach(c => c.ready());
    expect(get(hub.connectedCount)).toBe(7); expect(get(hub.overLimit)).toBe(true);
    hub.add(server('8')); connections[7].ready();
    expect(get(hub.connectedCount)).toBe(8); expect(connections.every(c => !c.closed)).toBe(true);
    hub.pause('8'); hub.pause('6'); expect(get(hub.overLimit)).toBe(false);
  });
  it('isolates session ids, agents, sync cursors and replies across servers', () => {
    const { hub, connections } = setup(); hub.start([server('a'), server('b')]); connections.forEach(c => c.ready());
    for (const [i, c] of connections.entries()) {
      c.emit({ type: 'sessions', sessions: [{ id: 'tmux:one', name: 'one', agent: null }] });
      c.emit({ type: 'agent_snapshot', states: [{ session: 'tmux:one', state: i ? 'working' : 'needs_input', seq: i + 1, stale: false, ts: 1000 }] });
    }
    expect(get(hub.allSessions).map(s => s.key)).toEqual(['a/tmux:one', 'b/tmux:one']);
    expect(get(hub.agents)['a/tmux:one'].state).toBe('needs_input');
    expect(get(hub.agents)['b/tmux:one'].state).toBe('working');
    connections[0].ready(true);
    expect(connections[0].sent.at(-1)).toEqual({ type: 'agent_sync', after: { 'tmux:one': 1 } });
    hub.sendToSession('b/tmux:one', { type: 'reply', session: 'b/tmux:one', text: 'continue' });
    expect(connections[1].sent.at(-1)).toEqual({ type: 'reply', session: 'tmux:one', text: 'continue' });
    expect(connections[0].sent.some(m => m.type === 'reply')).toBe(false);
  });
  it('removes only the chosen server and its agent data, and closes every connection on shutdown', () => {
    const { hub, connections } = setup(); hub.start([server('a'), server('b')]);
    hub.remove('a'); expect(get(hub.servers).map(s => s.id)).toEqual(['b']);
    hub.close(); expect(connections.map(c => c.closed)).toEqual([1, 1]); expect(get(hub.agents)).toEqual({});
  });
  it('uses the URL as a stable identity for manually saved servers', () => {
    expect(serverKey({ ...server('a'), server_id: undefined, server_url: 'wss://host/ws' })).toBe('wss://host/ws');
  });
  it('marks readiness after Retry and Resume as a reconnect so the active session can reattach', () => {
    const { hub, connections, ready } = setup(); hub.start([server('a')]); connections[0].ready();
    hub.retry('a'); connections[1].ready();
    hub.pause('a'); hub.resume('a'); connections[2].ready();
    expect(ready).toEqual([false, true, true]);
  });
});
