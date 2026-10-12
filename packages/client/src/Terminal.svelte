<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XTermTerminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebglAddon } from 'xterm-addon-webgl';
  import 'xterm/css/xterm.css';

  import type { Connection, ConnState } from './lib/connection';
  import { b64ToBytes, textToB64 } from './lib/connection';
  import { applyMods, clampFont, pinchFont, FONT_DEFAULT, type Mods } from './lib/keys';
  import KeyRow from './KeyRow.svelte';

  export let connection: Connection;
  export let activeSessionId: string | null = null;
  export let connState: ConnState = 'connected';

  const FONT_KEY = 'termanch_font';
  let mods: Mods = { ctrl: false, alt: false };
  let fontSize = clampFont(Number(localStorage.getItem(FONT_KEY)) || FONT_DEFAULT);
  let quality = '';
  let qualityTimer: ReturnType<typeof setInterval> | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStart: { dist: number; font: number } | null = null;

  let terminalContainer: HTMLDivElement;
  let term: XTermTerminal | null = null;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let unsubscribe: (() => void) | null = null;

  function sendInput(data: string) {
    if (activeSessionId) connection.send({ type: 'input', data: textToB64(data) });
  }

  /** Typed characters pass through the sticky Ctrl/Alt; key-row sequences are sent as they are. */
  function typed(data: string) {
    const { out, used } = applyMods(data, mods);
    if (used) mods = { ctrl: false, alt: false };
    sendInput(out);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) term?.paste(text);
    } catch {
      /* permission denied: the browser's own paste (long-press in the terminal) still works */
    }
  }

  /** Copies the selection, or the visible screen when nothing is selected. */
  async function copy() {
    if (!term) return;
    let text = term.getSelection();
    if (!text) {
      const buf = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < term.rows; i++) lines.push(buf.getLine(buf.viewportY + i)?.translateToString(true) ?? '');
      text = lines.join('\n').replace(/\s+$/, '');
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  }

  function setFont(size: number) {
    fontSize = clampFont(size);
    localStorage.setItem(FONT_KEY, String(fontSize));
    if (term) {
      term.options.fontSize = fontSize;
      fitAddon?.fit();
    }
  }

  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  function pointerDown(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinchStart = { dist: spread(), font: fontSize };
  }
  function pointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart && pinchStart.dist > 0) {
      const next = pinchFont(pinchStart.font, spread() / pinchStart.dist);
      if (next !== fontSize) setFont(next);
    }
  }
  function pointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
  }

  function sendResize(cols: number, rows: number) {
    if (activeSessionId) connection.send({ type: 'resize', cols, rows });
  }

  onMount(() => {
    term = new XTermTerminal({
      cursorBlink: true,
      fontSize,
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

    term.open(terminalContainer);
    // WebGL is the fast renderer; where it is missing or its context is lost, xterm's DOM renderer takes over
    // instead of leaving a blank screen.
    try {
      const gl = new WebglAddon();
      gl.onContextLoss(() => gl.dispose());
      term.loadAddon(gl);
    } catch {
      /* DOM renderer */
    }
    fitAddon.fit();

    term.onData((data) => typed(data));
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

    qualityTimer = setInterval(() => {
      const kind = connection.kind;
      quality = kind ? `${kind === 'rtc' ? 'direct' : 'relay'}${connection.rtt != null ? ` · ${connection.rtt} ms` : ''}` : '';
    }, 1000);

    return () => {
      if (qualityTimer) clearInterval(qualityTimer);
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

<div class="wrap">
  <div
    class="screen"
    bind:this={terminalContainer}
    on:click={() => term?.focus()}
    on:pointerdown={pointerDown}
    on:pointermove={pointerMove}
    on:pointerup={pointerUp}
    on:pointercancel={pointerUp}
  ></div>
  <div class="status" aria-live="polite">
    <span class="dot" class:ok={connState === 'connected'}></span>
    {connState === 'connected' ? quality || 'connected' : connState}
    <span class="spacer"></span>
    <button class="font" aria-label="Smaller text" on:pointerdown|preventDefault={() => setFont(fontSize - 1)}>A−</button>
    <button class="font" aria-label="Larger text" on:pointerdown|preventDefault={() => setFont(fontSize + 1)}>A+</button>
  </div>
  <KeyRow bind:mods onkey={sendInput} onpaste={paste} oncopy={copy} />
</div>

<style>
  .wrap {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .screen {
    flex: 1;
    min-height: 0;
    touch-action: pan-y; /* vertical scroll stays native; the two-finger pinch is ours */
  }
  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    font-size: 0.7rem;
    color: var(--fg-muted);
    background: var(--bg-secondary);
  }
  .status .spacer {
    flex: 1;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--danger);
  }
  .dot.ok {
    background: var(--success);
  }
  .font {
    padding: 2px 8px;
    min-height: 26px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    font-size: 0.7rem;
  }
  :global(.xterm) {
    height: 100% !important;
  }
  :global(.xterm-helper-textarea) {
    opacity: 0 !important;
  }
</style>