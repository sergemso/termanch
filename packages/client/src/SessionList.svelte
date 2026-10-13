<script lang="ts">
  import { onMount } from 'svelte';
  import SessionCard from './SessionCard.svelte';
  import type { ClientMessage, SessionInfo } from './lib/protocol';
  import { agents } from './lib/agents';
  import { chipFor, FrozenOrder } from './lib/cards';
  import * as snippets from './lib/snippets';

  export let sessions: SessionInfo[] = [];
  export let activeSessionId: string | null = null;
  export let onopen: (id: string) => void;
  export let send: (m: ClientMessage) => void;

  let now = Date.now();
  let expanded: string | null = null;
  let order: string[] = [];
  let announcement = '';
  let known: Record<string, string> = {};
  let saved = snippets.load();
  let target: string | null = null;
  let draft = '';
  const frozen = new FrozenOrder();

  $: byId = new Map(sessions.map((s) => [s.id, s]));
  $: order = frozen.order(sessions.map((s) => s.id), $agents, now);
  $: replyTo = target && byId.has(target) ? target : (activeSessionId ?? sessions[0]?.id ?? null);

  // A change to "needs you" is announced to screen readers, once per change.
  $: for (const s of sessions) {
    const a = $agents[s.id];
    const state = a ? a.state : '';
    if (state === 'needs_input' && known[s.id] !== 'needs_input') announcement = `${s.name} needs you`;
    known[s.id] = state;
  }

  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  function toggle(id: string) {
    frozen.sheet(expanded !== id); // a sheet is open while a card is expanded: nothing reorders
    if (expanded && expanded !== id) frozen.sheet(false);
    expanded = expanded === id ? null : id;
  }

  function answer(id: string, choice: number) {
    const p = $agents[id]?.prompt;
    if (p) send({ type: 'answer', session: id, prompt_id: p.id, seq: p.seq, choice });
  }

  function sendReply(text: string) {
    const t = snippets.clean(text);
    if (!t || !replyTo) return;
    send({ type: 'reply', session: replyTo, text: t });
    draft = '';
  }
  function saveDraft() {
    saved = snippets.add(saved, draft);
    snippets.save(saved);
  }
  function drop(text: string) {
    saved = snippets.remove(saved, text);
    snippets.save(saved);
  }
</script>

<div class="sr" aria-live="polite" role="status">{announcement}</div>

<ul
  class="list"
  on:pointerdown={() => frozen.touchDown()}
  on:pointerup={() => frozen.touchUp()}
  on:pointercancel={() => frozen.touchUp()}
  on:scroll={() => frozen.scrolled(Date.now())}
>
  {#each order as id (id)}
    {@const session = byId.get(id)}
    {#if session}
      <li>
        {#if $agents[id]}
          <SessionCard
            {session}
            agent={$agents[id]}
            {now}
            active={activeSessionId === id}
            expanded={expanded === id}
            onopen={() => onopen(id)}
            ontoggle={() => toggle(id)}
            onanswer={(c) => answer(id, c)}
          />
        {:else}
          <button type="button" class="plain" class:active={activeSessionId === id} on:click={() => onopen(id)}>
            <span class="pn">{session.name}</span>
            {#if session.backend}<span class="pb">{session.backend}</span>{/if}
          </button>
        {/if}
      </li>
    {/if}
  {/each}
  {#if sessions.length === 0}
    <li class="empty">No sessions yet</li>
  {/if}
</ul>

{#if sessions.length > 0}
  <form class="reply" on:submit|preventDefault={() => sendReply(draft)}>
    <label class="lbl" for="reply-to">Quick reply to</label>
    <select id="reply-to" value={replyTo} on:change={(e) => (target = e.currentTarget.value)}>
      {#each sessions as s}<option value={s.id}>{s.name}</option>{/each}
    </select>
    <div class="snips">
      {#each saved as text}
        <span class="snip">
          <button type="button" class="s1" on:click={() => sendReply(text)}>{text}</button>
          <button type="button" class="s2" aria-label={`Delete snippet ${text}`} on:click={() => drop(text)}>×</button>
        </span>
      {/each}
    </div>
    <div class="row">
      <input bind:value={draft} maxlength="200" placeholder="Type a reply" aria-label="Reply text" enterkeyhint="send" />
      <button type="submit" disabled={!draft.trim()}>Send</button>
      <button type="button" class="secondary" disabled={!draft.trim()} on:click={saveDraft}>Save</button>
    </div>
  </form>
{/if}

<style>
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .plain {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    margin-bottom: 4px;
    padding: 10px 12px;
    text-align: left;
    border-radius: 6px;
    background: transparent;
    color: var(--fg);
    border: 0;
  }
  .plain.active {
    background: var(--accent);
    color: var(--bg);
  }
  .pn {
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .pb {
    font-size: 0.7rem;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--border);
    color: var(--fg);
  }
  .empty {
    color: var(--fg-muted);
    text-align: center;
    padding: 24px;
  }
  .reply {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lbl {
    font-size: 0.7rem;
    color: var(--fg-muted);
    text-transform: uppercase;
  }
  .snips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .snip {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }
  .s1 {
    min-height: 44px;
    min-width: 44px;
    padding: 0 10px;
    background: transparent;
    color: var(--fg);
    border: 0;
    font-size: 0.8rem;
    font-weight: 400;
  }
  .s2 {
    min-width: 36px;
    background: transparent;
    color: var(--fg-muted);
    border: 0;
    border-left: 1px solid var(--border);
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .row input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
  }
  .row button {
    min-height: 44px;
  }
</style>
