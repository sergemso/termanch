import { describe, expect, it } from 'vitest';
import { formatEvent } from './inputlog';

const area = { value: 'pleased', selectionStart: 7, selectionEnd: 7 };

describe('formatEvent', () => {
  it('records the replacement a keyboard asks for', () => {
    const line = formatEvent({ type: 'beforeinput', inputType: 'insertReplacementText', data: 'phrased' }, 812.4, area, '0-7');
    expect(line).toBe('+812 beforeinput insertReplacementText data="phrased" ranges=0-7 val="pleased" sel=7-7');
  });

  it('marks composition and keys, and omits what is absent', () => {
    expect(formatEvent({ type: 'compositionupdate', data: 'ple', isComposing: true }, 5, area, '')).toContain('data="ple" composing');
    expect(formatEvent({ type: 'keydown', key: 'Backspace' }, 9, area, '')).toBe('+9 keydown key="Backspace" val="pleased" sel=7-7');
  });
});
