<script lang="ts">
  import AppShell from '../src/AppShell.svelte';
  import NavigationBar from '../src/NavigationBar.svelte';
  import MenuSheet from '../src/MenuSheet.svelte';
  import SessionActions from '../src/SessionActions.svelte';
  import SessionSheet from '../src/SessionSheet.svelte';
  import KeyRow from '../src/KeyRow.svelte';
  import type { SheetHeight } from '../src/lib/sheet';
  import { onMount } from 'svelte';
  import { ServerHub, type HubConnection } from '../src/lib/hub';
  import type { ConnectionOptions } from '../src/lib/connection';
  import type { ClientMessage, ServerMessage, SessionInfo } from '../src/lib/protocol';

  const peers = new Map<string, Fake>();
  const messages: { server: string; message: ClientMessage }[] = [];
  class Fake implements HubConnection {
    listener?: (m: ServerMessage) => void;
    list: SessionInfo[] = Array.from({ length: 4 }, (_, i) => ({ id: `session-${i}`, name: `session-${i}`, agent: null }));
    opts: ConnectionOptions;
    constructor(opts: ConnectionOptions) { this.opts = opts; }
    start() {
      this.opts.onState('connected'); this.opts.onReady({ type: 'auth_ok', user: 'test', server_name: this.opts.serverId! }, false);
      this.emit({ type: 'sessions', sessions: this.list });
      this.emit({ type: 'agent_snapshot', states: this.list.map((s, i) => ({ session: s.id, state: i === 1 ? 'needs_input' : i === 0 ? 'idle' : 'working', seq: 1, ts: Date.now(), stale: false, agent: 'claude', last_response_at: Date.now() - (i + 1) * 60000 })) });
      this.emit({ type: 'agent_events', events: [{ session: 'session-1', seq: 2, ts: Date.now(), source: 'hook', confidence: 'high', kind: 'prompt', id: `prompt-${this.opts.serverId}`, prompt_kind: 'choice', choices: ['Yes', 'No'] }] });
    }
    close() { this.opts.onState('closed'); }
    send(message: ClientMessage) { messages.push({ server: this.opts.serverId!, message }); }
    subscribe(fn: (m: ServerMessage) => void) { this.listener = fn; return () => { this.listener = undefined; }; }
    emit(m: ServerMessage) { this.listener?.(m); }
  }
  const hub = new ServerHub({ credentials: async () => ({ cert: '', sign: async () => '' }), factory: opts => { const peer = new Fake(opts); peers.set(opts.serverId!, peer); return peer; } });
  hub.start(['alpha', 'beta', 'gamma'].map(id => ({ server_id: id, server_name: id, server_url: '', registered_at: 0 })));
  const sessions = hub.allSessions, agents = hub.agents, servers = hub.servers;
  let activeKey = 'gamma/session-3';
  let menu = false;
  let actions: string | null = null;
  let height: SheetHeight = 'peek';
  let mobile = true;
  let expanded = false;
  let sheetHeld = false;
  let mods = { ctrl: false, alt: false };
  onMount(() => {
    const mq = matchMedia('(max-width: 720px)'); const media = () => mobile = mq.matches; media(); mq.addEventListener('change', media);
    return () => mq.removeEventListener('change', media);
  });
  $: actionSession = $sessions.find(s => s.key === actions);
  Object.assign(window, { __navigation: {
    active: () => activeKey,
    sent: () => messages,
    changePrompt: () => peers.get('alpha')!.emit({ type: 'agent_events', events: [{ session: 'session-1', seq: 3, ts: Date.now(), source: 'hook', confidence: 'high', kind: 'prompt', id: 'changed-alpha', prompt_kind: 'choice', choices: ['Different'] }] }),
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
  <NavigationBar sessions={$sessions} agents={$agents} servers={$servers} {activeKey} held={!!actions || expanded || sheetHeld} onopen={key => { activeKey = key; height = 'peek'; }} onactions={key => actions = key} onmenu={() => menu = true} onsessions={() => height = height === 'peek' ? 'half' : 'peek'} />
  <main class:mobile>
    <div class="terminal"><p>{activeKey}</p><div class="screen"></div><KeyRow bind:mods onkey={() => {}} onpaste={() => {}} oncopy={() => {}} /></div>
    <SessionSheet sessions={$sessions} agents={$agents} servers={$servers} {activeKey} {mobile} bind:height held={!!actions} onexpanded={value => expanded = value} onheld={value => sheetHeld = value} onopen={key => { activeKey = key; height = 'peek'; }} onnew={() => {}} onrefresh={() => {}} onretry={id => hub.retry(id)} send={m => { if ('session' in m) hub.sendToSession(m.session, m); }} />
  </main>
  {#if menu}<MenuSheet user="test" onservers={() => {}} onreport={() => {}} onlogout={() => {}} onclose={() => menu = false} />{/if}
  {#if actionSession}<SessionActions session={actionSession} onclose={() => actions = null} />{/if}
</AppShell>
<style>main { display: flex; flex: 1; min-height: 0; overflow: hidden; } main.mobile { flex-direction: column; } .terminal { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; overflow: hidden; } .screen { flex: 1; min-height: 0; }</style>
