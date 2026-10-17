// The hook offer's anti-nag rule (decision 0106). "Not now" is answered again only after the user answered a prompt by
// hand in the terminal, or after 14 days; "Never" is permanent until the user reverses it in Settings. Pure: the clock and
// the storage are passed in, so the rule is tested without a browser.

export const DAY_MS = 86_400_000;
export const REOFFER_DAYS = 14;

export type OfferAnswer = 'later' | 'never';
export interface OfferRecord {
  answer: OfferAnswer;
  /** When it was answered (ms). */
  at: number;
  /** The user answered a prompt by hand since a "Not now"; this is the early trigger for the next offer. */
  manual: boolean;
}
export type Clock = () => number;

/** Whether an answered offer is due again. No record means the agent was never offered. */
export function offerDue(record: OfferRecord | undefined, now: number, days = REOFFER_DAYS): boolean {
  if (!record) return true;
  if (record.answer === 'never') return false;
  return record.manual || now - record.at >= days * DAY_MS;
}

const KEY = 'termenbox_hook_offers';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browserStore = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };

/** The answers on this device, per agent per server. */
export class HookOffers {
  private records: Record<string, OfferRecord> = {};

  constructor(private store: Store | undefined = browserStore(), private clock: Clock = Date.now, private days = REOFFER_DAYS) {
    try {
      const saved = JSON.parse(store?.getItem(KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        for (const [k, v] of Object.entries(saved as Record<string, Partial<OfferRecord>>)) {
          if ((v?.answer === 'later' || v?.answer === 'never') && typeof v.at === 'number') this.records[k] = { answer: v.answer, at: v.at, manual: v.manual === true };
        }
      }
    } catch { /* unreadable storage: every agent counts as not yet offered */ }
  }

  private static id = (serverId: string, agent: string) => `${serverId}\u0000${agent}`;
  private save() { try { this.store?.setItem(KEY, JSON.stringify(this.records)); } catch { /* Private mode: the answers last for this page. */ } }

  record(serverId: string, agent: string): OfferRecord | undefined { return this.records[HookOffers.id(serverId, agent)]; }
  /** Whether the card may show now. */
  due(serverId: string, agent: string): boolean { return offerDue(this.record(serverId, agent), this.clock(), this.days); }
  isNever(serverId: string, agent: string): boolean { return this.record(serverId, agent)?.answer === 'never'; }
  notNow(serverId: string, agent: string) { this.records[HookOffers.id(serverId, agent)] = { answer: 'later', at: this.clock(), manual: false }; this.save(); }
  never(serverId: string, agent: string) { this.records[HookOffers.id(serverId, agent)] = { answer: 'never', at: this.clock(), manual: false }; this.save(); }
  /** Forgets the answer (enabled, or "offer again" in Settings). */
  clear(serverId: string, agent: string) { delete this.records[HookOffers.id(serverId, agent)]; this.save(); }
  /** The user answered a prompt by hand: a "Not now" for this agent is due again. "Never" is not touched. */
  manualAnswer(serverId: string, agent: string) {
    const r = this.records[HookOffers.id(serverId, agent)];
    if (r?.answer !== 'later' || r.manual) return;
    r.manual = true;
    this.save();
  }
}
