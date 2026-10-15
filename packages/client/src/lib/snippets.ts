// Saved quick replies ("continue", "run the tests"), kept in this browser (plan v8, K.5).
const KEY = 'termenbox_snippets';
export const MAX_SNIPPETS = 20;
export const MAX_LEN = 200;
export const DEFAULTS = ['continue', 'run the tests', 'yes'];

export function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
}

export function load(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string').map(clean).filter(Boolean).slice(0, MAX_SNIPPETS);
  } catch {
    /* unreadable: start from the defaults */
  }
  return [...DEFAULTS];
}

export function save(list: string[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode: it lasts until the tab closes */
  }
}

export function add(list: string[], text: string): string[] {
  const t = clean(text);
  if (!t || list.includes(t)) return list;
  return [...list, t].slice(-MAX_SNIPPETS);
}

export function remove(list: string[], text: string): string[] {
  return list.filter((s) => s !== text);
}
