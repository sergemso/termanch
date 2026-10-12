import { describe, expect, it } from 'vitest';
import { PinchZoom } from './pinch';

describe('PinchZoom', () => {
  it('does nothing with one finger', () => {
    const p = new PinchZoom();
    p.down(1, 0, 0, 14);
    expect(p.move(1, 50, 50)).toBeNull();
  });

  it('scales the font with the spread of two fingers', () => {
    const p = new PinchZoom();
    p.down(1, 0, 0, 14);
    p.down(2, 100, 0, 14);
    expect(p.fingers).toBe(2);
    expect(p.move(2, 200, 0)).toBe(28); // twice as far apart, clamped at the maximum
    expect(p.move(2, 50, 0)).toBeLessThan(14);
  });

  it('stops when a finger lifts and restarts on the next pinch', () => {
    const p = new PinchZoom();
    p.down(1, 0, 0, 14);
    p.down(2, 100, 0, 14);
    p.up(2);
    expect(p.move(1, 10, 10)).toBeNull();
    p.down(3, 100, 0, 20);
    expect(p.move(3, 100, 0)).toBe(20);
  });
});
