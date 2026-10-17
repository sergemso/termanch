import { describe, expect, it } from 'vitest';
import { DAY_MS, HookOffers, offerDue, REOFFER_DAYS, type OfferRecord } from './hookOffer';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const T0 = 1_000_000_000_000;

describe('the re-offer rule (decision 0106)', () => {
  const later = (manual = false): OfferRecord => ({ answer: 'later', at: T0, manual });

  it('offers an agent that was never answered', () => {
    expect(offerDue(undefined, T0)).toBe(true);
  });
  it('keeps a "Not now" quiet before 14 days and offers again at 14', () => {
    expect(REOFFER_DAYS).toBe(14);
    expect(offerDue(later(), T0 + 1)).toBe(false);
    expect(offerDue(later(), T0 + 13 * DAY_MS + DAY_MS - 1)).toBe(false);
    expect(offerDue(later(), T0 + 14 * DAY_MS)).toBe(true);
  });
  it('takes the day count as an input', () => {
    expect(offerDue(later(), T0 + 2 * DAY_MS, 3)).toBe(false);
    expect(offerDue(later(), T0 + 3 * DAY_MS, 3)).toBe(true);
  });
  it('offers again at once after the user answered a prompt by hand', () => {
    expect(offerDue(later(true), T0 + 1)).toBe(true);
  });
  it('never offers again after Never, whatever the days or the manual answers', () => {
    expect(offerDue({ answer: 'never', at: T0, manual: false }, T0 + 400 * DAY_MS)).toBe(false);
    expect(offerDue({ answer: 'never', at: T0, manual: true }, T0 + 400 * DAY_MS)).toBe(false);
  });
});

describe('the answers kept on this device', () => {
  it('follows Not now, a manual answer and the clock, per agent per server', () => {
    let now = T0;
    const offers = new HookOffers(memory(), () => now);
    expect(offers.due('s1', 'claude')).toBe(true);
    offers.notNow('s1', 'claude');
    expect(offers.due('s1', 'claude')).toBe(false);
    expect(offers.due('s2', 'claude')).toBe(true); // another server is its own question
    offers.manualAnswer('s2', 'claude'); // no "Not now" there: nothing to bring back
    expect(offers.record('s2', 'claude')).toBeUndefined();
    offers.manualAnswer('s1', 'claude');
    expect(offers.due('s1', 'claude')).toBe(true);
    offers.notNow('s1', 'claude'); // answering again starts the quiet period over
    expect(offers.due('s1', 'claude')).toBe(false);
    now += 14 * DAY_MS;
    expect(offers.due('s1', 'claude')).toBe(true);
  });
  it('Never stops the offers for good, a manual answer does not undo it, and Settings can', () => {
    let now = T0;
    const offers = new HookOffers(memory(), () => now);
    offers.never('s1', 'claude');
    offers.manualAnswer('s1', 'claude');
    now += 365 * DAY_MS;
    expect(offers.due('s1', 'claude')).toBe(false);
    expect(offers.isNever('s1', 'claude')).toBe(true);
    offers.clear('s1', 'claude');
    expect(offers.isNever('s1', 'claude')).toBe(false);
    expect(offers.due('s1', 'claude')).toBe(true);
  });
  it('remembers across a reload and survives unreadable storage', () => {
    const store = memory();
    new HookOffers(store, () => T0).never('s1', 'claude');
    expect(new HookOffers(store, () => T0).isNever('s1', 'claude')).toBe(true);
    store.setItem('termenbox_hook_offers', '{broken');
    expect(new HookOffers(store, () => T0).due('s1', 'claude')).toBe(true);
    expect(new HookOffers(undefined, () => T0).due('s1', 'claude')).toBe(true);
  });
});
