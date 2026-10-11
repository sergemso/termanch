<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XTermTerminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebglAddon } from 'xterm-addon-webgl';
  import 'xterm/css/xterm.css';

  import type { Connection } from './lib/connection';
  import { b64ToBytes, textToB64 } from './lib/connection';

  export let connection: Connection;
  export let activeSessionId: string | null = null;

  let terminalContainer: HTMLDivElement;
  let term: XTermTerminal | null = null;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let unsubscribe: (() => void) | null = null;

  function sendInput(data: string) {
    if (activeSessionId) connection.send({ type: 'input', data: textToB64(data) });
  }

  function sendResize(cols: number, rows: number) {
    if (activeSessionId) connection.send({ type: 'resize', cols, rows });
  }

  onMount(() => {
    term = new XTermTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", "Menlo", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        black: '#161b22',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#a371f7',
        cyan: '#39c5cf',
        white: '#e6edf3',
        brightBlack: '#484f58',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79b8ff',
        brightMagenta: '#b490f7',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff',
      },
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebglAddon());

    term.open(terminalContainer);
    fitAddon.fit();

    term.onData((data) => sendInput(data));
    term.onResize(({ cols, rows }) => sendResize(cols, rows));

    resizeObserver = new ResizeObserver(() => {
      fitAddon?.fit();
      if (term) sendResize(term.cols, term.rows);
    });
    resizeObserver.observe(terminalContainer);

    unsubscribe = connection.subscribe((msg) => {
      if (msg.type === 'output') {
        term?.write(b64ToBytes(msg.data));
      } else if (msg.type === 'session_attached') {
        // tmux repaints the screen on attach; start clean so a re-attach never doubles the content.
        term?.reset();
        if (term) sendResize(term.cols, term.rows);
      }
    });

    return () => {
      unsubscribe?.();
      resizeObserver?.disconnect();
      term?.dispose();
    };
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    term?.dispose();
  });
</script>

<div bind:this={terminalContainer} style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
  <div style="flex: 1; min-height: 0;"></div>
</div>

<style>
  :global(.xterm) {
    height: 100% !important;
  }
  :global(.xterm-helper-textarea) {
    opacity: 0 !important;
  }
</style>