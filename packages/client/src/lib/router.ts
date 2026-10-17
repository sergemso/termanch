// The four top-level destinations (decision 0101) and the address bar that mirrors them. The hash carries only the
// destination (`#/sessions`); claim and server links (`#claim=`, `#server=`) are other hashes and are left alone.
import { writable, get } from 'svelte/store';

export const DESTINATIONS = [
  { id: 'home', label: 'Home' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
] as const;
export type Destination = (typeof DESTINATIONS)[number]['id'];
/** The app still opens where it always did (the last session); Home is a placeholder until its content lands. */
export const DEFAULT_DESTINATION: Destination = 'sessions';

export const isDestination = (v: unknown): v is Destination => DESTINATIONS.some((d) => d.id === v);

/** `#/home` -> `home`; anything else (a claim link, an empty hash, an unknown name) -> null. */
export function parseRoute(hash: string): Destination | null {
  const m = /^#\/([a-z]+)\/?$/.exec(hash);
  return m && isDestination(m[1]) ? m[1] : null;
}
export const routeHash = (d: Destination) => `#/${d}`;

export const destination = writable<Destination>(DEFAULT_DESTINATION);

type Win = Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener'>;

/** Moves to a destination and records it in the address bar, so Back returns to the previous one. */
export function navigate(d: Destination, win: Win | undefined = typeof window === 'undefined' ? undefined : window) {
  if (get(destination) !== d) destination.set(d);
  if (win && win.location.hash !== routeHash(d)) {
    try { win.history.pushState(null, '', `${win.location.pathname}${win.location.search}${routeHash(d)}`); } catch { /* sandboxed frame: the store still moves */ }
  }
}

/** Reads the address bar once, then follows Back/Forward. Returns the stop function. */
export function startRouter(win: Win | undefined = typeof window === 'undefined' ? undefined : window): () => void {
  if (!win) return () => {};
  const read = () => { const d = parseRoute(win.location.hash); if (d && d !== get(destination)) destination.set(d); };
  read();
  win.addEventListener('hashchange', read);
  win.addEventListener('popstate', read);
  return () => { win.removeEventListener('hashchange', read); win.removeEventListener('popstate', read); };
}
