import { describe, expect, it } from 'vitest';
import { isWordKey, replacementData, replacementKeys, syncTextarea } from './swipe';

describe('replacementKeys', () => {
  it('replays the sequence captured on an iPhone: "hello" swiped, "he\'ll" chosen', () => {
    // beforeinput insertReplacementText data="he'll" val="hello" sel=0-5
    expect(replacementKeys('hello', 0, 5, "he'll")).toBe("\x7f\x7f\x7f\x7f\x7fhe'll");
  });

  it('removes only what the keyboard selected and counts characters, not UTF-16 units', () => {
    expect(replacementKeys('say hello', 4, 9, 'world')).toBe('\x7f\x7f\x7f\x7f\x7fworld');
    expect(replacementKeys('😀a', 0, 3, 'b')).toBe('\x7f\x7fb');
    expect(replacementKeys('abc', 2, 0, 'x')).toBe('\x7f\x7fx'); // reversed selection
  });

  it('just types the text when nothing was selected', () => {
    expect(replacementKeys('hello', 5, 5, 'x')).toBe('x');
  });
});

describe('replacementData', () => {
  const base = { inputType: 'insertReplacementText', data: "he'll", isComposing: false, dataTransfer: null };
  it('accepts replacement events and ignores everything else', () => {
    expect(replacementData(base)).toBe("he'll");
    expect(replacementData({ ...base, inputType: 'insertText' })).toBeNull();
    expect(replacementData({ ...base, isComposing: true })).toBeNull();
    expect(replacementData({ ...base, data: null })).toBeNull();
  });
});

describe('isWordKey', () => {
  it('recognises a swiped word reported as the key (captured on the Russian iOS keyboard)', () => {
    expect(isWordKey('чем')).toBe(true);
    expect(isWordKey('Чем')).toBe(true);
    expect(isWordKey('hello')).toBe(true);
  });

  it('leaves real keys alone', () => {
    for (const key of ['з', 'a', ' ', '😀', 'Enter', 'Backspace', 'ArrowLeft', 'Tab', 'Dead', 'Unidentified', 'Process', 'Shift', 'F1', 'F12']) {
      expect(isWordKey(key), key).toBe(false);
    }
  });
});

describe('syncTextarea', () => {
  const field = (value: string) => {
    const f = { value, range: [-1, -1], setSelectionRange(a: number, b: number) { this.range = [a, b]; } };
    return f;
  };

  it('replaces stale text with the word being typed and puts the caret at its end', () => {
    const f = field('утромпа'); // captured while typing "па"
    expect(syncTextarea(f, 'па')).toBe(true);
    expect(f.value).toBe('па');
    expect(f.range).toEqual([2, 2]);
  });

  it('leaves a field alone when it is already right (no caret jumps)', () => {
    const f = field('па');
    expect(syncTextarea(f, 'па')).toBe(false);
    expect(f.range).toEqual([-1, -1]);
  });

  it('empties the field between words', () => {
    const f = field('паспорт');
    syncTextarea(f, '');
    expect(f.value).toBe('');
  });
});
