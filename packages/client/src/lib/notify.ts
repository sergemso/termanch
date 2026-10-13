// Proactive signals (plan H.7): who needs you, how the page title and app badge say so, and which answers the
// banner may offer. Pure functions; nothing here chooses the active session.
import { isStale, type AgentMap, type SessionAgent } from './agents';
import { needsYou } from './tabs';

export interface Waiting { key: string; name: string; since: number; agent: SessionAgent }

/** Sessions that need you, the longest wait first. */
export function waitingList(sessions: { key: string; name: string }[], agents: AgentMap): Waiting[] {
  return sessions
    .filter(s => needsYou(agents[s.key]))
    .map(s => ({ key: s.key, name: s.name, since: agents[s.key].waitingSince ?? agents[s.key].ts, agent: agents[s.key] }))
    .sort((a, b) => a.since - b.since);
}

export const titleFor = (count: number) => count > 0 ? `(${count}) Termanch` : 'Termanch';
export const bannerText = (count: number) => count === 1 ? '1 needs you' : `${count} need you`;

/** The choices the banner may offer: only for a prompt the agent's own hook confirmed, and never a stale one. */
export function bannerChoices(a: SessionAgent, now: number): string[] {
  if (a.state !== 'needs_input' || !a.prompt || a.prompt.confidence !== 'high' || isStale(a, now)) return [];
  return a.prompt.choices.length > 0 && a.prompt.choices.length <= 3 ? a.prompt.choices : [];
}

/** Sets the title and, where the browser has it, the app icon badge. */
export function announce(count: number, doc: { title: string } = document, nav: { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> } = navigator) {
  doc.title = titleFor(count);
  try {
    if (count > 0) void nav.setAppBadge?.(count)?.catch?.(() => {});
    else void nav.clearAppBadge?.()?.catch?.(() => {});
  } catch { /* Badging is optional. */ }
}
