<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { cn } from '../utils';

  type Item = { value: string; label: string; content: Snippet };
  let { value = $bindable(''), items, class: className = '' }: { value?: string; items: Item[]; class?: string } = $props();
</script>

<Tabs.Root bind:value class={cn('flex flex-col gap-3', className)}>
  <Tabs.List class="flex gap-2">
    {#each items as item (item.value)}
      <Tabs.Trigger
        value={item.value}
        class="flex-1 rounded-md border border-border bg-bg-secondary px-4 py-2 font-semibold text-fg data-[state=active]:border-accent data-[state=active]:bg-accent data-[state=active]:text-on-accent"
      >
        {item.label}
      </Tabs.Trigger>
    {/each}
  </Tabs.List>
  {#each items as item (item.value)}
    <Tabs.Content value={item.value}>{@render item.content()}</Tabs.Content>
  {/each}
</Tabs.Root>
