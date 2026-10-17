<script lang="ts">
  // Settings for the terminal key row: which keys, in what order, presets, reset, and how a desktop shows it.
  // Everything is a button or a select, so it works without dragging.
  import { KEY_BY_ID, type KeyGroup, type KeyProfile } from './lib/keys';
  import { NativeSelect } from './lib/ui/native-select';
  import {
    DESKTOP_MODES, PRESETS, PRESET_LABEL, added, available, keyRowConfig, moved, presetKeys, removed, resetRow, resolveRow, setDesktopMode, setRow,
    type DesktopMode, type Preset,
  } from './lib/keyrow';

  let profile = $state<KeyProfile>('shell');
  const row = $derived(resolveRow($keyRowConfig, profile));
  const preset = $derived($keyRowConfig[profile].preset);
  const rest = $derived(available(profile, true).filter((k) => !row.includes(k.id)));
  const GROUPS: KeyGroup[] = ['Row', 'Control', 'Navigation', 'Function', 'Symbols'];
  const MODE_LABEL: Record<DesktopMode, string> = { auto: 'Auto (by pointer)', full: 'Full row', compact: 'Compact' };

  const edit = (keys: string[]) => setRow(profile, { preset: 'custom', keys });
  function choose(next: Preset) {
    setRow(profile, next === 'custom' ? { preset: 'custom', keys: row } : { preset: next, keys: presetKeys(next, profile) });
  }

  const btn = 'h-11 min-w-11 rounded-control border border-line bg-raised px-3 py-0 text-[13px] font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-text disabled:opacity-40';
  const seg = btn + ' aria-pressed:bg-accent aria-pressed:text-on-accent';
</script>

<section class="flex flex-col gap-3 [contain:inline-size]" aria-label="Key row">
  <h3 class="text-[15px] font-semibold">Key row</h3>
  <div class="flex gap-2" role="group" aria-label="Edit the row for">
    <button type="button" class={seg + ' flex-1'} aria-pressed={profile === 'shell'} onclick={() => (profile = 'shell')}>Shell</button>
    <button type="button" class={seg + ' flex-1'} aria-pressed={profile === 'tmux'} onclick={() => (profile = 'tmux')}>tmux</button>
  </div>
  <label class="flex items-center justify-between gap-2 text-[13px]">Preset
    <NativeSelect class="h-11 min-w-11" value={preset} onchange={(e) => choose(e.currentTarget.value as Preset)}>
      {#each PRESETS as p (p)}<option value={p}>{PRESET_LABEL[p]}</option>{/each}
    </NativeSelect>
  </label>

  <ol class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Keys in the row, in order">
    {#each row as id, i (id)}
      {@const k = KEY_BY_ID.get(id)}
      {#if k}
        <li class="flex items-center gap-2">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-control border border-line bg-bg text-[13px]" aria-hidden="true">{k.id === 'prefix' ? '^B' : k.label}</span>
          <span class="min-w-0 flex-1 truncate text-[13px]">{k.name}</span>
          <button type="button" class={btn} aria-label={`Move ${k.name} earlier`} disabled={i === 0} onclick={() => edit(moved(row, i, -1))}>↑</button>
          <button type="button" class={btn} aria-label={`Move ${k.name} later`} disabled={i === row.length - 1} onclick={() => edit(moved(row, i, 1))}>↓</button>
          <button type="button" class={btn} aria-label={`Remove ${k.name}`} disabled={row.length === 1} onclick={() => edit(removed(row, id))}>×</button>
        </li>
      {/if}
    {/each}
  </ol>
  <p class="text-xs text-soft">{row.length} keys. A key you remove stays under the ⋯ key on the row.</p>

  <details class="flex flex-col gap-2">
    <summary class="flex h-11 cursor-pointer items-center text-[13px] font-medium">Add a key</summary>
    {#each GROUPS as g (g)}
      {@const keys = rest.filter((k) => k.group === g)}
      {#if keys.length}
        <div role="group" aria-label={`Add: ${g}`} class="mb-2">
          <p class="mb-1 text-xs text-soft">{g === 'Row' ? 'Actions' : g}</p>
          <div class="flex flex-wrap gap-2">
            {#each keys as k (k.id)}
              <button type="button" class={btn} aria-label={`Add ${k.name}`} onclick={() => edit(added(row, k.id))}>{k.id === 'prefix' ? 'Prefix' : k.label}</button>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </details>

  <button type="button" class={btn + ' self-start'} onclick={() => resetRow(profile)}>Reset to today's row</button>

  <label class="flex items-center justify-between gap-2 text-[13px]">On a desktop
    <NativeSelect class="h-11 min-w-11" value={$keyRowConfig.desktop} onchange={(e) => setDesktopMode(e.currentTarget.value as DesktopMode)}>
      {#each DESKTOP_MODES as m (m)}<option value={m}>{MODE_LABEL[m]}</option>{/each}
    </NativeSelect>
  </label>
  <p class="text-xs text-soft">Auto shows one hint line instead of the row when a mouse or trackpad is the main pointer. Choose Full row to keep the keys on a touch laptop.</p>
</section>
