<script lang="ts">
  import { onMount } from 'svelte';
  import { copyText } from './lib/clipboard';

  export let text: string;
  export let onclose: () => void;

  let box: HTMLPreElement;
  let status = '';
  onMount(() => box.scrollTo(0, box.scrollHeight));

  async function copyAll() {
    status = (await copyText(text)) ? 'Copied' : 'Copy failed';
    setTimeout(() => (status = ''), 2000);
  }
</script>

<!-- Touch screens cannot select text drawn by the terminal, so this shows the same text as plain, selectable
     text: long-press a word, drag the handles, copy. -->
<div class="select" role="dialog" aria-label="Select text">
  <div class="bar">
    <span>Long-press to select {status}</span>
    <button type="button" on:click={copyAll}>Copy all</button>
    <button type="button" class="secondary" on:click={onclose}>Close</button>
  </div>
  <pre bind:this={box}>{text}</pre>
</div>

<style>
  .select {
    position: absolute;
    inset: 0;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem;
  }
  .bar span {
    flex: 1;
    min-width: 0;
    color: var(--fg-muted);
  }
  pre {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 8px;
    overflow: auto;
    font: 12px/1.35 'JetBrains Mono', Menlo, monospace;
    color: var(--fg);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }
</style>
