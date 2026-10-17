<script lang="ts">
  import { STATES, type FleetState } from './states';
  import { cn } from '../ui/utils';
  /** A state as a word and a glyph; not a control, so it is smaller than a tap target. */
  let { state, label, class: className = '' }: { state: FleetState; label?: string; class?: string } = $props();
  const s = $derived(STATES[state]);
</script>

<span class={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', s.bg, s.text, className)}>
  <span aria-hidden="true">{s.glyph}</span>{label ?? s.label}
</span>
