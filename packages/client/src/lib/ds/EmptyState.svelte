<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../ui/utils';
  /** Nothing to show yet: say what this place is for and give the one next step. */
  let { title, body, children, class: className = '' }: { title: string; body?: string; children?: Snippet; class?: string } = $props();
</script>

<div class={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
  <h2 class="text-title font-bold">{title}</h2>
  {#if body}<p class="max-w-prose text-base text-soft">{body}</p>{/if}
  {#if children}<div class="mt-2 flex w-full max-w-xs flex-col gap-2">{@render children()}</div>{/if}
</div>
