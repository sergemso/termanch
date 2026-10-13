import { chipFor } from './cards';
import type { AgentMap, SessionAgent } from './agents';
import type { HubSession } from './hub';

export const needsYou = (agent?: SessionAgent) => agent?.state === 'needs_input' || agent?.state === 'error';
export const needsYouCount = (agents: AgentMap) => Object.values(agents).filter(needsYou).length;
/** Only needs-you moves to the front; otherwise tabs mirror the servers' session order. */
export function tabIds(sessions: HubSession[], agents: AgentMap): string[] {
  return [...sessions.filter(s => needsYou(agents[s.key])), ...sessions.filter(s => !needsYou(agents[s.key]))].map(s => s.key);
}
export function tabLabel(session: HubSession, agent: SessionAgent | undefined, serverCount: number, now: number): string {
  return [session.name, ...(serverCount > 1 ? [session.serverName] : []), agent ? chipFor(agent, now).label : 'No status'].join(' · ');
}
