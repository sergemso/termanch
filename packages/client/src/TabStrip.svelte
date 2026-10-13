<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { FrozenOrder, chipFor } from './lib/cards';
  import { needsYou, tabIds, tabLabel } from './lib/tabs';
  import type { AgentMap } from './lib/agents';
  import type { HubSession, HubServer } from './lib/hub';

  export let sessions: HubSession[] = [];
  export let agents: AgentMap = {};
  export let servers: HubServer[] = [];
  export let activeKey: string | null = null;
  export let held = false;
  export let onopen: (key: string) => void;
  export let onactions: (key: string) => void;

  const frozen = new FrozenOrder();
  let now = Date.now();
  let revision = 0;
  let shown: HubSession[] = [];
  let live = new Set<string>();
  let strip: HTMLDivElement;
  let visibleActive: string | null = null;
  let press: { pointerId: number; key: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let longPressed: string | null = null;
  let left = false;
  let right = false;

  let wasHeld = false;
  $: if (held !== wasHeld) { frozen.sheet(held); wasHeld = held; revision++; }
  $: {
    revision;
    const order = frozen.order(tabIds(sessions, agents), {}, now);
    // A tab opened during a hold still gets a tab; a removed one stays in place (disabled) until the hold ends.
    if (activeKey && !order.includes(activeKey) && sessions.some(s => s.key === activeKey)) order.push(activeKey);
    live = new Set(sessions.map(s => s.key));
    const known = new Map([...shown, ...sessions].map(s => [s.key, s]));
    shown = order.map(key => known.get(key)).filter((s): s is HubSession => !!s);
  }
  $: if (strip && activeKey && activeKey !== visibleActive && !frozen.frozen(now)) scrollActive(activeKey, shown);

  async function scrollActive(key: string, _shown: HubSession[]) {
    await tick();
    if (key !== activeKey || frozen.frozen(Date.now())) return;
    const tab = [...strip.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(el => el.dataset.key === key);
    if (!tab) return;
    const a = tab.getBoundingClientRect(), b = strip.getBoundingClientRect();
    if (a.left < b.left) strip.scrollLeft -= b.left - a.left;
    else if (a.right > b.right) strip.scrollLeft += a.right - b.right;
    visibleActive = key;
    edges();
  }
  function edges() { if (strip) { left = strip.scrollLeft > 1; right = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1; } }
  function down(e: PointerEvent, key: string) {
    frozen.touchDown(e.pointerId); revision++;
    cancelPress();
    longPressed = null;
    press = { pointerId: e.pointerId, key, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      longPressed = key; onactions(key); press = null;
    }, 550) };
  }
  function cancelPress() { if (press) clearTimeout(press.timer); press = null; }
  function move(e: PointerEvent) { if (press && press.pointerId === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelPress(); }
  function up(e: PointerEvent) {
    if (!frozen.hasPointer(e.pointerId)) return;
    if (press?.pointerId === e.pointerId) cancelPress();
    if (e.type === 'pointercancel') longPressed = null;
    // Click follows pointerup: keep the target stable through that click.
    setTimeout(() => { frozen.touchUp(e.pointerId); revision++; }, 0);
  }
  onMount(() => {
    const timer = setInterval(() => { now = Date.now(); edges(); }, 250);
    const observer = new ResizeObserver(() => { visibleActive = null; now = Date.now(); edges(); }); observer.observe(strip); edges();
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { clearInterval(timer); observer.disconnect(); cancelPress(); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });
</script>

<div class="tabs" class:left class:right>
  <div class="strip" bind:this={strip} role="tablist" aria-label="Sessions across servers" on:scroll={() => { frozen.scrolled(Date.now()); cancelPress(); edges(); }}>
    {#each shown as session (session.key)}
      {@const agent = agents[session.key]}
      {@const chip = agent ? chipFor(agent, now) : { icon: '·', label: 'No status' }}
      {@const server = servers.find(s => s.id === session.serverId)}
      <button type="button" role="tab" data-key={session.key} aria-selected={activeKey === session.key}
        aria-label={`${tabLabel(session, agent, servers.length, now)}${server && server.state !== 'connected' ? ' · ' + server.state + (server.reason ? ': ' + server.reason : '') : ''}`}
        class:active={activeKey === session.key} class:degraded={server?.state !== 'connected'} disabled={!live.has(session.key)}
        on:pointerdown={(e) => down(e, session.key)} on:pointermove={move}
        on:click={(e) => {
          const suppress = e.detail > 0 && longPressed === session.key;
          longPressed = null;
          if (!suppress) onopen(session.key);
        }}
        on:contextmenu|preventDefault={() => onactions(session.key)}>
        <span class="state-icon" aria-hidden="true">{chip.icon}</span><span class="session-name">{session.name}</span>
        {#if servers.length > 1}<span class="badge">{session.serverName}</span>{/if}
        <span class="need" aria-hidden="true">{needsYou(agent) ? '●' : ''}</span>
        <span class="sr">{chip.label}</span>
      </button>
    {/each}
    {#if !shown.length}<span class="empty">No sessions</span>{/if}
  </div>
</div>

<style>
  .tabs { flex: 1; min-width: 0; position: relative; }
  .tabs::before, .tabs::after { content: ''; position: absolute; top: 0; bottom: 0; width: 14px; pointer-events: none; z-index: 1; opacity: 0; }
  .tabs::before { left: 0; background: linear-gradient(to right, var(--bg-secondary), transparent); }
  .tabs::after { right: 0; background: linear-gradient(to left, var(--bg-secondary), transparent); }
  .tabs.left::before, .tabs.right::after { opacity: 1; }
  .strip { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; touch-action: pan-x; }
  .strip::-webkit-scrollbar { display: none; }
  button { flex: 0 0 auto; max-width: 100%; min-height: 44px; min-width: 44px; display: flex; align-items: center; gap: 6px; white-space: nowrap; background: var(--bg); color: var(--fg); border: 1px solid var(--border); }
  button.active { border-color: var(--accent); }
  button.degraded { color: var(--fg-muted); border-style: dashed; }
  .session-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .badge { font-size: 0.65rem; background: var(--border); border-radius: 4px; padding: 2px 4px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
  .state-icon { width: 1.2em; text-align: center; flex-shrink: 0; }
  .need { color: var(--danger); width: 8px; flex-shrink: 0; }
  .empty { padding: 12px; color: var(--fg-muted); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
