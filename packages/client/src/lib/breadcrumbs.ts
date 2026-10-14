// A short trail of what the app did, for "Report a problem": the steps to reproduce write themselves.
// Only event names and sizes; never names, paths, addresses or terminal content (guardrail diagnostics-never-include-secrets).
const MAX = 30;
let trail: { at: number; text: string }[] = [];

export function crumb(text: string, now = Date.now()): void {
  const last = trail[trail.length - 1];
  if (last && last.text === text && now - last.at < 1000) return; // a burst of the same event is one line
  trail = [...trail, { at: now, text }].slice(-MAX);
}

/** Oldest first, as numbered steps with the seconds before `now`. */
export function crumbText(now = Date.now()): string[] {
  return trail.map((c, i) => `${i + 1}. ${c.text} (${Math.max(0, Math.round((now - c.at) / 1000))} s ago)`);
}

export function resetCrumbs(): void {
  trail = [];
}
