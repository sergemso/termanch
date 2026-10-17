<script lang="ts" module>
  export interface MoreGroup { title: string; items: { label: string; danger?: boolean; onclick?: () => void }[] }
</script>

<script lang="ts">
  import Sheet from '../ui/sheet/Sheet.svelte';
  import { cn } from '../ui/utils';
  /** Everything not on the dock, in groups (agent actions, navigation, control keys, symbols, tmux, tools). */
  let { open = $bindable(false), title = 'More', groups, class: className = '' }: { open?: boolean; title?: string; groups: MoreGroup[]; class?: string } = $props();
</script>

<Sheet bind:open {title} class={cn('rounded-t-[22px] bg-panel', className)}>
  {#each groups as group (group.title)}
    <section>
      <h3 class="mt-4 mb-2 text-xs font-semibold tracking-wider text-soft uppercase">{group.title}</h3>
      <div class="flex flex-wrap gap-2">
        {#each group.items as item (item.label)}
          <button type="button" onclick={item.onclick} onpointerdown={(e) => e.preventDefault()}
            class={cn('h-12 min-w-12 rounded-control px-4 text-base font-semibold', item.danger ? 'bg-bad/15 text-bad' : 'bg-raised text-fg')}>{item.label}</button>
        {/each}
      </div>
    </section>
  {/each}
</Sheet>
