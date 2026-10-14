<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils';

  let {
    open = true,
    side = 'left',
    class: className = '',
    children,
  }: { open?: boolean; side?: 'left' | 'right'; class?: string; children: Snippet } = $props();
</script>

<!-- A collapsible column; it takes no space while closed. -->
{#if open}
  <aside class={cn('flex w-64 shrink-0 flex-col overflow-y-auto border-border bg-bg-secondary', side === 'left' ? 'border-r' : 'border-l', className)}>
    {@render children()}
  </aside>
{/if}
