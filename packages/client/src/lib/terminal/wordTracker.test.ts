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

describe('WordTracker: Backspace after a word that came in whole', () => {
  it('takes back a swiped word in one Backspace', () => {
    const t = new WordTracker();
    t.feed('hello');
    expect(t.backspaceCount()).toBe(5);
    t.feed('\x7f'.repeat(5));
    expect(t.current).toBe('');
    expect(t.backspaceCount()).toBe(1);
  });

  it('removes only the trailing space first, so a comma can follow, then the word', () => {
    const t = new WordTracker();
    t.feed('hello ');
    expect(t.backspaceCount()).toBe(1);
    t.feed('\x7f');
    expect(t.current).toBe('hello');
    expect(t.backspaceCount()).toBe(5);
  });

  it('typing after the space ends the word-sized Backspace', () => {
    const t = new WordTracker();
    t.feed('hello ');
    t.feed('\x7f');
    t.feed(',');
    expect(t.backspaceCount()).toBe(1);
  });

  it('counts a leading space as separate and handles two trailing spaces one by one', () => {
    const t = new WordTracker();
    t.feed(' world  ');
    expect(t.backspaceCount()).toBe(1);
    t.feed('\x7f');
    expect(t.backspaceCount()).toBe(1);
    t.feed('\x7f');
    expect(t.backspaceCount()).toBe(5);
  });

  it('treats letters typed one at a time as ordinary characters', () => {
    const t = new WordTracker();
    for (const c of 'hello') t.feed(c);
    expect(t.backspaceCount()).toBe(1);
  });

  it('ignores several words, a paste that was cleared, and text with control characters', () => {
    const t = new WordTracker();
    t.feed('two words');
    expect(t.backspaceCount()).toBe(1);
    t.feed('pasted');
    t.clearInsert();
    expect(t.backspaceCount()).toBe(1);
    t.feed('ab\rcd');
    expect(t.backspaceCount()).toBe(1);
  });

  it('a replacement (deletes, then the new word) becomes the whole-word unit', () => {
    const t = new WordTracker();
    t.feed('hello ');
    t.feed('\x7f\x7f\x7f\x7f\x7f\x7fhe\'ll ');
    expect(t.backspaceCount()).toBe(1);
    t.feed('\x7f');
    expect(t.backspaceCount()).toBe(5);
  });
});
