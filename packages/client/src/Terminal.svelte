<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal as XTermTerminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebglAddon } from 'xterm-addon-webgl';
  import 'xterm/css/xterm.css';

  import type { Connection, ConnState } from './lib/connection';
  import { b64ToBytes, textToB64 } from './lib/connection';
  import { applyMods, bufferText, clampFont, pinchFont, FONT_DEFAULT, type Mods } from './lib/keys';
  import KeyRow from './KeyRow.svelte';
  import InputLog from './InputLog.svelte';
  import { attachInputLogger } from './lib/inputlog';
  import { replacementData, replacementKeys } from './lib/swipe';
  import SelectView from './SelectView.svelte';
  import FnKeyboard from './FnKeyboard.svelte';
  import { cellAt, cellBox, ordered, selectionArgs, wordRange, type Cell } from './lib/selection';
  import { copyText } from './lib/clipboard';
  import { beep, bellEnabled, setBellEnabled, unlockAudio } from './lib/bell';
  import { DEBUG_KEY, debugEnabled } from './lib/viewport';

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
  let webgl: WebglAddon | null = null;
  let disposed = false;
  let selectText: string | null = null;
  let fnOpen = false;
  /** Touch selection: the two ends (absolute buffer rows), and what the finger is doing. */
  let sel: { a: Cell; b: Cell } | null = null;
  let selecting = false;
  let dragHandle: 'a' | 'b' | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressAt = { x: 0, y: 0 };
  let selStatus = '';
  let bell = bellEnabled();
  let lastEnter = 0;
  let stopLog: (() => void) | null = null;
  let stopReplace: (() => void) | null = null;
  let debug = debugEnabled(location.search, localStorage.getItem(DEBUG_KEY));
  const syncDebug = () => (debug = debugEnabled(location.search, localStorage.getItem(DEBUG_KEY)));

  /** Runs once: the WebGL addon goes before the terminal (the other order throws), and nothing here may throw. */
  function teardown() {
    if (disposed) return;
    disposed = true;
    stopLog?.();
    stopReplace?.();
    window.removeEventListener('termanch-debug', syncDebug);
    if (qualityTimer) clearInterval(qualityTimer);
    try {
      unsubscribe?.();
      resizeObserver?.disconnect();
    } catch {
      /* already gone */
    }
    try {
      webgl?.dispose();
    } catch {
      /* the renderer may already be gone */
    }
    try {
      term?.dispose();
    } catch {
      /* xterm 5.3 can throw while tearing down a renderer */
    }
    webgl = null;
    term = null;
    fitAddon = null;
  }

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

  function openSelect() {
    if (!term) return;
    const buf = term.buffer.active;
    selectText = bufferText((i) => buf.getLine(i)?.translateToString(true), buf.length);
  }

  function toggleBell() {
    bell = !bell;
    setBellEnabled(bell);
    if (bell) unlockAudio();
  }

  const area = () => term?.textarea ?? null;

  /** Brings the system keyboard back. iOS keeps focus on the field when the user hides the keyboard, so a plain
   *  focus() does nothing; blur first, inside the tap, and focus again. */
  function showSystemKeyboard() {
    const a = area();
    if (!a) return;
    a.setAttribute('inputmode', 'text');
    a.blur();
    a.focus();
  }

  function focusTerminal() {
    if (fnOpen) return term?.focus();
    showSystemKeyboard();
  }

  function openFn() {
    const a = area();
    if (!a) return;
    fnOpen = true;
    a.setAttribute('inputmode', 'none'); // focused, but the system keyboard stays away
    a.blur();
    a.focus();
  }

  function closeFn() {
    fnOpen = false;
    showSystemKeyboard();
  }

  function toggleFn() {
    if (fnOpen) closeFn();
    else openFn();
  }

  /** The keyboard button in the status bar: hide the system keyboard when it is up, show it when it is not. */
  function toggleKeyboard() {
    if (fnOpen) return closeFn();
    const a = area();
    const vv = window.visualViewport;
    const up = !!vv && window.innerHeight - vv.height > 150;
    if (up && document.activeElement === a) a?.blur();
    else showSystemKeyboard();
  }

  // --- touch selection -------------------------------------------------------------------------------
  const screenRect = () => terminalContainer?.querySelector('.xterm-screen')?.getBoundingClientRect() ?? null;

  function cellFor(e: { clientX: number; clientY: number }): Cell | null {
    const r = screenRect();
    if (!r || !term) return null;
    return cellAt(e.clientX, e.clientY, r, term.cols, term.rows, term.buffer.active.viewportY);
  }

  function applySel() {
    if (!sel || !term) return;
    const [start, end] = ordered(sel.a, sel.b);
    const { col, row, length } = selectionArgs(start, end, term.cols);
    term.select(col, row, length);
  }

  function clearSel() {
    sel = null;
    selecting = false;
    dragHandle = null;
    term?.clearSelection();
  }

  function beginSelect() {
    pressTimer = null;
    const cell = term && cellFor({ clientX: pressAt.x, clientY: pressAt.y });
    if (!cell || !term) return;
    const text = term.buffer.active.getLine(cell.row)?.translateToString(true) ?? '';
    const w = wordRange(text, cell.col);
    sel = { a: { col: w.start, row: cell.row }, b: { col: w.end, row: cell.row } };
    selecting = true;
    applySel();
    navigator.vibrate?.(12);
  }

  function selectMove(e: PointerEvent) {
    if (!sel) return;
    const cell = cellFor(e);
    if (!cell) return;
    if (dragHandle) sel = { ...sel, [dragHandle]: cell };
    else if (selecting) sel = { ...sel, b: cell };
    else return;
    applySel();
  }

  function handleDown(which: 'a' | 'b', e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    dragHandle = which;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  async function copySelection() {
    const text = term?.getSelection() ?? '';
    selStatus = text && (await copyText(text)) ? 'Copied' : 'Nothing to copy';
    setTimeout(() => (selStatus = ''), 1500);
    if (text) clearSel();
  }

  /** Pixel position of a selection end inside the screen box, or null when it is scrolled out of view. */
  function endBox(which: 'a' | 'b') {
    const r = screenRect();
    const host = terminalContainer?.getBoundingClientRect();
    if (!sel || !term || !r || !host) return null;
    const [start, end] = ordered(sel.a, sel.b);
    const cell = which === 'a' ? start : end;
    const box = cellBox(cell, r, term.cols, term.rows, term.buffer.active.viewportY);
    return box && { x: box.x + (r.left - host.left) + (which === 'b' ? box.w : 0), y: box.y + (r.top - host.top) + box.h };
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
    if (pointers.size === 2) {
      pinchStart = { dist: spread(), font: fontSize };
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    } else if (e.pointerType === 'touch' && !dragHandle) {
      pressAt = { x: e.clientX, y: e.clientY };
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(beginSelect, 450);
    }
  }
  function pointerMove(e: PointerEvent) {
    if (pressTimer && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) {
      clearTimeout(pressTimer); // the finger moved: a scroll, not a long press
      pressTimer = null;
    }
    selectMove(e);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart && pinchStart.dist > 0) {
      const next = pinchFont(pinchStart.font, spread() / pinchStart.dist);
      if (next !== fontSize) setFont(next);
    }
  }
  function pointerUp(e: PointerEvent) {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    selecting = false;
    dragHandle = null;
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
      gl.onContextLoss(() => {
        try {
          gl.dispose();
        } catch {
          /* xterm 5.3 can throw while swapping renderers; the screen keeps its last frame until the next redraw */
        }
        if (webgl === gl) webgl = null;
      });
      term.loadAddon(gl);
      webgl = gl;
    } catch {
      /* DOM renderer */
    }
    fitAddon.fit();

    if (term.textarea) {
      stopLog = attachInputLogger(term.textarea);
      // iOS swipe typing: choosing another suggestion replaces the word xterm already sent (fact 0027).
      const area = term.textarea;
      const onReplace = (e: Event) => {
        const data = replacementData(e as InputEvent);
        if (data !== null) sendInput(replacementKeys(area.value, area.selectionStart, area.selectionEnd, data));
      };
      area.addEventListener('beforeinput', onReplace, true);
      stopReplace = () => area.removeEventListener('beforeinput', onReplace, true);
    }
    window.addEventListener('termanch-debug', syncDebug);
    term.onData((data) => typed(data));
    // While selecting, the finger must not scroll the page or the terminal.
    terminalContainer.addEventListener('touchmove', (ev) => (selecting || dragHandle) && ev.preventDefault(), { passive: false });
    term.onScroll(() => (sel = sel)); // handles follow their text
    term.onBell(() => bell && beep());
    if (term.textarea) {
      // The keyboard's return key says "return", not "OK/Done", and a tap on it must not drop the keyboard.
      term.textarea.setAttribute('enterkeyhint', 'enter');
      const area = term.textarea;
      const noteEnter = (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as InputEvent).inputType === 'insertLineBreak') lastEnter = performance.now();
      };
      const keepFocus = () => {
        // iOS blurs the field when its Done/OK key is used; right after an Enter, take the focus back.
        if (!disposed && performance.now() - lastEnter < 600) setTimeout(() => !disposed && term?.focus(), 0);
      };
      area.addEventListener('keydown', noteEnter, true);
      area.addEventListener('beforeinput', noteEnter, true);
      area.addEventListener('blur', keepFocus);
    }
    term.onResize(({ cols, rows }) => sendResize(cols, rows));

    resizeObserver = new ResizeObserver(() => {
      if (disposed || !term) return;
      try {
        fitAddon?.fit();
      } catch {
        return; // mid-teardown or a renderer swap; the next resize fits again
      }
      sendResize(term.cols, term.rows);
    });
    resizeObserver.observe(terminalContainer);

    unsubscribe = connection.subscribe((msg) => {
      if (msg.type === 'output') {
        term?.write(b64ToBytes(msg.data));
      } else if (msg.type === 'session_attached') {
        // tmux repaints the screen on attach; start clean so a re-attach never doubles the content.
        term?.reset();
        if (term) sendResize(term.cols, term.rows);
        term?.focus(); // connecting lands in a live terminal
      }
    });

    qualityTimer = setInterval(() => {
      const kind = connection.kind;
      quality = kind ? `${kind === 'rtc' ? 'direct' : 'relay'}${connection.rtt != null ? ` · ${connection.rtt} ms` : ''}` : '';
    }, 1000);

    return teardown;
  });
</script>

<div class="wrap">
  {#if debug}<InputLog />{/if}
  <div class="screenbox">
  <div
    class="screen"
    bind:this={terminalContainer}
    on:click={() => {
      if (sel) clearSel();
      else focusTerminal();
    }}
    on:pointerdown={(e) => {
      unlockAudio();
      pointerDown(e);
    }}
    on:pointermove={pointerMove}
    on:pointerup={pointerUp}
    on:pointercancel={pointerUp}
  ></div>
  {#if sel && !selecting}
    {@const a = endBox('a')}
    {@const b = endBox('b')}
    <div class="selbar">
      <button type="button" on:click={copySelection}>Copy</button>
      <button type="button" class="secondary" on:click={clearSel}>Done</button>
    </div>
    {#if a}<button type="button" class="handle" aria-label="Selection start" style="left: {a.x}px; top: {a.y}px;" on:pointerdown={(e) => handleDown('a', e)} on:pointermove={selectMove} on:pointerup={pointerUp}></button>{/if}
    {#if b}<button type="button" class="handle" aria-label="Selection end" style="left: {b.x}px; top: {b.y}px;" on:pointerdown={(e) => handleDown('b', e)} on:pointermove={selectMove} on:pointerup={pointerUp}></button>{/if}
  {/if}
  {#if selStatus}<div class="selstatus">{selStatus}</div>{/if}
  </div>
  <div class="status" aria-live="polite">
    <span class="dot" class:ok={connState === 'connected'}></span>
    {connState === 'connected' ? quality || 'connected' : connState}
    <span class="spacer"></span>
    <button class="font" aria-label="Show or hide the keyboard" on:pointerdown|preventDefault={toggleKeyboard}>⌨</button>
    <button class="font" aria-label={bell ? 'Mute bell' : 'Unmute bell'} aria-pressed={bell} on:pointerdown|preventDefault={toggleBell}>{bell ? '🔔' : '🔕'}</button>
    <button class="font" aria-label="Smaller text" on:pointerdown|preventDefault={() => setFont(fontSize - 1)}>A−</button>
    <button class="font" aria-label="Larger text" on:pointerdown|preventDefault={() => setFont(fontSize + 1)}>A+</button>
  </div>
  <KeyRow bind:mods onkey={sendInput} onpaste={paste} oncopy={copy} onselect={openSelect} {fnOpen} onfn={toggleFn} />
  {#if fnOpen}<FnKeyboard bind:mods onkey={typed} onback={closeFn} />{/if}
  {#if selectText !== null}<SelectView text={selectText} onclose={() => { selectText = null; term?.focus(); }} />{/if}
</div>

<style>
  .wrap {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .screenbox {
    position: relative; /* the selection bar and handles are placed against the screen */
    flex: 1;
    min-height: 0;
  }
  .screen {
    height: 100%;
    touch-action: pan-y; /* vertical scroll stays native; the two-finger pinch is ours */
  }
  .selbar {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 5;
    display: flex;
    gap: 6px;
  }
  .selbar button {
    min-height: 34px;
    padding: 4px 14px;
  }
  .selstatus {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 5;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 0.8rem;
  }
  .handle {
    position: absolute;
    z-index: 5;
    width: 28px;
    height: 28px;
    margin: -4px 0 0 -14px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--bg);
    background: var(--accent);
    touch-action: none;
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