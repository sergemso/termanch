import { writable } from 'svelte/store';

export interface Settings { theme: 'dark' | 'light' | 'system'; cacheTtlMs: 300000 | 3600000 }
const KEY = 'termanch_settings';
const DEFAULT: Settings = { theme: 'dark', cacheTtlMs: 300000 };
const storage = () => typeof localStorage === 'undefined' ? undefined : localStorage;
export function loadSettings(store: Pick<Storage, 'getItem'> | undefined = storage()): Settings {
  try {
    const saved = JSON.parse(store?.getItem(KEY) ?? 'null');
    return { theme: ['dark', 'light', 'system'].includes(saved?.theme) ? saved.theme : DEFAULT.theme,
      cacheTtlMs: saved?.cacheTtlMs === 3600000 ? 3600000 : 300000 };
  } catch { return { ...DEFAULT }; }
}
export function saveSettings(value: Settings, store: Pick<Storage, 'setItem'> | undefined = storage()) {
  try { store?.setItem(KEY, JSON.stringify(value)); } catch { /* Private mode: settings still work in memory. */ }
}
export const settings = writable(loadSettings());
export function changeSettings(patch: Partial<Settings>) { settings.update(value => { const next = { ...value, ...patch }; saveSettings(next); return next; }); }
export function applyTheme(theme: Settings['theme'], prefersLight: boolean) {
  document.documentElement.dataset.theme = theme === 'system' ? (prefersLight ? 'light' : 'dark') : theme;
}
