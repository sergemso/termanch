import { describe, expect, it } from 'vitest';
import { replacementData, replacementKeys } from './swipe';

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
