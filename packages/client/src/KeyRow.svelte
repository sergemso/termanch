<script lang="ts">
  import { KEYS, type Mods } from './lib/keys';

  export let mods: Mods;
  export let onkey: (data: string) => void;
  export let onpaste: () => void;
  export let oncopy: () => void;
  export let onselect: () => void = () => {};

  /** Fn opens the on-screen function keyboard in place of the system keyboard. */
  export let fnOpen = false;
  export let onfn: () => void = () => {};

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
  <button class="k mod" class:on={mods.ctrl} aria-pressed={mods.ctrl} on:pointerdown={tap(() => (mods.ctrl = !mods.ctrl))}>Ctrl</button>
  <button class="k mod" class:on={mods.alt} aria-pressed={mods.alt} on:pointerdown={tap(() => (mods.alt = !mods.alt))}>Alt</button>
  <button class="k mod" class:on={fnOpen} aria-pressed={fnOpen} on:pointerdown={tap(onfn)}>Fn</button>
  {#each keys as [label, seq]}
    <button class="k" on:pointerdown={tap(() => onkey(seq))}>{label}</button>
  {/each}
  <button class="k" on:pointerdown={tap(onpaste)}>Paste</button>
  <button class="k" on:pointerdown={tap(oncopy)}>Copy</button>
  <button class="k" on:pointerdown={tap(onselect)}>Select</button>
</div>

<style>
  .row {
    display: flex;
    gap: 6px;
    padding: 6px 8px 6px;
    overflow-x: auto;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  .k {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 40px;
    padding: 0 12px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    font-weight: 500;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
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
