<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XTermTerminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebglAddon } from 'xterm-addon-webgl';
  import 'xterm/css/xterm.css';

  export let activeSessionId: string | null = null;

  let terminalContainer: HTMLDivElement;
  let term: XTermTerminal | null = null;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function sendInput(data: string) {
    const ws = (window as any).__termanch_ws;
    if (ws && ws.readyState === WebSocket.OPEN && activeSessionId) {
      const encoded = btoa(data);
      ws.send(JSON.stringify({ type: 'input', data: encoded }));
    }
  }

  function sendResize(cols: number, rows: number) {
    const ws = (window as any).__termanch_ws;
    if (ws && ws.readyState === WebSocket.OPEN && activeSessionId) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
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

    const ws = (window as any).__termanch_ws;
    if (ws) {
      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          const decoded = atob(msg.data);
          term?.write(decoded);
        }
      };
    }

    return () => {
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