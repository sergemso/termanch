// Debug-only recorder (capture phase, so xterm's own handlers cannot hide an event) of the events iOS fires on the terminal's hidden textarea, to learn what a swipe-typing
// correction looks like (plan X.1). It records text typed by the user, so it works only behind the debug
// switch, stays in memory and leaves the device only when the user taps Copy.
import { writable } from 'svelte/store';
import { DEBUG_KEY, debugEnabled } from './viewport';

export const inputLog = writable<string[]>([]);
const MAX_LINES = 80;

interface Snapshot {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

/** One compact line per event: time since the first event, type, inputType, data, target ranges, textarea state. */
export function formatEvent(e: { type: string; inputType?: string; data?: string | null; isComposing?: boolean; key?: string }, t: number, area: Snapshot, ranges: string): string {
  const parts = [`+${Math.round(t)}`, e.type];
  if (e.inputType) parts.push(e.inputType);
  if (e.key) parts.push(`key=${JSON.stringify(e.key)}`);
  if (e.data != null) parts.push(`data=${JSON.stringify(e.data)}`);
  if (e.isComposing) parts.push('composing');
  if (ranges) parts.push(`ranges=${ranges}`);
  parts.push(`val=${JSON.stringify(area.value)}`, `sel=${area.selectionStart}-${area.selectionEnd}`);
  return parts.join(' ');
}

const EVENTS = ['beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend', 'keydown', 'keyup'];

/** Starts recording; returns the stop function. Does nothing unless the debug switch is on at the time of each event. */
export function attachInputLogger(area: HTMLTextAreaElement): () => void {
  let start = 0;
  const on = () => debugEnabled(location.search, localStorage.getItem(DEBUG_KEY));
  const push = (line: string) => inputLog.update((l) => [...l, line].slice(-MAX_LINES));
  const handler = (e: Event) => {
    if (!on()) return;
    const now = performance.now();
    if (!start) start = now;
    let ranges = '';
    if (e.type === 'beforeinput' && 'getTargetRanges' in e) {
      ranges = (e as InputEvent)
        .getTargetRanges()
        .map((r) => `${r.startOffset}-${r.endOffset}`)
        .join(',');
    }
    push(formatEvent(e as InputEvent & KeyboardEvent, now - start, area, ranges));
  };
  const select = () => {
    if (!on()) return;
    push(`+${Math.round(performance.now() - start)} selectionchange sel=${area.selectionStart}-${area.selectionEnd}`);
  };
  for (const name of EVENTS) area.addEventListener(name, handler, true);
  document.addEventListener('selectionchange', select);
  return () => {
    for (const name of EVENTS) area.removeEventListener(name, handler, true);
    document.removeEventListener('selectionchange', select);
  };
}
