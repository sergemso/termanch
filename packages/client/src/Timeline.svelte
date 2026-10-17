<script lang="ts">
  import { isDone } from './lib/cards';
  import type { TimelineView } from './lib/sessionView';
  /** The T1 timeline (decision 0103): plan progress, the recent prompts and tool steps, the files changed and the
   *  agent's last message. Every string is untrusted transcript text, already scrubbed by the server and cleaned
   *  again by the client; it is rendered as text only. */
  let { timeline }: { timeline: TimelineView } = $props();
  const done = $derived(timeline.plan.filter((p) => isDone(p.status)).length);
  const glyph = (status: string) => (isDone(status) ? '✓' : /progress/i.test(status) ? '▸' : '○');
</script>

<section aria-label="Timeline" class="flex flex-col gap-3" data-testid="timeline">
  <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Timeline</h3>

  {#if timeline.plan.length}
    <div class="flex flex-col gap-1" data-timeline-plan>
      <b class="text-sm font-semibold text-fg">Plan · {done} of {timeline.plan.length} done</b>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        {#each timeline.plan as p, i (i)}
          <li class="flex gap-2 text-sm {isDone(p.status) ? 'text-muted' : 'text-fg'}"><span aria-hidden="true" class="w-4 shrink-0">{glyph(p.status)}</span><span class="min-w-0 break-words">{p.text}</span></li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if timeline.entries.length}
    <ol class="m-0 flex list-none flex-col gap-1 p-0" data-timeline-entries>
      {#each timeline.entries as e, i (i)}
        <li class="flex gap-2 text-sm" data-kind={e.kind}>
          {#if e.kind === 'prompt'}
            <span class="shrink-0 font-semibold text-accent-text">You</span><span class="min-w-0 break-words text-fg">{e.text}</span>
          {:else if e.kind === 'tool'}
            <span class="shrink-0 font-mono font-semibold text-soft">{e.name}</span><span class="min-w-0 truncate font-mono text-muted">{e.text}</span>
          {:else}
            <span class="min-w-0 break-words text-soft">{e.text}</span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  {#if timeline.files.length}
    <p class="m-0 text-sm text-soft" data-timeline-files><b class="font-semibold text-fg">Changed</b> · {timeline.files.join(', ')}</p>
  {/if}

  {#if timeline.lastMessage}
    <blockquote class="m-0 rounded-card bg-raised p-3 text-sm text-fg" data-timeline-last>{timeline.lastMessage}</blockquote>
  {/if}
</section>
