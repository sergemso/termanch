<script lang="ts">
  import { inputLog } from './lib/inputlog';

  let copied = false;
  async function copy() {
    try {
      await navigator.clipboard.writeText($inputLog.join('\n'));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* clipboard unavailable: the lines stay on screen to read */
    }
  }
</script>

<div class="log">
  <div class="bar">
    <span>input events ({$inputLog.length})</span>
    <button on:pointerdown|preventDefault={copy}>{copied ? 'Copied' : 'Copy'}</button>
    <button on:pointerdown|preventDefault={() => inputLog.set([])}>Clear</button>
  </div>
  <pre>{$inputLog.slice(-12).join('\n')}</pre>
</div>

<style>
  .log {
    position: fixed;
    left: 0;
    right: 0;
    top: 64px;
    z-index: 1999;
    max-height: 32vh;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font: 10px/1.3 monospace;
    pointer-events: none;
  }
  .bar {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 2px 6px;
  }
  .bar span {
    flex: 1;
  }
  button {
    pointer-events: auto;
    padding: 2px 8px;
    min-height: 24px;
    font-size: 10px;
  }
  pre {
    margin: 0;
    padding: 0 6px 4px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
