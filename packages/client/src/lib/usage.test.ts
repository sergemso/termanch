import { describe, expect, it } from 'vitest';
import { addTime, load, MAX_TICK_MS, summary, tickMs, tierOf, weekKey } from './usage';

const H = 3_600_000;
const day = (s: string) => new Date(`${s}T12:00:00`);

describe('weekKey', () => {
  it('starts weeks on Monday', () => {
    expect(weekKey(day('2026-10-11'))).toBe('2026-W41'); // Sunday
    expect(weekKey(day('2026-10-12'))).toBe('2026-W42'); // Monday
  });

  it('follows ISO rules across the year boundary', () => {
    expect(weekKey(day('2025-12-29'))).toBe('2026-W01');
    expect(weekKey(day('2026-01-01'))).toBe('2026-W01');
    expect(weekKey(day('2026-12-31'))).toBe('2026-W53');
    expect(weekKey(day('2027-01-03'))).toBe('2026-W53');
    expect(weekKey(day('2027-01-04'))).toBe('2027-W01');
  });
});

describe('tierOf', () => {
  it('uses the agreed boundaries', () => {
    expect(tierOf(0.99)).toBeNull();
    expect(tierOf(1)).toBe('copper');
    expect(tierOf(4.99)).toBe('copper');
    expect(tierOf(5)).toBe('silver');
    expect(tierOf(15)).toBe('gold');
    expect(tierOf(29.9)).toBe('gold');
    expect(tierOf(30)).toBe('platinum');
  });
});

describe('tickMs', () => {
  it('counts only visible, attached time and caps a suspended tab', () => {
    expect(tickMs(5000, true, true)).toBe(5000);
    expect(tickMs(5000, false, true)).toBe(0);
    expect(tickMs(5000, true, false)).toBe(0);
    expect(tickMs(10 * 60_000, true, true)).toBe(MAX_TICK_MS);
    expect(tickMs(-5, true, true)).toBe(0);
  });
});

describe('weeks and summary', () => {
  it('accumulates per week and keeps eight', () => {
    let weeks = {};
    for (let i = 0; i < 10; i++) weeks = addTime(weeks, H, new Date(2026, 0, 5 + 7 * i, 12));
    expect(Object.keys(weeks)).toHaveLength(8);
    expect(addTime({}, 0, new Date())).toEqual({});
  });

  it('shows last week as the tier and this week as progress', () => {
    const now = day('2026-10-14'); // Wednesday of W42
    const weeks = { '2026-W41': 6 * H, '2026-W42': 2 * H };
    const s = summary(weeks, now);
    expect(s.tier).toBe('silver');
    expect(s.weekHours).toBe(2);
    expect(s.next).toEqual({ name: 'silver', hoursLeft: 3 });
    expect(s.history.map((h) => h.week)).toEqual(['2026-W41', '2026-W42']);
  });

  it('rolls over on Monday and has no next tier above platinum', () => {
    const weeks = { '2026-W41': 31 * H };
    const sunday = summary(weeks, day('2026-10-11')); // W41 is still the current week
    expect([sunday.weekHours, sunday.next, sunday.tier]).toEqual([31, null, null]);
    const monday = summary(weeks, day('2026-10-12')); // a new week: last week's tier is awarded, progress restarts
    expect(monday.tier).toBe('platinum');
    expect([monday.weekHours, monday.next?.name]).toEqual([0, 'copper']);
    expect(summary({ '2026-W42': 31 * H }, day('2026-10-14')).next).toBeNull();
  });

  it('reads stored data defensively', () => {
    expect(load({ getItem: () => 'not json' })).toEqual({});
    expect(load({ getItem: () => null })).toEqual({});
    expect(load({ getItem: () => '{"2026-W42":3600000}' })).toEqual({ '2026-W42': 3600000 });
  });
});
