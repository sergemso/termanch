<script lang="ts">
  import AppShell from '../src/AppShell.svelte';
  import NavigationBar from '../src/NavigationBar.svelte';
  import MenuSheet from '../src/MenuSheet.svelte';
  import SessionActions from '../src/SessionActions.svelte';
  import { ServerHub, type HubConnection } from '../src/lib/hub';
  import type { ConnectionOptions } from '../src/lib/connection';
  import type { ServerMessage, SessionInfo } from '../src/lib/protocol';

  const peers = new Map<string, Fake>();
  class Fake implements HubConnection {
    listener?: (m: ServerMessage) => void;
    list: SessionInfo[] = Array.from({ length: 4 }, (_, i) => ({ id: `session-${i}`, name: `session-${i}`, agent: null }));
    opts: ConnectionOptions;
    constructor(opts: ConnectionOptions) { this.opts = opts; }
    start() {
      this.opts.onState('connected'); this.opts.onReady({ type: 'auth_ok', user: 'test', server_name: this.opts.serverId! }, false);
      this.emit({ type: 'sessions', sessions: this.list });
      this.emit({ type: 'agent_snapshot', states: this.list.map((s, i) => ({ session: s.id, state: i === 1 ? 'needs_input' : 'working', seq: 1, ts: Date.now(), stale: false, agent: 'claude', last_response_at: Date.now() - (i + 1) * 60000 })) });
    }
    close() { this.opts.onState('closed'); }
    send() {}
    subscribe(fn: (m: ServerMessage) => void) { this.listener = fn; return () => { this.listener = undefined; }; }
    emit(m: ServerMessage) { this.listener?.(m); }
  }
  const hub = new ServerHub({ credentials: async () => ({ cert: '', sign: async () => '' }), factory: opts => { const peer = new Fake(opts); peers.set(opts.serverId!, peer); return peer; } });
  hub.start(['alpha', 'beta', 'gamma'].map(id => ({ server_id: id, server_name: id, server_url: '', registered_at: 0 })));
  const sessions = hub.allSessions, agents = hub.agents, servers = hub.servers;
  let activeKey = 'gamma/session-3';
  let menu = false;
  let actions: string | null = null;
  let sheet = false;
  $: actionSession = $sessions.find(s => s.key === actions);
  Object.assign(window, { __navigation: {
    active: () => activeKey,
    select: (key: string) => activeKey = key,
    change: () => {
      const peer = peers.get('alpha')!;
      peer.list = [...peer.list.filter(s => s.id !== 'session-0'), { id: 'new', name: 'new', agent: null }];
      peer.emit({ type: 'sessions', sessions: peer.list });
    },
    degrade: () => peers.get('beta')!.opts.onState('unreachable', 'Test server offline'),
  } });
</script>
<AppShell pinned>
  <NavigationBar sessions={$sessions} agents={$agents} servers={$servers} {activeKey} held={!!actions} onopen={key => activeKey = key} onactions={key => actions = key} onmenu={() => menu = true} onsessions={() => sheet = !sheet} />
  <main><p>{activeKey}</p>{#if sheet}<p>Session sheet</p>{/if}</main>
  {#if menu}<MenuSheet user="test" onservers={() => {}} onreport={() => {}} onlogout={() => {}} onclose={() => menu = false} />{/if}
  {#if actionSession}<SessionActions session={actionSession} onclose={() => actions = null} />{/if}
</AppShell>
<style>main { flex: 1; min-height: 0; }</style>
