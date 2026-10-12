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
