<script lang="ts" module>
  export interface StripItem { id: string; name: string; agent?: string; command?: string; state: FleetState }
</script>

<script lang="ts">
  import AgentBadge from './AgentBadge.svelte';
  import type { FleetState } from './states';
  import { cn } from '../ui/utils';
  /** Every session's state on one row, the open one named. 48 px high with 8 px between items (DR1, DR2). */
  let { items, selected, onselect, onadd, class: className = '' }: { items: StripItem[]; selected?: string; onselect?: (id: string) => void; onadd?: () => void; class?: string } = $props();
</script>

<div class={cn('flex items-center gap-2 overflow-x-auto px-3 py-1 [scrollbar-width:none]', className)} role="tablist" aria-label="Sessions">
  {#each items as item (item.id)}
    <button type="button" role="tab" aria-selected={item.id === selected} onclick={() => onselect?.(item.id)}
      onpointerdown={(e) => e.preventDefault()}
      class={cn('flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-transparent p-1 text-fg', item.id === selected && 'bg-raised')}>
      <AgentBadge agent={item.agent} command={item.command} state={item.state} />
      {#if item.id === selected}<b class="pr-3 text-sm font-semibold">{item.name}</b>{/if}
    </button>
  {/each}
  {#if onadd}
    <button type="button" aria-label="New session" onclick={onadd} onpointerdown={(e) => e.preventDefault()}
      class="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-title text-muted">+</button>
  {/if}
</div>
