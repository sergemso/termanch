import { describe, expect, it } from 'vitest';
import { WordTracker } from './wordTracker';

describe('WordTracker', () => {
  it('follows typed letters and backspaces', () => {
    const t = new WordTracker();
    t.feed('у');
    t.feed('т');
    expect(t.current).toBe('ут');
    t.feed('\x7f');
    expect(t.current).toBe('у');
    t.feed('\x7f\x7f\x7f'); // more backspaces than letters is harmless
    expect(t.current).toBe('');
  });

  it('forgets the word at a space, Enter, or an escape sequence', () => {
    const t = new WordTracker();
    for (const end of [' ', '\r', '\t', '\x1b[A', '\x03']) {
      t.feed('abc');
      t.feed(end);
      expect(t.current, JSON.stringify(end)).toBe('');
    }
  });

  it('knows how much of the word a suggestion replaces', () => {
    const t = new WordTracker();
    t.feed('у');
    expect(t.completionPrefix('утро')).toBe(1); // the captured case: typed "у", tapped "утро"
    expect(t.completionPrefix('Утром')).toBe(1); // case is ignored
    expect(t.completionPrefix('чем')).toBe(0); // an unrelated swiped word is appended, not a completion
    expect(t.completionPrefix('у')).toBe(0); // the same length is not a suggestion
    t.feed('т');
    expect(t.completionPrefix('утро')).toBe(2);
  });

  it('does nothing when no word is being typed', () => {
    const t = new WordTracker();
    expect(t.completionPrefix('утро')).toBe(0);
    t.feed('привет ');
    expect(t.completionPrefix('привет')).toBe(0);
  });
});
