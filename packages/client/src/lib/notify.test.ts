import { describe, expect, it, vi } from 'vitest';
import { announce, bannerChoices, bannerText, titleFor, waitingList } from './notify';
import type { AgentMap, SessionAgent } from './agents';

const ag = (patch: Partial<SessionAgent>): SessionAgent => ({ state: 'needs_input', seq: 1, stale: false, ts: 1000, ...patch });

describe('needs-you signals', () => {
  it('lists who waits, the longest wait first, and never lists the rest', () => {
    const agents: AgentMap = { a: ag({ waitingSince: 500 }), b: ag({ waitingSince: 100 }), c: ag({ state: 'working' }) };
    const list = waitingList([{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }, { key: 'c', name: 'C' }, { key: 'd', name: 'D' }], agents);
    expect(list.map(w => w.key)).toEqual(['b', 'a']);
  });
  it('words the count and the title', () => {
    expect(titleFor(2)).toBe('(2) Termanch');
    expect(titleFor(0)).toBe('Termanch');
    expect(bannerText(1)).toBe('1 needs you');
    expect(bannerText(3)).toBe('3 need you');
  });
  it('offers answers only for a confirmed, fresh, short prompt', () => {
    const prompt = { id: '1', kind: 'yes_no', choices: ['Yes', 'No'], seq: 2, confidence: 'high' };
    expect(bannerChoices(ag({ prompt }), 1000)).toEqual(['Yes', 'No']);
    expect(bannerChoices(ag({ prompt: { ...prompt, confidence: 'low' } }), 1000)).toEqual([]);
    expect(bannerChoices(ag({ prompt: { ...prompt, choices: ['1', '2', '3', '4'] } }), 1000)).toEqual([]);
    expect(bannerChoices(ag({ state: 'working', prompt }), 1000)).toEqual([]);
    expect(bannerChoices(ag({}), 1000)).toEqual([]);
  });
  it('sets the title and the app badge, and clears it', () => {
    const doc = { title: '' };
    const nav = { setAppBadge: vi.fn(async () => {}), clearAppBadge: vi.fn(async () => {}) };
    announce(2, doc, nav);
    expect(doc.title).toBe('(2) Termanch');
    expect(nav.setAppBadge).toHaveBeenCalledWith(2);
    announce(0, doc, nav);
    expect(nav.clearAppBadge).toHaveBeenCalled();
    announce(1, doc, {}); // a browser without badging
  });
});
