// The configurable key row (U07c): which keys show and in what order, per profile (shell or tmux), kept per device.
// The default is today's 16-key row; anything stored that does not validate falls back to it.
import { writable } from 'svelte/store';
import { KEY_BY_ID, type KeyDef, type KeyProfile } from './keys';

/** Today's row, left to right (the dictation keys appear only where the browser can dictate). */
export const DEFAULT_ROW: readonly string[] = [
  'slash', 'ctrlC', 'esc', 'newline', 'ctrl', 'alt', 'shift', 'tab', 'fn', 'up', 'down', 'keyboard', 'voice', 'voicelang', 'fontDown', 'fontUp',
];
const MINIMAL_ROW: readonly string[] = ['esc', 'ctrlC', 'tab', 'up', 'down', 'fn'];

export type Preset = 'default' | 'minimal' | 'custom';
export const PRESETS: readonly Preset[] = ['default', 'minimal', 'custom'];
export const PRESET_LABEL: Record<Preset, string> = { default: "Today's row", minimal: 'Minimal', custom: 'Custom' };
export interface RowSpec { preset: Preset; keys: string[] }
/** How the row shows where a physical keyboard is the main input. */
export type DesktopMode = 'auto' | 'full' | 'compact';
export const DESKTOP_MODES: readonly DesktopMode[] = ['auto', 'full', 'compact'];
export interface KeyRowConfig { shell: RowSpec; tmux: RowSpec; desktop: DesktopMode }

/** The tmux profile has the sticky prefix key in front. */
const withProfile = (keys: readonly string[], profile: KeyProfile): string[] => (profile === 'tmux' ? ['prefix', ...keys] : [...keys]);

export function presetKeys(preset: Exclude<Preset, 'custom'>, profile: KeyProfile): string[] {
  return withProfile(preset === 'minimal' ? MINIMAL_ROW : DEFAULT_ROW, profile);
}

export function defaultConfig(): KeyRowConfig {
  return {
    shell: { preset: 'default', keys: presetKeys('default', 'shell') },
    tmux: { preset: 'default', keys: presetKeys('default', 'tmux') },
    desktop: 'auto',
  };
}

/** The keys a profile's row shows, in order, with the ones that do not exist for it (the prefix in a shell) dropped. */
export function resolveRow(config: KeyRowConfig, profile: KeyProfile): string[] {
  const spec = config[profile];
  const ids = spec.preset === 'custom' ? spec.keys : presetKeys(spec.preset, profile);
  return ids.filter((id) => KEY_BY_ID.get(id)?.profile === undefined || KEY_BY_ID.get(id)?.profile === profile);
}

/** Keys that exist for this profile and this browser. */
export function available(profile: KeyProfile, voice: boolean): KeyDef[] {
  return [...KEY_BY_ID.values()].filter((k) => (k.profile === undefined || k.profile === profile) && (k.needs !== 'voice' || voice));
}

/** What the row cannot show now: the keys removed from it, then the ones in it that do not fit. Always reachable in More. */
export function moreKeys(rowIds: readonly string[], overflow: readonly string[], profile: KeyProfile, voice: boolean): KeyDef[] {
  const inRow = new Set(rowIds);
  const removed = available(profile, voice).filter((k) => !inRow.has(k.id));
  return [...overflow.map((id) => KEY_BY_ID.get(id)).filter((k): k is KeyDef => !!k), ...removed];
}

/**
 * Whether the row carries a More key: when keys do not fit, or when a key of today's row was removed, so the removed
 * key stays reachable. Today's row itself has none (its 16 keys are all there is).
 */
export function needsMore(rowIds: readonly string[], overflow: readonly string[], profile: KeyProfile, voice: boolean): boolean {
  if (overflow.length) return true;
  const inRow = new Set(rowIds);
  return available(profile, voice).some((k) => (DEFAULT_ROW.includes(k.id) || k.id === 'prefix') && !inRow.has(k.id));
}

/** The narrowest a key may get, and the gap and padding of the row, in px. Below this keys go to More. */
export const MIN_KEY_WIDTH = 18;
export const KEY_GAP = 2;
export const ROW_PADDING = 8;

/** How many keys fit across `width`; 0 or less means the width is not known yet, so everything is shown. */
export function capacity(width: number): number {
  if (width <= 0) return Infinity;
  return Math.max(1, Math.floor((width - ROW_PADDING + KEY_GAP) / (MIN_KEY_WIDTH + KEY_GAP)));
}

/** Splits the row so no key is narrower than the minimum; when some go to More, the More key takes the last slot. */
export function splitRow<T>(items: readonly T[], width: number): { shown: T[]; overflow: T[] } {
  const cap = capacity(width);
  if (items.length <= cap) return { shown: [...items], overflow: [] };
  const keep = Math.max(0, cap - 1);
  return { shown: items.slice(0, keep), overflow: items.slice(keep) };
}

/** Compact when a fine pointer (a mouse or trackpad) is the main input and the user has not said otherwise. */
export function rowMode(mode: DesktopMode, finePointer: boolean): 'full' | 'compact' {
  if (mode === 'full') return 'full';
  if (mode === 'compact') return 'compact';
  return finePointer ? 'compact' : 'full';
}

// ---- Editing: every change makes the row Custom, starting from what is showing.

export function moved(keys: readonly string[], index: number, by: -1 | 1): string[] {
  const to = index + by;
  if (index < 0 || index >= keys.length || to < 0 || to >= keys.length) return [...keys];
  const next = [...keys];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
export const removed = (keys: readonly string[], id: string): string[] => keys.filter((k) => k !== id);
export const added = (keys: readonly string[], id: string): string[] => (keys.includes(id) || !KEY_BY_ID.has(id) ? [...keys] : [...keys, id]);

// ---- Storage

const STORE_KEY = 'termenbox_keyrow';
const MAX_KEYS = 120;

function validSpec(raw: unknown): RowSpec | null {
  const s = raw as Partial<RowSpec> | null;
  if (!s || typeof s !== 'object' || !PRESETS.includes(s.preset as Preset) || !Array.isArray(s.keys)) return null;
  const keys = s.keys;
  if (keys.length === 0 || keys.length > MAX_KEYS) return null;
  if (!keys.every((k) => typeof k === 'string' && KEY_BY_ID.has(k))) return null;
  if (new Set(keys).size !== keys.length) return null;
  return { preset: s.preset as Preset, keys: [...keys] };
}

/** A stored value as a configuration; anything that is not exactly valid is the default. */
export function validateConfig(raw: unknown): KeyRowConfig {
  const c = raw as Partial<KeyRowConfig> | null;
  if (!c || typeof c !== 'object') return defaultConfig();
  const shell = validSpec(c.shell);
  const tmux = validSpec(c.tmux);
  if (!shell || !tmux || !DESKTOP_MODES.includes(c.desktop as DesktopMode)) return defaultConfig();
  return { shell, tmux, desktop: c.desktop as DesktopMode };
}

const storage = (): Storage | undefined => {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
};

export function loadKeyRow(store: Pick<Storage, 'getItem'> | undefined = storage()): KeyRowConfig {
  try {
    const text = store?.getItem(STORE_KEY);
    return text ? validateConfig(JSON.parse(text)) : defaultConfig();
  } catch { return defaultConfig(); }
}
export function saveKeyRow(value: KeyRowConfig, store: Pick<Storage, 'setItem'> | undefined = storage()) {
  try { store?.setItem(STORE_KEY, JSON.stringify(value)); } catch { /* Private mode: the row still works in memory. */ }
}

export const keyRowConfig = writable<KeyRowConfig>(loadKeyRow());
export function setKeyRow(next: KeyRowConfig) {
  const value = validateConfig(next);
  saveKeyRow(value);
  keyRowConfig.set(value);
}
/** Replaces one profile's row; `custom` carries the keys. */
export function setRow(profile: KeyProfile, spec: RowSpec) {
  keyRowConfig.update((c) => { const next = validateConfig({ ...c, [profile]: spec }); saveKeyRow(next); return next; });
}
export function setDesktopMode(desktop: DesktopMode) {
  keyRowConfig.update((c) => { const next = { ...c, desktop }; saveKeyRow(next); return next; });
}
export function resetRow(profile: KeyProfile) {
  keyRowConfig.update((c) => { const next = { ...c, [profile]: defaultConfig()[profile] }; saveKeyRow(next); return next; });
}
