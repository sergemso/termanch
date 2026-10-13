// Soft-keyboard helpers: the key row's sequences, sticky Ctrl/Alt, and pinch-to-zoom font sizing.

export const KEYS = {
  esc: '\x1b',
  tab: '\t',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  home: '\x1b[H',
  end: '\x1b[F',
  ctrlC: '\x03',
  ctrlD: '\x04',
} as const;

export interface Mods {
  ctrl: boolean;
  alt: boolean;
}

/**
 * Applies the sticky modifiers to what the soft keyboard just produced. Only a single typed character is
 * transformed (a paste or an escape sequence passes through); `used` tells the caller to clear the modifiers.
 */
export function applyMods(data: string, mods: Mods): { out: string; used: boolean } {
  if (!(mods.ctrl || mods.alt) || [...data].length !== 1) return { out: data, used: false };
  let ch = data;
  if (mods.ctrl) {
    const code = data.toUpperCase().charCodeAt(0);
    if (code >= 0x40 && code <= 0x5f) ch = String.fromCharCode(code & 0x1f); // A-Z @ [ \ ] ^ _
    else if (data === ' ') ch = '\0';
    else if (data === '?') ch = '\x7f';
  }
  return { out: mods.alt ? '\x1b' + ch : ch, used: true };
}

export const FONT_MIN = 9;
export const FONT_MAX = 28;
export const FONT_DEFAULT = 14;

export function clampFont(size: number): number {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(size)));
}

/** New font size for a pinch that scaled the finger distance by `ratio` (>1 = fingers apart = bigger). */
export function pinchFont(start: number, ratio: number): number {
  return clampFont(start * ratio);
}

/** The Fn panel: navigation and function keys (xterm sequences), then symbols that are awkward on a phone keyboard. */
export const FN_KEYS: [string, string][] = [
  ['PgUp', '\x1b[5~'],
  ['PgDn', '\x1b[6~'],
  ['Ins', '\x1b[2~'],
  ['Del', '\x1b[3~'],
  ['F1', '\x1bOP'],
  ['F2', '\x1bOQ'],
  ['F3', '\x1bOR'],
  ['F4', '\x1bOS'],
  ['F5', '\x1b[15~'],
  ['F6', '\x1b[17~'],
  ['F7', '\x1b[18~'],
  ['F8', '\x1b[19~'],
  ['F9', '\x1b[20~'],
  ['F10', '\x1b[21~'],
  ['F11', '\x1b[23~'],
  ['F12', '\x1b[24~'],
];

export const SYMBOLS = ['{', '}', '[', ']', '(', ')', '<', '>', '\\', '`', '$', '&', '*', ';', '"', "'", '#', '@', '!', '=', '+', '_', '%', '^', ':', '?'];

/** The last `maxLines` lines of a terminal buffer as plain text, trailing blank lines dropped (for the Select view). */
export function bufferText(getLine: (i: number) => string | undefined, length: number, maxLines = 1000): string {
  const out: string[] = [];
  for (let i = Math.max(0, length - maxLines); i < length; i++) out.push((getLine(i) ?? '').replace(/\s+$/, ''));
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** tmux writes its prefix as `C-b`, `M-a`, a bare character, or `None`; this is what the terminal receives for it. */
export function prefixBytes(notation: string): string {
  const p = notation.trim();
  if (!p || p === 'None') return '';
  const named: Record<string, string> = { Space: ' ', Tab: '\t', Enter: '\r', Escape: '\x1b' };
  const key = (k: string) => (named[k] ?? (k.length === 1 ? k : ''));
  if (p.startsWith('C-M-') || p.startsWith('M-C-')) {
    const k = key(p.slice(4));
    return k ? '\x1b' + applyMods(k, { ctrl: true, alt: false }).out : '';
  }
  if (p.startsWith('C-')) {
    const k = key(p.slice(2));
    return k ? applyMods(k, { ctrl: true, alt: false }).out : '';
  }
  if (p.startsWith('M-')) {
    const k = key(p.slice(2));
    return k ? '\x1b' + k : '';
  }
  return key(p);
}

export type KeyProfile = 'shell' | 'tmux';

/** After the prefix: splits, copy mode and detach. Window moves live in the windows dropdown. */
export const TMUX_COMBOS: [label: string, key: string][] = [
  ['Split ─', '"'],
  ['Split │', '%'],
  ['Copy mode', '['],
  ['Detach', 'd'],
];
