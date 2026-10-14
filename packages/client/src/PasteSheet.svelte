<script lang="ts">
  import { onMount } from 'svelte';

  /** Shown when the system clipboard cannot be read: long-press the field and choose Paste, then Send. */
  export let text = '';
  export let onsend: (text: string) => void;
  export let onclose: () => void;

  let area: HTMLTextAreaElement;
  onMount(() => area?.focus());
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="Paste">
  <div class="card">
    <h3>Paste</h3>
    <p>The browser would not give the clipboard to the app. Touch and hold the field, choose Paste, then Send.</p>
    <textarea bind:this={area} bind:value={text} rows="5" spellcheck="false" autocapitalize="off"></textarea>
    <div class="buttons">
      <button class="secondary" on:click={onclose}>Cancel</button>
      <button disabled={!text} on:click={() => onsend(text)}>Send</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: calc(var(--safe-top) + 12px) 12px 12px;
    background: rgba(0, 0, 0, 0.6);
  }
  .card {
    width: 100%;
    max-width: 520px;
    padding: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  p {
    margin: 8px 0;
    font-size: 0.8rem;
    color: var(--fg-muted);
  }
  textarea {
    width: 100%;
    font: 16px/1.4 monospace; /* 16px: no iOS zoom on focus */
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
  }
</style>
