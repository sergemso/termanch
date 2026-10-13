import { describe, expect, it } from 'vitest';
import { sheetHeight, snapHeight } from './sheet';
describe('sheet heights', () => {
  it('keeps peek, half and full within the AppShell content area after a keyboard shrink', () => {
    expect(['peek', 'half', 'full'].map(h => sheetHeight(h as 'peek' | 'half' | 'full', 700))).toEqual([96, 350, 700]);
    expect(sheetHeight('full', 300)).toBe(300);
    expect(sheetHeight('peek', 60)).toBe(60);
  });
  it('snaps to the nearest height rather than interpreting a tap as a drag', () => {
    expect(snapHeight(90, 700)).toBe('peek');
    expect(snapHeight(360, 700)).toBe('half');
    expect(snapHeight(600, 700)).toBe('full');
  });
});

import { sheetHeight as heightOf } from './sheet';
describe('closed sheet', () => {
  it('takes no room', () => {
    expect(heightOf('closed', 600)).toBe(0);
    expect(heightOf('peek', 600)).toBe(96);
  });
});
