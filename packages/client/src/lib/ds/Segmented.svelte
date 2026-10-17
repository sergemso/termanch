<script lang="ts">
  import { cn } from '../ui/utils';
  /** A two-or-more option segmented control: one tab stop (the selected option), arrow keys move the choice,
   *  44 pt targets. Taps never take focus from a text field (guardrail soft-keyboard-never-hides-input). */
  let { value, options, label, onchange, class: className = '' }: {
    value: string; options: { value: string; label: string }[]; label: string; onchange: (value: string) => void; class?: string;
  } = $props();
  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length];
    onchange(next.value);
    (e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  };
</script>

<div role="radiogroup" aria-label={label} class={cn('flex gap-1 rounded-card bg-raised p-1', className)} data-segmented>
  {#each options as o, i (o.value)}
    <button type="button" role="radio" aria-checked={o.value === value} tabindex={o.value === value ? 0 : -1} data-value={o.value}
      onclick={() => onchange(o.value)} onkeydown={(e) => move(e, i)} onpointerdown={(e) => e.preventDefault()}
      class={cn('min-h-11 flex-1 rounded-control px-4 text-base font-semibold', o.value === value ? 'bg-accent text-on-accent' : 'bg-transparent text-soft')}>{o.label}</button>
  {/each}
</div>
