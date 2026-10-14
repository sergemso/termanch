<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal as XTermTerminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebglAddon } from 'xterm-addon-webgl';
  import 'xterm/css/xterm.css';

  import type { HubConnection, ServerState } from './lib/hub';
  import { b64ToBytes, textToB64 } from './lib/connection';
  import { applyMods, bufferText, clampFont, FONT_DEFAULT, prefixBytes, type KeyProfile, type Mods } from './lib/keys';
  import { beep, bellEnabled, installAudioUnlock, setBellEnabled, unlockAudio } from './lib/bell';
  import { copyText } from './lib/clipboard';
  import { attachInputLogger } from './lib/inputlog';
  import { attachInputMirror, attachSwipeSupport } from './lib/swipe';
  import { DEBUG_KEY, debugEnabled } from './lib/viewport';
  import { KeyboardMode } from './lib/terminal/keyboardMode';
  import { crumb } from './lib/breadcrumbs';
  import { dropColorReplies, setEnterKeyHint, silenceColorQueries } from './lib/terminal/inputGuards';
  import { WordTracker } from './lib/terminal/wordTracker';
  import { PinchZoom } from './lib/terminal/pinch';
  import { InputBatcher } from './lib/terminal/inputBatch';
  import { TouchScroll } from './lib/terminal/touchScroll';
  import { FONT_FAMILY, terminalTheme } from './lib/terminal/theme';
  import { TouchSelection, type Selection } from './lib/terminal/touchSelection';
  import { settings } from './lib/settings';
  import KeyRow from './KeyRow.svelte';
  import FnKeyboard from './FnKeyboard.svelte';
  import InputLog from './InputLog.svelte';
  import SelectView from './SelectView.svelte';

  export let connection: HubConnection;
  export let activeSessionId: string | null = null;
  export let connState: ServerState = 'connected';
  /** `tmux` adds the Prefix key to the key row; `prefix` is tmux's own notation for it (`C-b`). */
  export let profile: KeyProfile = 'shell';
  export let prefix = 'C-b';
  /** The last screen seen for this session (a peek): drawn dimmed until the live repaint replaces it. */
  export let preview: string | null = null;

  const FONT_KEY = 'termanch_font';
  let mods: Mods = { ctrl: false, alt: false };
  let fontSize = clampFont(Number(localStorage.getItem(FONT_KEY)) || FONT_DEFAULT);
  let prefixArmed = false;
  let previewing = false;
  let selectText: string | null = null;
  let bell = bellEnabled();
  let fnOpen = false;
  let sel: Selection | null = null;
  let selStatus = '';
  let debug = debugEnabled(location.search, localStorage.getItem(DEBUG_KEY));
  const syncDebug = () => (debug = debugEnabled(location.search, localStorage.getItem(DEBUG_KEY)));

  let terminalContainer: HTMLDivElement;
  let term: XTermTerminal | null = null;
  let fitAddon: FitAddon | null = null;
  let webgl: WebglAddon | null = null;
  let disposed = false;
  /** Everything to undo on teardown, in the order it was set up. */
  const cleanups: (() => void)[] = [];

  // --- controllers: each owns one concern and is tested on its own (src/lib/terminal) -------------------
  const pinch = new PinchZoom();
  const words = new WordTracker();
  const keyboard = new KeyboardMode({
    field: () => term?.textarea ?? null,
    isFocused: () => document.activeElement === term?.textarea,
    isSystemKeyboardUp: () => !!window.visualViewport && window.innerHeight - window.visualViewport.height > 150,
    onFnChange: (open) => (fnOpen = open),
  });
  /** The next `touchend` follows a gesture handled here (a tap or a scroll): keep the browser's own click away. */
  let suppressClick = false;
  const scroll = new TouchScroll({
    rowHeight: () => (terminalContainer?.querySelector('.xterm-screen')?.getBoundingClientRect().height ?? 0) / (term?.rows || 1) || 18,
    wheel: (dy, x, y) => {
      suppressClick = true;
      term?.element?.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaMode: WheelEvent.DOM_DELTA_PIXEL, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    },
    tap: (x, y) => tapAt(x, y),
  });
  const touch = new TouchSelection({
    term: () => term,
    screenRect: () => terminalContainer?.querySelector('.xterm-screen')?.getBoundingClientRect() ?? null,
    hostRect: () => terminalContainer?.getBoundingClientRect() ?? null,
    onChange: (s) => (sel = s),
    vibrate: () => navigator.vibrate?.(12),
  });

  /** Runs once: the WebGL addon goes before the terminal (the other order throws), and nothing here may throw. */
  function teardown() {
    if (disposed) return;
    disposed = true;
    for (const undo of cleanups.splice(0).reverse()) {
      try {
        undo();
      } catch {
        /* already gone */
      }
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

  const batch = new InputBatcher((data) => {
    if (activeSessionId) connection.send({ type: 'input', data: textToB64(data) });
  });
  function sendInput(data: string) {
    batch.add(data);
  }

  /** The sticky Prefix key: the next key goes out behind tmux's prefix, once. */
  function withPrefix(data: string): string {
    if (!prefixArmed) return data;
    prefixArmed = false;
    return prefixBytes(prefix) + data;
  }

  function combo(key: string) {
    prefixArmed = false;
    sendInput(prefixBytes(prefix) + key);
  }

  /** Draws a peeked screen at once, dimmed; the repaint after attach clears it (decision 0084). */
  function paintPreview(text: string) {
    if (!term || previewing) return;
    previewing = true;
    term.reset();
    term.write(text.replace(/\r?\n/g, '\r\n'));
  }
  $: if (term && preview && !previewing) paintPreview(preview);
  $: if (!preview) previewing = false;

  /** Typed characters pass through the sticky Ctrl/Alt; key-row sequences are sent as they are. */
  function typed(raw: string) {
    const data = dropColorReplies(raw);
    if (!data) return;
    const { out, used } = applyMods(data, mods);
    if (used) mods = { ctrl: false, alt: false };
    words.feed(out);
    sendInput(withPrefix(out));
  }

  /** Key-row keys: sent as they are, but the word being typed must know about them. */
  function sendKey(data: string) {
    words.feed(data);
    sendInput(withPrefix(data));
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
    await copyText(text);
  }

  function openSelect() {
    if (!term) return;
    const buf = term.buffer.active;
    selectText = bufferText((i) => buf.getLine(i)?.translateToString(true), buf.length);
  }

  async function copySelection() {
    const text = touch.text();
    selStatus = text && (await copyText(text)) ? 'Copied' : 'Nothing to copy';
    setTimeout(() => (selStatus = ''), 1500);
    if (text) touch.clear();
  }

  function toggleBell() {
    bell = !bell;
    setBellEnabled(bell);
    if (bell) {
      unlockAudio();
      beep(); // doubles as a sound check
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

  /**
   * A tap is sent as the app would see a mouse click: a move, a press, a short pause, a release. The browser's own
   * compatibility events press and release in the same millisecond, which mouse-first apps like herdr ignore.
   */
  function tapAt(x: number, y: number) {
    suppressClick = true;
    if (sel) {
      touch.clear();
      return;
    }
    const target = document.elementFromPoint(x, y) ?? terminalContainer;
    const fire = (type: string, buttons: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons }));
    fire('mousemove', 0);
    fire('mousedown', 1);
    setTimeout(() => fire('mouseup', 0), 40);
    keyboard.tap();
  }
  function onPointerDown(e: PointerEvent) {
    pinch.down(e.pointerId, e.clientX, e.clientY, fontSize);
    touch.pointerDown(e.clientX, e.clientY, { touch: e.pointerType === 'touch', second: pinch.fingers > 1 });
    if (e.pointerType === 'touch') scroll.down(e.pointerId, e.clientX, e.clientY, pinch.fingers > 1 || !!sel);
  }
  function onPointerMove(e: PointerEvent) {
    touch.pointerMove(e.clientX, e.clientY);
    const next = pinch.move(e.pointerId, e.clientX, e.clientY);
    if (next !== null && next !== fontSize) setFont(next);
    if (e.pointerType === 'touch' && !touch.busy && !sel) scroll.move(e.pointerId, e.clientX, e.clientY);
  }
  function onPointerUp(e: PointerEvent) {
    touch.pointerUp();
    pinch.up(e.pointerId);
    if (e.pointerType === 'touch') scroll.up(e.pointerId, e.type === 'pointercancel');
  }
  function grabHandle(end: 'a' | 'b', e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    touch.grab(end);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function sendResize(cols: number, rows: number) {
    crumb(`resize ${cols}x${rows}`);
    batch.flush(); // typed text goes out before the new size, as it was typed
    if (activeSessionId) connection.send({ type: 'resize', cols, rows });
  }

  /**
   * Fits the terminal to its box. While xterm swaps renderers (a lost WebGL context) the fit throws, and no later
   * resize comes to repeat it: the canvas stayed at its old size and sat shifted to the left (issue #99). So a
   * failed fit is tried again on the next frames.
   */
  let refitFrame = 0;
  function refit(attempt = 0) {
    cancelAnimationFrame(refitFrame);
    if (disposed || !term) return;
    try {
      fitAddon?.fit();
    } catch {
      if (attempt < 20) refitFrame = requestAnimationFrame(() => refit(attempt + 1));
      return;
    }
    sendResize(term.cols, term.rows);
  }

  $: if (term && $settings) term.options.theme = terminalTheme(document.documentElement.dataset.theme === 'light');

  onMount(() => {
    term = new XTermTerminal({ cursorBlink: true, fontSize, fontFamily: FONT_FAMILY, theme: terminalTheme(document.documentElement.dataset.theme === 'light') });
    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);
    const themeObserver = new MutationObserver(() => {
      if (term) term.options.theme = terminalTheme(document.documentElement.dataset.theme === 'light');
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(() => themeObserver.disconnect());
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
        crumb('renderer lost');
        refit();
      });
      term.loadAddon(gl);
      webgl = gl;
    } catch {
      /* DOM renderer */
    }
    fitAddon.fit();

    cleanups.push(installAudioUnlock());
    if (term.textarea) {
      cleanups.push(attachInputLogger(term.textarea));
      cleanups.push(attachSwipeSupport(term.textarea, sendInput, words)); // fact 0027
      cleanups.push(attachInputMirror(term.textarea, words)); // the field always shows the word being typed
      setEnterKeyHint(term.textarea);
      // Hiding the keyboard (OK, or its own hide key) must not leave the terminal inactive.
      const onBlur = (e: FocusEvent) => !disposed && keyboard.onBlur({ to: e.relatedTarget });
      term.textarea.addEventListener('blur', onBlur);
      const field = term.textarea;
      cleanups.push(() => field.removeEventListener('blur', onBlur));
    }
    window.addEventListener('termanch-debug', syncDebug);
    cleanups.push(() => window.removeEventListener('termanch-debug', syncDebug));

    cleanups.push(silenceColorQueries(term.parser).dispose);
    term.onData((data) => typed(data));
    term.onBell(() => bell && beep());
    term.onScroll(() => touch.refresh()); // handles follow their text
    term.onResize(({ cols, rows }) => sendResize(cols, rows));
    // While selecting, the finger must not scroll the page or the terminal.
    const blockScroll = (ev: TouchEvent) => touch.busy && ev.preventDefault();
    terminalContainer.addEventListener('touchmove', blockScroll, { passive: false });
    cleanups.push(() => terminalContainer.removeEventListener('touchmove', blockScroll));
    // A tap or scroll handled above must not also arrive as the browser's own mouse events and click.
    const swallowClick = (ev: TouchEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      ev.preventDefault();
    };
    terminalContainer.addEventListener('touchend', swallowClick, { passive: false });
    cleanups.push(() => terminalContainer.removeEventListener('touchend', swallowClick));
    cleanups.push(() => scroll.stopFling());
    cleanups.push(() => cancelAnimationFrame(refitFrame));

    const resizeObserver = new ResizeObserver(() => refit());
    resizeObserver.observe(terminalContainer);
    cleanups.push(() => resizeObserver.disconnect());

    cleanups.push(
      connection.subscribe((msg) => {
        if (msg.type === 'output') {
          term?.write(b64ToBytes(msg.data));
        } else if (msg.type === 'session_attached') {
          // tmux repaints the screen on attach; start clean so a re-attach never doubles the content.
          previewing = false;
          crumb('attached');
          term?.reset();
          refit();
          // Connecting lands in a live terminal. The page must not scroll to the field to do it.
          if (term?.textarea) term.textarea.focus({ preventScroll: true });
          else term?.focus();
        }
      }),
    );

    return teardown;
  });
</script>

<div class="wrap">
  {#if debug}<InputLog />{/if}
  <div class="screenbox">
    <div
      class="screen"
      class:previewing
      bind:this={terminalContainer}
      on:click={() => (sel ? touch.clear() : keyboard.tap())}
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerUp}
    ></div>
    {#if sel && !sel.dragging}
      {@const a = (sel, touch.handlePosition('a'))}
      {@const b = (sel, touch.handlePosition('b'))}
      <div class="selbar">
        <button type="button" on:mousedown|preventDefault on:click={copySelection}>Copy</button>
        <button type="button" class="secondary" on:mousedown|preventDefault on:click={() => touch.clear()}>Done</button>
      </div>
      {#if a}<button type="button" class="handle" aria-label="Selection start" style="left: {a.x}px; top: {a.y}px;" on:pointerdown={(e) => grabHandle('a', e)} on:pointermove={onPointerMove} on:pointerup={onPointerUp}></button>{/if}
      {#if b}<button type="button" class="handle" aria-label="Selection end" style="left: {b.x}px; top: {b.y}px;" on:pointerdown={(e) => grabHandle('b', e)} on:pointermove={onPointerMove} on:pointerup={onPointerUp}></button>{/if}
    {/if}
    {#if selStatus}<div class="selstatus">{selStatus}</div>{/if}
    {#if connState !== 'connected'}<div class="connstate" role="status">{connState}</div>{/if}
  </div>
  <KeyRow bind:mods bind:prefixArmed {profile} {bell} oncombo={combo} onkey={sendKey} onpaste={paste} oncopy={copy} onselect={openSelect} {fnOpen} onfn={() => keyboard.toggleFn()}
    onkeyboard={() => keyboard.toggleSystem()} onbell={toggleBell} onfont={(d) => setFont(fontSize + d)} />
  {#if fnOpen}<FnKeyboard bind:mods onkey={typed} onback={() => keyboard.closeFn()} />{/if}
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
    touch-action: none; /* one-finger drag and tap, and the two-finger pinch, are all ours (TouchScroll, PinchZoom) */
  }
  .screen :global(.xterm-viewport),
  .screen :global(.xterm-screen) {
    touch-action: none;
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
  .connstate {
    position: absolute;
    bottom: 6px;
    right: 6px;
    z-index: 5;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--danger);
    font-size: 0.75rem;
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
  .screen.previewing {
    opacity: 0.55;
  }
  :global(.xterm) {
    height: 100% !important;
  }
  :global(.xterm-helper-textarea) {
    opacity: 0 !important;
    font-size: 16px !important; /* iOS zooms the whole page into a focused field under 16px; pinching back was the only cure (#99) */
  }
</style>
