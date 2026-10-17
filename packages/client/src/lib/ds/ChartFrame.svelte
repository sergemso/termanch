<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../ui/utils';
  /** The card every report chart sits in: title, an optional legend, the chart, a caption that says it in words. */
  let { title, caption, legend, children, class: className = '' }: { title: string; caption?: string; legend?: Snippet; children: Snippet; class?: string } = $props();
</script>

<figure class={cn('m-0 flex flex-col gap-3 rounded-card border border-line bg-panel p-4', className)}>
  <figcaption class="flex items-baseline justify-between gap-2"><b class="text-base font-semibold">{title}</b>{#if legend}<span class="text-xs text-soft">{@render legend()}</span>{/if}</figcaption>
  {@render children()}
  {#if caption}<p class="text-sm text-soft">{caption}</p>{/if}
</figure>
