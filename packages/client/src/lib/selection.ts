// Touch text selection in the terminal: long-press a word, drag to extend, drag the handles to adjust.
// All coordinates are cells; `row` is an absolute buffer line so a selection survives scrolling.

export interface Cell {
  col: number;
  row: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The cell under a pointer, clamped to the screen; `viewportY` is the buffer line shown at the top. */
export function cellAt(x: number, y: number, rect: Rect, cols: number, rows: number, viewportY: number): Cell {
  const col = clamp(Math.floor(((x - rect.left) / rect.width) * cols), 0, cols - 1);
  const row = clamp(Math.floor(((y - rect.top) / rect.height) * rows), 0, rows - 1);
  return { col, row: viewportY + row };
}

/** The pixel box of a cell relative to the screen's top-left (null when scrolled out of the viewport). */
export function cellBox(cell: Cell, rect: Rect, cols: number, rows: number, viewportY: number) {
  const row = cell.row - viewportY;
  if (row < 0 || row >= rows) return null;
  const w = rect.width / cols;
  const h = rect.height / rows;
  return { x: cell.col * w, y: row * h, w, h };
}

/** Start and end (inclusive) of the run of non-space characters around `col`; a single cell on whitespace. */
export function wordRange(text: string, col: number): { start: number; end: number } {
  const isSpace = (i: number) => i >= text.length || /\s/.test(text[i]);
  if (isSpace(col)) return { start: col, end: col };
  let start = col;
  let end = col;
  while (start > 0 && !isSpace(start - 1)) start--;
  while (!isSpace(end + 1)) end++;
  return { start, end };
}

export function ordered(a: Cell, b: Cell): [Cell, Cell] {
  return a.row < b.row || (a.row === b.row && a.col <= b.col) ? [a, b] : [b, a];
}

/** Arguments for xterm's `select(column, row, length)` covering start..end inclusive across wrapped rows. */
export function selectionArgs(start: Cell, end: Cell, cols: number) {
  return { col: start.col, row: start.row, length: (end.row - start.row) * cols + (end.col - start.col) + 1 };
}
