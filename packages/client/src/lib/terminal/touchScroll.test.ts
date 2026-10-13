import { describe, expect, it } from 'vitest';
import { TouchScroll } from './touchScroll';

function setup() {
  let t = 0;
  const wheels: number[] = [];
  const taps: [number, number][] = [];
  const frames: (() => void)[] = [];
  const s = new TouchScroll({
    rowHeight: () => 18,
    wheel: (dy) => wheels.push(Math.round(dy * 100) / 100),
    tap: (x, y) => taps.push([x, y]),
    now: () => t,
    raf: (fn) => frames.push(fn),
    cancelRaf: () => frames.splice(0),
  });
  return { s, wheels, taps, frames, at: (ms: number) => (t = ms) };
}

describe('TouchScroll', () => {
  it('turns a short touch into a tap and a long hold into nothing', () => {
    const { s, taps, at } = setup();
    s.down(1, 50, 60, false);
    at(120);
    s.up(1);
    expect(taps).toEqual([[50, 60]]);
    s.down(1, 50, 60, false);
    at(1000);
    s.up(1);
    expect(taps).toHaveLength(1);
  });

  it('stays quiet inside the slop, then wheels by the distance moved, finger up scrolling forward', () => {
    const { s, wheels, taps, at } = setup();
    s.down(1, 10, 200, false);
    expect(s.move(1, 12, 196)).toBe(false);
    at(30);
    expect(s.move(1, 10, 180)).toBe(true);
    expect(wheels).toEqual([20]); // from where the finger went down
    at(60);
    s.move(1, 10, 190);
    expect(wheels).toEqual([20, -10]); // back down scrolls back
    s.up(1, true);
    expect(taps).toEqual([]);
    expect(s.active).toBe(false);
  });

  it('flings after a flick and stops on the next touch', () => {
    const { s, wheels, frames, at } = setup();
    s.down(1, 0, 300, false);
    for (let i = 1; i <= 6; i++) {
      at(i * 16);
      s.move(1, 0, 300 - i * 30);
    }
    const before = wheels.length;
    s.up(1);
    expect(frames).toHaveLength(1);
    frames.shift()!();
    frames.shift()!();
    expect(wheels.length).toBe(before + 2);
    expect(wheels[wheels.length - 1]).toBeGreaterThan(0);
    s.down(2, 0, 0, false);
    expect(frames).toHaveLength(0);
  });

  it('keeps out of selections and pinches, and follows only its own finger', () => {
    const { s, wheels, taps, at } = setup();
    s.down(1, 0, 100, true);
    expect(s.move(1, 0, 40)).toBe(false);
    at(50);
    s.up(1);
    expect(wheels).toEqual([]);
    expect(taps).toEqual([]);
    s.down(1, 0, 100, false);
    s.down(2, 5, 100, false); // a second finger ends the gesture
    expect(s.move(1, 0, 40)).toBe(false);
    expect(s.move(2, 5, 40)).toBe(false);
  });
});
