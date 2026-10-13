<script lang="ts">
  import { onMount } from 'svelte';
  import { copyText } from './lib/clipboard';
  import type { HubSession } from './lib/hub';
  export let session: HubSession;
  export let onclose: () => void;
  let dialog: HTMLDialogElement;
  let result = '';
  onMount(() => dialog.showModal());
</script>
<dialog bind:this={dialog} aria-label="Session actions" on:cancel|preventDefault={onclose}>
  <h2>{session.name}</h2><p>{session.serverName}</p>
  <button on:click={async () => { result = await copyText(session.name) ? 'Copied' : 'Copy failed'; }}>Copy name</button>
  <button class="secondary" on:click={onclose}>Close</button>
  <p role="status">{result}</p>
</dialog>
<style>
  dialog { margin: auto; padding: 16px; max-width: calc(100% - 32px); border: 1px solid var(--border); border-radius: 12px; background: var(--bg-secondary); color: var(--fg); }
  dialog::backdrop { background: #0008; }
  h2, p { overflow-wrap: anywhere; margin-bottom: 12px; }
  button { min-height: 44px; min-width: 44px; }
</style>
