<script lang="ts">
  import { KEYS, type KeyProfile, type Mods } from './lib/keys';

  export let mods: Mods;
  export let onkey: (data: string) => void;

  /** Fn opens the on-screen function keyboard in place of the system keyboard. */
  export let fnOpen = false;
  export let onfn: () => void = () => {};

  /** `tmux` adds the sticky prefix key, labelled with the prefix as printed on a keycap (`^B`). */
  export let profile: KeyProfile = 'shell';
  export let prefixArmed = false;
  export let prefixLabel = '';
  /** The multiline-input key: `newlineHint` names the combination it sends (Alt+Enter for Claude Code). */
  export let onnewline: () => void = () => {};
  export let newlineHint = 'Alt+Enter';

  export let onkeyboard: () => void = () => {};
  export let onfont: (delta: number) => void = () => {};

  // pointerdown + preventDefault keeps focus on the terminal, so the soft keyboard stays open while keys are tapped.
  const tap = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    fn();
  };
</script>

<!-- One row that fits the screen width. Everything else (arrows, Home/End, symbols, Paste, Copy, Select, bell, tmux commands) is in the Fn panel. -->
<div class="row" role="toolbar" aria-label="Terminal keys">
  {#if profile === 'tmux'}
    <button class="k mod" class:on={prefixArmed} aria-pressed={prefixArmed} aria-label={prefixLabel ? `tmux prefix ${prefixLabel}` : 'tmux prefix'} on:pointerdown={tap(() => (prefixArmed = !prefixArmed))}>{prefixLabel || 'Prefix'}</button>
  {/if}
  <button class="k" on:pointerdown={tap(() => onkey('/'))}>/</button>
  <button class="k" aria-label="Control C" on:pointerdown={tap(() => onkey(KEYS.ctrlC))}>^C</button>
  <button class="k" aria-label="Escape" on:pointerdown={tap(() => onkey(KEYS.esc))}>⎋</button>
  <button class="k" aria-label={`New line without sending (${newlineHint})`} on:pointerdown={tap(onnewline)}>↵</button>
  <button class="k mod" class:on={mods.ctrl} aria-pressed={mods.ctrl} aria-label="Ctrl" on:pointerdown={tap(() => (mods.ctrl = !mods.ctrl))}>⌃</button>
  <button class="k mod" class:on={mods.alt} aria-pressed={mods.alt} aria-label="Alt" on:pointerdown={tap(() => (mods.alt = !mods.alt))}>⌥</button>
  <button class="k mod" class:on={mods.shift} aria-pressed={!!mods.shift} aria-label="Shift" on:pointerdown={tap(() => (mods.shift = !mods.shift))}>⇧</button>
  <button class="k" aria-label="Tab" on:pointerdown={tap(() => onkey(KEYS.tab))}>⇥</button>
  <button class="k mod" class:on={fnOpen} aria-pressed={fnOpen} aria-label="Fn" on:pointerdown={tap(onfn)}>Fn</button>
  <button class="k" aria-label="Arrow up" on:pointerdown={tap(() => onkey(KEYS.up))}>↑</button>
  <button class="k" aria-label="Arrow down" on:pointerdown={tap(() => onkey(KEYS.down))}>↓</button>
  <button class="k" aria-label="Show or hide the keyboard" on:pointerdown={tap(onkeyboard)}>⌨</button>
  <button class="k small" aria-label="Smaller text" on:pointerdown={tap(() => onfont(-1))}>A−</button>
  <button class="k small" aria-label="Larger text" on:pointerdown={tap(() => onfont(1))}>A+</button>
</div>

<style>
  .row {
    display: flex;
    gap: 2px;
    padding: 3px 4px;
    overflow: hidden;
    /* Fifteen keys share the width, so there is nothing to scroll; a drag must not move the page either. */
    touch-action: none;
    overscroll-behavior: contain;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .k {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    min-height: 34px;
    padding: 0;
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    font-weight: 500;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  /* The key looks 34 px tall; the touch target is still 44 px. */
  .k::after {
    content: '';
    position: absolute;
    inset: -5px -1px;
  }
  .small { font-size: 0.7rem; }
  .k.on {
    background: var(--accent);
    color: var(--bg);
  }
  @media (hover: hover) {
    .k:hover:not(:disabled):not(.on) {
      background: var(--border);
    }
    .k.on:hover:not(:disabled) {
      background: var(--accent);
    }
  }
</style>
