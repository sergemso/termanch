<script lang="ts">
  // shadcn-svelte "Native Select", adapted to our tokens: a real <select> (so a phone shows its own picker) with the
  // shadcn look. 44 px tall and 16 px text, because iOS zooms the page into a field under 16 px and a target is 44 pt.
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import { cn } from '../utils';

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    wrapperClass,
    children,
    ...rest
  }: HTMLSelectAttributes & { ref?: HTMLSelectElement | null; wrapperClass?: string } = $props();
</script>

<div class={cn('relative w-full min-w-0 has-[select:disabled]:opacity-50', wrapperClass)} data-slot="native-select-wrapper">
  <select
    bind:value
    bind:this={ref}
    data-slot="native-select"
    class={cn(
      'h-11 w-full min-w-0 appearance-none rounded-control border border-line bg-sunken py-2 ps-3 pe-10 text-base text-fg outline-none',
      'transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed',
      'focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/40 aria-invalid:border-bad',
      className,
    )}
    {...rest}
  >
    {@render children?.()}
  </select>
  <svg
    class="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-soft"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    data-slot="native-select-icon"
  >
    <path d="m4 6 4 4 4-4" />
  </svg>
</div>
