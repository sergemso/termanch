<script lang="ts">
  import { STATES, type FleetState } from './states';
  import { cn } from '../ui/utils';
  /** One of the four counts on Home. A button when it filters the fleet, a plain tile otherwise. */
  let { state, count, onclick, pressed, class: className = '' }: { state: FleetState; count: number; onclick?: () => void; pressed?: boolean; class?: string } = $props();
  const s = $derived(STATES[state]);
  const base = 'flex h-19 min-w-0 flex-col items-center justify-center gap-1 rounded-card border border-line bg-panel';
</script>

{#snippet body()}
  <b class={cn('text-title leading-none font-bold', s.text)}>{count}</b>
  <span class="flex items-center gap-1.5 text-xs font-semibold text-soft"><span aria-hidden="true" class={s.text}>{s.glyph}</span>{s.label}</span>
{/snippet}

{#if onclick}
  <button type="button" {onclick} aria-pressed={pressed} class={cn(base, 'min-h-11 p-0 text-fg', pressed && 'border-accent ring-2 ring-accent', className)}>{@render body()}</button>
{:else}
  <div class={cn(base, className)}>{@render body()}</div>
{/if}
