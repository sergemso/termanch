<script lang="ts">
  import { reportPlan } from './lib/report';

  export let text: string;
  export let onclose: () => void;

  async function open() {
    const plan = reportPlan(text);
    if (plan.copy) {
      try {
        await navigator.clipboard.writeText(plan.copy);
      } catch {
        /* the text stays on screen to copy by hand */
      }
    }
    window.open(plan.url, '_blank', 'noopener');
    onclose();
  }
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="Report a problem">
  <div class="card">
    <h3>Report a problem</h3>
    <p>This opens a new issue on GitHub. Read and edit the text below first: it has the app version, browser, screen numbers, connection state and recent error messages. Certificates, secrets, tokens and addresses are removed; terminal content is never included.</p>
    <textarea bind:value={text} rows="10" spellcheck="false"></textarea>
    <div class="buttons">
      <button class="secondary" on:click={onclose}>Cancel</button>
      <button on:click={open}>Open GitHub issue</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.6);
  }
  .card {
    width: 100%;
    max-width: 520px;
    max-height: 100%;
    overflow-y: auto;
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
    font: 12px/1.4 monospace;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px;
    font-size: 16px; /* no iOS zoom on focus */
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
  }
</style>
