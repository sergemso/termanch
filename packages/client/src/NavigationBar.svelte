<script lang="ts">
  import TabStrip from './TabStrip.svelte';
  import { needsYouCount } from './lib/tabs';
  import type { AgentMap } from './lib/agents';
  import type { HubServer, HubSession } from './lib/hub';
  export let sessions: HubSession[];
  export let agents: AgentMap;
  export let servers: HubServer[];
  export let activeKey: string | null;
  export let held = false;
  export let onopen: (key: string) => void;
  export let onactions: (key: string) => void;
  export let onmenu: () => void;
  export let onsessions: () => void;
  $: count = needsYouCount(Object.fromEntries(sessions.filter(s => agents[s.key]).map(s => [s.key, agents[s.key]])));
</script>
<header class="topbar">
  <button class="secondary menu-button" aria-label="Menu" on:click={onmenu}>☰</button>
  <TabStrip {sessions} {agents} {servers} {activeKey} {held} {onopen} {onactions} />
  <button class="secondary sessions-button" aria-label={`Sessions${count ? ', ' + count + ' need you' : ''}`} on:click={onsessions}>Sessions<span class="count" class:quiet={!count} aria-hidden="true">{count || ''}</span></button>
</header>
<style>
  .topbar { display: flex; align-items: center; gap: 6px; min-height: 56px; padding: 6px 8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .menu-button, .sessions-button { min-height: 44px; min-width: 44px; flex-shrink: 0; touch-action: manipulation; }
  .menu-button { padding: 0 12px; }
  .sessions-button { padding: 0 8px; display: flex; align-items: center; gap: 4px; }
  .count { border-radius: 10px; width: 28px; padding: 1px 2px; background: var(--danger); color: var(--bg); font-size: 0.75rem; }
  .count.quiet { visibility: hidden; }
</style>
