<script lang="ts">
  import { ContextMenu } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { cn } from '../utils';

  type Item = { label: string; onselect: () => void; danger?: boolean };
  let { items, class: className = '', children }: { items: Item[]; class?: string; children: Snippet } = $props();
</script>

<!-- Opens on right-click or a long press. No portal, so it stays inside the app shell. -->
<ContextMenu.Root>
  <ContextMenu.Trigger class={className}>{@render children()}</ContextMenu.Trigger>
  <ContextMenu.Content class="z-[200] min-w-40 rounded-lg border border-border bg-bg-secondary p-1 shadow-lg">
    {#each items as item (item.label)}
      <ContextMenu.Item
        onSelect={item.onselect}
        class={cn('rounded-md px-3 py-2 text-sm data-[highlighted]:bg-border', item.danger && 'text-danger')}
      >
        {item.label}
      </ContextMenu.Item>
    {/each}
  </ContextMenu.Content>
</ContextMenu.Root>
