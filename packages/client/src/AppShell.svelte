<script lang="ts">
  import { onMount } from 'svelte';
  import { DEBUG_KEY, debugEnabled, debugText, viewportBox, type Box } from './lib/viewport';

  /** In a session the shell is pinned to what is visible; elsewhere the page scrolls normally. */
  export let pinned = false;

  let debug = debugEnabled(location.search, localStorage.getItem(DEBUG_KEY));
  let box: Box = viewportBox(null, window);
  let overlay = '';

  function measure() {
    const vv = window.visualViewport;
    box = viewportBox(vv, window);
    document.documentElement.style.setProperty('--app-height', `${box.height}px`);
    if (debug) overlay = debugText(vv, window, box);
  }

  onMount(() => {
    const vv = window.visualViewport;
    const toggle = () => {
      debug = debugEnabled(location.search, localStorage.getItem(DEBUG_KEY));
      measure();
    };
    window.addEventListener('termanch-debug', toggle);
    measure();
    // iOS fires `scroll` (not `resize`) when it pans the visual viewport to show the focused field.
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('termanch-debug', toggle);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  });

  $: document.documentElement.classList.toggle('shell-pinned', pinned);
</script>

<div
  class="shell"
  class:pinned
  class:keyboard={box.keyboard}
  style={pinned ? `top: ${box.top}px; left: ${box.left}px; width: ${box.width}px; height: ${box.height}px;` : ''}
>
  <slot />
</div>
{#if debug}<pre class="debug">{overlay}</pre>{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .shell.pinned {
    position: fixed;
    overflow: hidden;
    /* Under black-translucent the page also draws behind the status bar and home indicator. */
    padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
    box-sizing: border-box;
  }
  /* With the keyboard open its own area replaces the home-indicator inset. */
  .shell.pinned:not(.keyboard) {
    padding-bottom: env(safe-area-inset-bottom);
  }
  :global(html.shell-pinned),
  :global(html.shell-pinned body) {
    overflow: hidden;
    overscroll-behavior: none;
  }
  .debug {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 2000;
    margin: 0;
    padding: 4px 6px;
    font: 11px/1.3 monospace;
    color: #fff;
    background: rgba(0, 0, 0, 0.75);
    pointer-events: none;
    white-space: pre;
  }
</style>
