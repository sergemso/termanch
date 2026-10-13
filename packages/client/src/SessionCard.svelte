<script lang="ts">
  import type { SessionInfo } from './lib/protocol';
  import type { SessionAgent } from './lib/agents';
  import { ageText, chipFor, isDone, progress, staleText, toolLine } from './lib/cards';

  export let session: SessionInfo;
  export let agent: SessionAgent;
  export let now: number;
  export let active = false;
  export let expanded = false;
  export let onopen: () => void;
  export let ontoggle: () => void;
  export let onanswer: (choice: number) => void;

  $: chip = chipFor(agent, now);
  $: prog = progress(agent.plan);
  $: line = toolLine(agent);
  // Only a prompt the agent's own hook confirmed gets answer buttons, and never one that may be out of date.
  $: canAnswer = !!agent.prompt && agent.prompt.confidence === 'high' && !chip.stale && agent.state === 'needs_input';
</script>

<div class="sc" class:active role="group" aria-label={`${session.name}: ${chip.label}${chip.stale ? ', ' + staleText(agent, now) : ''}`}>
  <button type="button" class="open" on:click={onopen}>
    <span class="top">
      <strong class="name">{session.name}</strong>
      {#if session.backend}<span class="badge">{session.backend}</span>{/if}
      <span class="chip {chip.tone}" class:stale={chip.stale}><span aria-hidden="true">{chip.icon}</span> {chip.label}</span>
    </span>
    {#if line}<span class="line">{line}</span>{/if}
    <span class="meta">
      <span>{ageText(agent.ts, now)}</span>
      {#if prog}<span>plan {prog}</span>{/if}
      {#if chip.stale}<span class="staletext">{staleText(agent, now)}</span>{/if}
    </span>
  </button>
  <button type="button" class="more" aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'} on:click={ontoggle}>{expanded ? '▲' : '▼'}</button>

  {#if expanded}
    <div class="sheet">
      {#if agent.prompt}
        {#if canAnswer}
          <div class="answers" role="group" aria-label="Answer">
            {#each agent.prompt.choices as choice, i}
              <button type="button" class="answer" on:click={() => onanswer(i)}>{choice}</button>
            {/each}
          </div>
        {:else}
          <p class="note">
            Waiting for an answer.
            {#if chip.stale}This status may be out of date.{:else}One-tap answers need the agent's hook connected (<code>termanch-server --connect-claude</code>).{/if}
            Open the terminal to answer.
          </p>
        {/if}
      {/if}
      {#if agent.message}<p class="msg">{agent.message}</p>{/if}
      {#if agent.plan && agent.plan.length}
        <ul class="plan" aria-label="Plan">
          {#each agent.plan as item}
            <li><span aria-hidden="true">{isDone(item.status) ? '☑' : '☐'}</span> {item.text} <span class="st">({item.status})</span></li>
          {/each}
        </ul>
      {/if}
      {#if agent.timeline && agent.timeline.length}
        <ol class="timeline" aria-label="Recent tools">
          {#each [...agent.timeline].reverse() as t}
            <li>{t.phase === 'finished' ? '✓' : '…'} {t.name} {t.summary} <span class="st">{ageText(t.ts, now)}</span></li>
          {/each}
        </ol>
      {/if}
      {#if !agent.prompt && !agent.message && !(agent.plan && agent.plan.length) && !(agent.timeline && agent.timeline.length)}
        <p class="note">Nothing reported yet.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sc {
    position: relative;
    margin-bottom: 6px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
  }
  .sc.active {
    border-color: var(--accent);
  }
  .open {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    min-height: 44px;
    padding: 10px 48px 10px 12px;
    text-align: left;
    background: transparent;
    color: inherit;
    border: 0;
    font: inherit;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .name {
    overflow-wrap: anywhere;
  }
  .badge {
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--border);
  }
  .chip {
    margin-left: auto;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid currentColor;
    white-space: nowrap;
  }
  .chip.need {
    color: var(--danger);
    font-weight: 600;
  }
  .chip.work {
    color: var(--accent);
  }
  .chip.done {
    color: var(--success);
  }
  .chip.error {
    color: var(--danger);
  }
  .chip.idle {
    color: var(--fg-muted);
  }
  .chip.stale {
    border-style: dashed;
  }
  .line {
    font-size: 0.8rem;
    color: var(--fg-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    display: flex;
    gap: 10px;
    font-size: 0.7rem;
    color: var(--fg-muted);
  }
  .staletext {
    color: var(--danger);
  }
  .more {
    position: absolute;
    top: 0;
    right: 0;
    width: 44px;
    height: 44px;
    padding: 0;
    background: transparent;
    color: var(--fg-muted);
    border: 0;
  }
  .more:hover:not(:disabled) {
    background: transparent;
  }
  .sheet {
    padding: 4px 12px 12px;
    border-top: 1px solid var(--border);
    font-size: 0.8rem;
  }
  .answers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }
  .answer {
    min-height: 44px;
    min-width: 44px;
    padding: 6px 12px;
    overflow-wrap: anywhere;
  }
  .note,
  .msg {
    margin: 8px 0;
    color: var(--fg-muted);
    overflow-wrap: anywhere;
  }
  .plan,
  .timeline {
    list-style: none;
    margin: 8px 0;
    padding: 0;
    overflow-wrap: anywhere;
  }
  .plan li,
  .timeline li {
    margin-bottom: 3px;
  }
  .st {
    color: var(--fg-muted);
    font-size: 0.7rem;
  }
</style>
