import { describe, expect, it } from 'vitest';
import { cellAt, cellBox, ordered, selectionArgs, wordRange } from './selection';

const rect = { left: 10, top: 100, width: 800, height: 400 }; // 80 x 20 cells of 10 x 20 px

describe('cellAt', () => {
  it('maps a touch to a cell and adds the scroll offset', () => {
    expect(cellAt(10, 100, rect, 80, 20, 0)).toEqual({ col: 0, row: 0 });
    expect(cellAt(55, 165, rect, 80, 20, 0)).toEqual({ col: 4, row: 3 });
    expect(cellAt(55, 165, rect, 80, 20, 1000)).toEqual({ col: 4, row: 1003 });
  });

  it('clamps touches outside the screen', () => {
    expect(cellAt(-50, 5000, rect, 80, 20, 0)).toEqual({ col: 0, row: 19 });
    expect(cellAt(5000, -5, rect, 80, 20, 0)).toEqual({ col: 79, row: 0 });
  });
});

describe('cellBox', () => {
  it('gives the pixel box and hides cells outside the viewport', () => {
    expect(cellBox({ col: 4, row: 1003 }, rect, 80, 20, 1000)).toEqual({ x: 40, y: 60, w: 10, h: 20 });
    expect(cellBox({ col: 0, row: 5 }, rect, 80, 20, 1000)).toBeNull();
  });
});

describe('wordRange', () => {
  it('selects the whole word under the finger', () => {
    expect(wordRange('git commit -m "x"', 6)).toEqual({ start: 4, end: 9 });
    expect(wordRange('git commit', 0)).toEqual({ start: 0, end: 2 });
    expect(wordRange('git commit', 9)).toEqual({ start: 4, end: 9 });
  });

  it('selects one cell on whitespace or past the end of the line', () => {
    expect(wordRange('a  b', 1)).toEqual({ start: 1, end: 1 });
    expect(wordRange('abc', 10)).toEqual({ start: 10, end: 10 });
  });
});

describe('selection range', () => {
  it('orders the ends whichever way the user dragged', () => {
    const a = { col: 5, row: 3 };
    const b = { col: 2, row: 3 };
    expect(ordered(a, b)).toEqual([b, a]);
    expect(ordered({ col: 0, row: 9 }, { col: 70, row: 2 })[0].row).toBe(2);
  });

  it('counts cells across wrapped rows, inclusive', () => {
    expect(selectionArgs({ col: 4, row: 3 }, { col: 9, row: 3 }, 80)).toEqual({ col: 4, row: 3, length: 6 });
    expect(selectionArgs({ col: 78, row: 3 }, { col: 1, row: 4 }, 80)).toEqual({ col: 78, row: 3, length: 4 });
  });
});
