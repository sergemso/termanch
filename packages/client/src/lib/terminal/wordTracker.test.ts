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

describe('WordTracker: no space after a joining character', () => {
  it('drops the space iOS puts before a swiped word after "device-"', () => {
    const t = new WordTracker();
    t.feed('device-');
    expect(t.dropSpuriousSpace(' friendly')).toBe('friendly');
    expect(t.dropSpuriousSpace(' friendly ')).toBe('friendly ');
  });

  it('keeps the space after a letter, after a space, and when the user typed the space', () => {
    const t = new WordTracker();
    t.feed('hello');
    expect(t.dropSpuriousSpace(' world')).toBe(' world');
    const u = new WordTracker();
    u.feed('device-');
    expect(u.dropSpuriousSpace(' ')).toBe(' ');
    expect(u.dropSpuriousSpace(' a')).toBe(' a');
    u.feed(' ');
    expect(u.dropSpuriousSpace(' friendly')).toBe(' friendly');
  });
});

describe('WordTracker: the phrase the hidden input mirrors', () => {
  it('holds the last two words, with the spaces between and after', () => {
    const t = new WordTracker();
    t.feed('one app');
    expect(t.phrase).toBe('one app');
    t.feed(' works');
    expect(t.phrase).toBe('app works');
    t.feed(' ');
    expect(t.phrase).toBe('app works ');
  });

  it('follows a whole-word replacement of two words', () => {
    const t = new WordTracker();
    t.feed('app works');
    t.feed('\x7f'.repeat(9) + 'api works');
    expect(t.phrase).toBe('api works');
  });

  it('shrinks on Backspace and clears on Enter, Tab, escape sequences and reset', () => {
    const t = new WordTracker();
    t.feed('api works');
    t.feed('\x7f\x7f');
    expect(t.phrase).toBe('api wor');
    for (const end of ['\r', '\t', '\x1b[A', '\x03']) {
      t.feed('api works');
      t.feed(end);
      expect(t.phrase).toBe('');
    }
  });

  it('leaves the single-word state alone', () => {
    const t = new WordTracker();
    t.feed('api works');
    expect(t.current).toBe('works');
    t.feed(' ');
    expect(t.current).toBe('');
  });
});

describe('WordTracker: script of the typed text', () => {
  it('is the script of the last letter, so mixed lines follow the latest word', () => {
    const t = new WordTracker();
    expect(t.script).toBeNull();
    t.feed('hello');
    expect(t.script).toBe('latin');
    t.feed(' привет');
    expect(t.script).toBe('cyrillic');
    t.feed(' 123 !');
    expect(t.script).toBe('cyrillic'); // digits and symbols say nothing
  });

  it('is null for digits only and after Enter', () => {
    const t = new WordTracker();
    t.feed('42');
    expect(t.script).toBeNull();
    t.feed('abc\r');
    expect(t.script).toBeNull();
  });
});
