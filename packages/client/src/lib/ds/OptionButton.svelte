<script lang="ts">
  import { tv } from 'tailwind-variants';
  import type { Snippet } from 'svelte';
  import { cn } from '../ui/utils';
  const option = tv({
    base: 'flex min-h-15 w-full items-center gap-3 rounded-card py-2 pr-4 pl-3 text-left',
    variants: { primary: { true: 'bg-warn text-on-warn', false: 'bg-raised text-fg' }, disabled: { true: 'opacity-60' } },
  });
  /** A numbered answer. One per decision is primary (DR3); the number is also the desktop shortcut. */
  let { hint, label, detail, primary = false, disabled = false, onclick, class: className = '' }: { hint?: string; label: string; detail?: Snippet | string; primary?: boolean; disabled?: boolean; onclick?: () => void; class?: string } = $props();
</script>

<button type="button" {onclick} {disabled} onpointerdown={(e) => e.preventDefault()} class={cn(option({ primary, disabled }), className)}>
  {#if hint}<span aria-hidden="true" class={cn('inline-grid size-7 shrink-0 place-items-center rounded-lg font-mono text-sm font-semibold', primary ? 'bg-black/15' : 'bg-sunken text-soft')}>{hint}</span>{/if}
  <span class="flex min-w-0 flex-col">
    <b class="text-base font-semibold">{label}</b>
    {#if detail}<small class={cn('text-sm', primary ? '' : 'text-soft')}>{#if typeof detail === 'string'}{detail}{:else}{@render detail()}{/if}</small>{/if}
  </span>
</button>
