<script lang="ts">
  import { bannerChoices, bannerText, type Waiting } from './lib/notify';
  import type { SessionAgent } from './lib/agents';

  export let waiting: Waiting[];
  export let now: number;
  /** The soft keyboard is open: the banner steps aside (the tab strip still shows who needs you). */
  export let collapsed = false;
  export let onopen: (key: string) => void;
  export let onanswer: (key: string, choice: number, prompt: NonNullable<SessionAgent['prompt']>) => void;

  let dismissed = '';
  $: signature = waiting.map(w => w.key).join(',');
  $: show = waiting.length > 0 && !collapsed && dismissed !== signature;
  $: first = waiting[0];
  $: choices = first ? bannerChoices(first.agent, now) : [];
</script>

<div class="live" aria-live="polite">
  {#if show && first}
    <div class="banner" role="status">
      <span class="what"><strong>{bannerText(waiting.length)}</strong>{#if waiting.length === 1} · {first.name}{:else} · first: {first.name}{/if}</span>
      {#each choices as choice, i}
        <button type="button" class="choice" on:click={() => first.agent.prompt && onanswer(first.key, i, first.agent.prompt)}>{choice}</button>
      {/each}
      <button type="button" class="open" on:click={() => onopen(first.key)}>Open</button>
      <button type="button" class="secondary dismiss" aria-label="Dismiss" on:click={() => (dismissed = signature)}>×</button>
    </div>
  {/if}
</div>

<style>
  .banner { display: flex; align-items: center; gap: 6px; padding: 2px 8px; min-height: 44px; background: var(--bg-secondary); border-bottom: 2px solid var(--danger); font-size: 0.85rem; }
  .what { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { min-height: 40px; min-width: 44px; }
  .choice, .open { padding: 0 10px; }
  .dismiss { padding: 0 10px; }
</style>
