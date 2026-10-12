<script lang="ts">
  import { inputLog } from './lib/inputlog';
  import { copyText } from './lib/clipboard';

  let status = '';
  async function copy() {
    status = (await copyText($inputLog.join('\n'))) ? 'Copied' : 'Copy failed';
    setTimeout(() => (status = ''), 2000);
  }
</script>

<!-- In the layout (not fixed): a fixed panel sits in the layout viewport, which iOS pans away from the
     visible area while the keyboard is open, so its buttons were out of reach. -->
<div class="log">
  <div class="bar">
    <span>input events ({$inputLog.length}) {status}</span>
    <!-- mousedown is cancelled so the tap does not take focus (and the keyboard) away from the terminal -->
    <button type="button" on:mousedown|preventDefault on:click={copy}>Copy</button>
    <button type="button" on:mousedown|preventDefault on:click={() => inputLog.set([])}>Clear</button>
  </div>
  <pre>{$inputLog.slice(-8).join('\n')}</pre>
</div>

<style>
  .log {
    flex: none;
    max-height: 26%;
    overflow: hidden;
    background: #000;
    color: #fff;
    font: 10px/1.3 monospace;
    border-bottom: 1px solid var(--border);
  }
  .bar {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 2px 6px;
  }
  .bar span {
    flex: 1;
    min-width: 0;
  }
  button {
    padding: 2px 12px;
    min-height: 30px;
    font-size: 11px;
  }
  pre {
    margin: 0;
    padding: 0 6px 4px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow-y: auto;
    max-height: 100%;
  }
</style>
