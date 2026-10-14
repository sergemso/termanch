<script lang="ts">
  import { KEYS, TMUX_COMBOS, type KeyProfile, type Mods } from './lib/keys';

  export let mods: Mods;
  export let onkey: (data: string) => void;
  export let onpaste: () => void;
  export let oncopy: () => void;
  export let onselect: () => void = () => {};

  /** Fn opens the on-screen function keyboard in place of the system keyboard. */
  export let fnOpen = false;
  export let onfn: () => void = () => {};

  /** `tmux` adds the sticky Prefix key; window moves are in the windows dropdown, not here. */
  export let profile: KeyProfile = 'shell';
  export let prefixArmed = false;
  /** The prefix as printed on a keycap (`^B`); shown on the Prefix key so it is clear what it sends. */
  export let prefixLabel = '';
  /** The multiline-input key: `newlineHint` names the combination it sends (Alt+Enter for Claude Code). */
  export let onnewline: () => void = () => {};
  export let newlineHint = 'Alt+Enter';
  export let oncombo: (key: string) => void = () => {};

  /** The controls the status bar used to hold (keyboard, bell, text size) now scroll with the keys. */
  export let bell = true;
  export let onkeyboard: () => void = () => {};
  export let onbell: () => void = () => {};
  export let onfont: (delta: number) => void = () => {};
  let combos = false;

  // pointerdown + preventDefault keeps focus on the terminal, so the soft keyboard stays open while keys are tapped.
  const tap = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    fn();
  };

  const keys: [string, string][] = [
    ['Esc', KEYS.esc],
    ['Tab', KEYS.tab],
    ['↑', KEYS.up],
    ['↓', KEYS.down],
    ['←', KEYS.left],
    ['→', KEYS.right],
    ['Home', KEYS.home],
    ['End', KEYS.end],
    ['|', '|'],
    ['~', '~'],
    ['/', '/'],
    ['-', '-'],
    ['^C', KEYS.ctrlC],
    ['^D', KEYS.ctrlD],
  ];
</script>

<div class="row" role="toolbar" aria-label="Terminal keys">
  {#if profile === 'tmux'}
    <button class="k mod" class:on={prefixArmed} aria-pressed={prefixArmed} aria-label={prefixLabel ? `tmux prefix ${prefixLabel}` : 'tmux prefix'} on:pointerdown={tap(() => (prefixArmed = !prefixArmed))}>{prefixLabel || 'Prefix'}</button>
    <button class="k mod" class:on={combos} aria-expanded={combos} aria-label="tmux commands" on:pointerdown={tap(() => (combos = !combos))}>⋯</button>
    {#if combos}
      {#each TMUX_COMBOS as [label, key]}
        <button class="k" on:pointerdown={tap(() => { oncombo(key); combos = false; })}>{label}</button>
      {/each}
    {/if}
  {/if}
  <button class="k" aria-label={`New line without sending (${newlineHint})`} on:pointerdown={tap(onnewline)}>↵</button>
  <button class="k mod" class:on={mods.ctrl} aria-pressed={mods.ctrl} on:pointerdown={tap(() => (mods.ctrl = !mods.ctrl))}>Ctrl</button>
  <button class="k mod" class:on={mods.alt} aria-pressed={mods.alt} on:pointerdown={tap(() => (mods.alt = !mods.alt))}>Alt</button>
  <button class="k mod" class:on={mods.shift} aria-pressed={!!mods.shift} on:pointerdown={tap(() => (mods.shift = !mods.shift))}>Shift</button>
  <button class="k mod" class:on={fnOpen} aria-pressed={fnOpen} on:pointerdown={tap(onfn)}>Fn</button>
  {#each keys as [label, seq]}
    <button class="k" on:pointerdown={tap(() => onkey(seq))}>{label}</button>
  {/each}
  <button class="k" on:pointerdown={tap(onpaste)}>Paste</button>
  <button class="k" on:pointerdown={tap(oncopy)}>Copy</button>
  <button class="k" on:pointerdown={tap(onselect)}>Select</button>
  <span class="sep" aria-hidden="true"></span>
  <button class="k" aria-label="Show or hide the keyboard" on:pointerdown={tap(onkeyboard)}>⌨</button>
  <button class="k" aria-label={bell ? 'Mute bell' : 'Unmute bell'} aria-pressed={bell} on:pointerdown={tap(onbell)}>{bell ? '🔔' : '🔕'}</button>
  <button class="k" aria-label="Smaller text" on:pointerdown={tap(() => onfont(-1))}>A−</button>
  <button class="k" aria-label="Larger text" on:pointerdown={tap(() => onfont(1))}>A+</button>
</div>

<style>
  .row {
    display: flex;
    gap: 6px;
    padding: 3px 8px;
    overflow-x: auto;
    overflow-y: hidden;
    /* Horizontal scroll only: no vertical drag, rubber-band or scroll chaining to the page. */
    touch-action: pan-x;
    overscroll-behavior: contain;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  .k {
    position: relative;
    flex: 0 0 auto;
    min-width: 34px;
    min-height: 34px;
    padding: 0 6px;
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
    inset: -5px -3px;
  }
  .sep { flex: 0 0 8px; }
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
