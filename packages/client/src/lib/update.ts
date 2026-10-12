// "Update available" for an installed PWA, which can stay open in memory for days: compare the script the
// running page was built with against the one the server serves now.
import { writable } from 'svelte/store';

export const updateAvailable = writable(false);

const ASSET = /\/assets\/index-[\w-]+\.js/;

/** The app bundle named in an index.html. */
export function bundleOf(html: string): string | null {
  return ASSET.exec(html)?.[0] ?? null;
}

export function runningBundle(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): string | null {
  if (!doc) return null;
  for (const s of doc.querySelectorAll('script[src]')) {
    const m = ASSET.exec(s.getAttribute('src') ?? '');
    if (m) return m[0];
  }
  return null;
}

/** True when the deployed index.html points at a different bundle than the one running. */
export async function checkForUpdate(fetcher: typeof fetch = fetch): Promise<boolean> {
  const running = runningBundle();
  if (!running) return false; // dev server or an unhashed build
  try {
    const res = await fetcher('/', { cache: 'no-store' });
    if (!res.ok) return false;
    const latest = bundleOf(await res.text());
    return !!latest && latest !== running;
  } catch {
    return false;
  }
}

/** Checks now and whenever the app comes back to the foreground, at most once a minute. */
export function watchForUpdates(): void {
  let last = 0;
  const run = async () => {
    if (document.visibilityState === 'hidden' || Date.now() - last < 60_000) return;
    last = Date.now();
    if (await checkForUpdate()) updateAvailable.set(true);
  };
  document.addEventListener('visibilitychange', run);
  void run();
}
