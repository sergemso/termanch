<script lang="ts">
  import { KEYS, TMUX_COMBOS, type KeyProfile, type Mods } from './lib/keys';

  export let mods: Mods;
  export let onkey: (data: string) => void;
  export let onback: () => void;
  /** Moved here from the key row: clipboard, selection, bell and tmux commands. */
  export let profile: KeyProfile = 'shell';
  export let bell = true;
  export let onbell: () => void = () => {};
  export let oncombo: (key: string) => void = () => {};
  export let onpaste: () => void = () => {};
  export let oncopy: () => void = () => {};
  export let onselect: () => void = () => {};

  /** Two pages of a grid, so it fits where the system keyboard was. */
  let page: 'nav' | 'sym' | 'more' = 'nav';

  const tap = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault(); // keeps focus in the terminal's input
    fn();
  };

  type Key = [label: string, seq: string, wide?: boolean];
  const NAV: Key[][] = [
    [['F1', '\x1bOP'], ['F2', '\x1bOQ'], ['F3', '\x1bOR'], ['F4', '\x1bOS'], ['F5', '\x1b[15~'], ['F6', '\x1b[17~']],
    [['F7', '\x1b[18~'], ['F8', '\x1b[19~'], ['F9', '\x1b[20~'], ['F10', '\x1b[21~'], ['F11', '\x1b[23~'], ['F12', '\x1b[24~']],
    [['Esc', KEYS.esc], ['Tab', KEYS.tab], ['Home', KEYS.home], ['↑', KEYS.up], ['End', KEYS.end], ['PgUp', '\x1b[5~']],
    [['Ins', '\x1b[2~'], ['Del', '\x1b[3~'], ['←', KEYS.left], ['↓', KEYS.down], ['→', KEYS.right], ['PgDn', '\x1b[6~']],
  ];
  const SYM: Key[][] = [
    ...[
      ['{', '}', '[', ']', '(', ')'],
      ['<', '>', '\\', '`', '$', '&'],
      ['*', ';', '"', "'", '#', '@'],
      ['!', '=', '+', '_', '%', '^'],
      ['|', '~', '/', '-', ':', '?'],
    ].map((row) => row.map((c): Key => [c, c])),
  ];
  $: rows = page === 'nav' ? NAV : SYM;
  const CTRL_D: Key = ['^D', KEYS.ctrlD];
</script>

<div class="fnkb" role="group" aria-label="Function keyboard">
  <div class="tabs">
    <button class="k tab" class:on={page === 'nav'} on:pointerdown={tap(() => (page = 'nav'))}>Keys</button>
    <button class="k tab" class:on={page === 'sym'} on:pointerdown={tap(() => (page = 'sym'))}>Symbols</button>
    <button class="k tab" class:on={page === 'more'} on:pointerdown={tap(() => (page = 'more'))}>More</button>
  </div>
  <div class="grid">
    {#if page === 'more'}
      <button class="k" on:pointerdown={tap(onpaste)}>Paste</button>
      <button class="k" on:pointerdown={tap(oncopy)}>Copy</button>
      <button class="k" on:pointerdown={tap(onselect)}>Select</button>
      <button class="k" aria-label={bell ? 'Mute bell' : 'Unmute bell'} aria-pressed={bell} on:pointerdown={tap(onbell)}>{bell ? '🔔' : '🔕'}</button>
      <button class="k" on:pointerdown={tap(() => onkey(CTRL_D[1]))}>{CTRL_D[0]}</button>
      {#if profile === 'tmux'}
        {#each TMUX_COMBOS as [label, key]}
          <button class="k" on:pointerdown={tap(() => oncombo(key))}>{label}</button>
        {/each}
      {/if}
    {:else}
      {#each rows as row}
        {#each row as [label, seq]}
          <button class="k" class:sym={page === 'sym'} on:pointerdown={tap(() => onkey(seq))}>{label}</button>
        {/each}
      {/each}
    {/if}
  </div>
  <div class="bottom">
    <button class="k" on:pointerdown={tap(onback)} aria-label="Back to the system keyboard">ABC</button>
    <button class="k" class:on={mods.ctrl} aria-pressed={mods.ctrl} on:pointerdown={tap(() => (mods.ctrl = !mods.ctrl))}>Ctrl</button>
    <button class="k" class:on={mods.alt} aria-pressed={mods.alt} on:pointerdown={tap(() => (mods.alt = !mods.alt))}>Alt</button>
    <button class="k space" on:pointerdown={tap(() => onkey(' '))}>space</button>
    <button class="k" on:pointerdown={tap(() => onkey('\x7f'))} aria-label="Backspace">⌫</button>
    <button class="k" on:pointerdown={tap(() => onkey('\r'))} aria-label="Enter">⏎</button>
  </div>
</div>

<style>
  .fnkb {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: var(--kb-height, 280px);
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    box-sizing: border-box;
  }
  .tabs,
  .bottom {
    display: flex;
    gap: 6px;
  }
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-auto-rows: 1fr;
    gap: 6px;
  }
  .k {
    min-width: 0;
    min-height: 38px;
    padding: 0 4px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    font-weight: 500;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .k.sym {
    font-family: monospace;
    font-size: 1.1rem;
  }
  .k.on {
    background: var(--accent);
    color: var(--bg);
  }
  .tab {
    flex: 1;
    min-height: 32px;
  }
  .bottom .k {
    flex: 1;
  }
  .bottom .space {
    flex: 3;
  }
</style>
