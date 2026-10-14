import { describe, expect, it } from 'vitest';
import { debugEnabled, debugText, tapCounter, viewportBox, viewportReading } from './viewport';

const win = { innerHeight: 800, innerWidth: 390 };

describe('viewportBox', () => {
  it('is the whole window without a visual viewport', () => {
    expect(viewportBox(null, win)).toEqual({ top: 0, left: 0, width: 390, height: 800, keyboard: false });
  });

  it('follows the visual viewport and detects an open keyboard', () => {
    const box = viewportBox({ height: 460, width: 390, offsetTop: 0, offsetLeft: 0 }, win);
    expect(box).toMatchObject({ top: 0, height: 460, keyboard: true });
  });

  it('moves with the offset iOS scrolls the visual viewport by, so the bottom edge stays visible', () => {
    const box = viewportBox({ height: 460, width: 390, offsetTop: 120, offsetLeft: 0 }, win);
    expect(box.top + box.height).toBe(580);
    expect(box.top).toBe(120);
  });

  it('ignores a browser toolbar change as a keyboard and clamps negative offsets', () => {
    const box = viewportBox({ height: 740, width: 390, offsetTop: -5, offsetLeft: -1 }, win);
    expect(box).toMatchObject({ top: 0, left: 0, keyboard: false });
  });

  it('prints the numbers for the debug overlay', () => {
    const vv = { height: 460, width: 390, offsetTop: 120, offsetLeft: 0 };
    const text = debugText(vv, win, viewportBox(vv, win));
    expect(text).toContain('inner 390x800');
    expect(text).toContain('vv 390x460 top 120');
    expect(text).toContain('keyboard true');
  });
});

describe('debug switch', () => {
  it('is on for ?debug or the saved switch', () => {
    expect(debugEnabled('?debug', null)).toBe(true);
    expect(debugEnabled('', '1')).toBe(true);
    expect(debugEnabled('', null)).toBe(false);
    expect(debugEnabled('?x=1', '0')).toBe(false);
  });

  it('needs five taps inside three seconds', () => {
    const tap = tapCounter();
    expect([0, 500, 1000, 1500].map(tap)).toEqual([false, false, false, false]);
    expect(tap(2000)).toBe(true);
    const slow = tapCounter();
    expect([0, 1000, 2000, 3500, 4500].map(slow)).toEqual([false, false, false, false, false]);
  });
});

describe('viewportReading', () => {
  it('names zoom, pan and the element that holds focus', () => {
    const vv = { width: 207.4, height: 448, offsetLeft: 103.2, offsetTop: 0, scale: 2, pageLeft: 103, pageTop: 0 };
    const active = { tagName: 'TEXTAREA', className: 'xterm-helper-textarea' } as Element;
    expect(viewportReading(vv, { scrollX: 0, scrollY: 0 }, active)).toBe('207x448 scale 2 offset 103,0 page 103,0 scroll 0,0 focus textarea.xterm-helper-textarea');
    expect(viewportReading(null, { scrollX: 0, scrollY: 0 }, null)).toBe('none');
  });
});
