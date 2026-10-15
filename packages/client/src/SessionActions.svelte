<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { rememberFocus } from './lib/focus';
  import type { HubSession } from './lib/hub';
  export let session: HubSession;
  /** Closing a session is not possible on every manager. */
  export let canClose = true;
  export let ondetach: () => void;
  export let onclosesession: () => void;
  export let onclose: () => void;
  /** Opened from "Close session" in the windows menu: go straight to the question. */
  export let confirmFirst = false;
  let dialog: HTMLDialogElement;
  /** Close session asks first, naming the session and its server (guardrail kill-session-needs-confirmation). */
  let confirming = confirmFirst;
  const restoreFocus = rememberFocus();
  onMount(() => dialog.showModal());
  onDestroy(restoreFocus);
</script>
<dialog bind:this={dialog} aria-label="Session actions" on:cancel|preventDefault={onclose}>
  <h2>{session.name}</h2><p>{session.serverName}</p>
  {#if confirming}
    <p role="alert">Close <strong>{session.name}</strong> on {session.serverName}? Everything running in it ends.</p>
    <button class="danger" on:click={() => { onclose(); onclosesession(); }}>Close session</button>
    <button class="secondary" on:click={() => (confirmFirst ? onclose() : (confirming = false))}>Cancel</button>
  {:else}
    <button on:click={() => { onclose(); ondetach(); }}>Detach (keeps it running)</button>
    {#if canClose}<button class="danger" on:click={() => (confirming = true)}>Close session…</button>{/if}
    <button class="secondary" on:click={onclose}>Cancel</button>
  {/if}
</dialog>
<style>
  dialog { margin: auto; padding: 16px; max-width: calc(100% - 32px); border: 1px solid var(--border); border-radius: 12px; background: var(--bg-secondary); color: var(--fg); }
  dialog::backdrop { background: #0008; }
  h2, p { overflow-wrap: anywhere; margin-bottom: 12px; }
  button { display: block; width: 100%; min-height: 44px; min-width: 44px; margin-bottom: 8px; }
  .danger { background: var(--danger); color: var(--bg); }
</style>
