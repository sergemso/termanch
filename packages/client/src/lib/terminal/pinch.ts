import { pinchFont } from '../keys';

/** Two-finger pinch to resize the font. Tracks pointers; `move` returns the new size once two fingers are down. */
export class PinchZoom {
  private pointers = new Map<number, { x: number; y: number }>();
  private start: { dist: number; font: number } | null = null;

  get fingers(): number {
    return this.pointers.size;
  }

  down(id: number, x: number, y: number, currentFont: number): void {
    this.pointers.set(id, { x, y });
    if (this.pointers.size === 2) this.start = { dist: this.spread(), font: currentFont };
  }

  move(id: number, x: number, y: number): number | null {
    if (!this.pointers.has(id)) return null;
    this.pointers.set(id, { x, y });
    if (this.pointers.size !== 2 || !this.start || this.start.dist <= 0) return null;
    return pinchFont(this.start.font, this.spread() / this.start.dist);
  }

  up(id: number): void {
    this.pointers.delete(id);
    if (this.pointers.size < 2) this.start = null;
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
