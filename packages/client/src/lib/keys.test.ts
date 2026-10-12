import { describe, expect, it } from 'vitest';
import { applyMods, clampFont, pinchFont, KEYS } from './keys';

describe('applyMods', () => {
  it('passes data through when no modifier is armed', () => {
    expect(applyMods('a', { ctrl: false, alt: false })).toEqual({ out: 'a', used: false });
  });
  it('turns Ctrl+letter into the control code, either case', () => {
    expect(applyMods('c', { ctrl: true, alt: false })).toEqual({ out: '\x03', used: true });
    expect(applyMods('D', { ctrl: true, alt: false })).toEqual({ out: '\x04', used: true });
    expect(applyMods('[', { ctrl: true, alt: false }).out).toBe('\x1b');
  });
  it('maps Ctrl+space and Ctrl+? to NUL and DEL', () => {
    expect(applyMods(' ', { ctrl: true, alt: false }).out).toBe('\0');
    expect(applyMods('?', { ctrl: true, alt: false }).out).toBe('\x7f');
  });
  it('prefixes Alt with escape, and combines with Ctrl', () => {
    expect(applyMods('b', { ctrl: false, alt: true }).out).toBe('\x1bb');
    expect(applyMods('a', { ctrl: true, alt: true }).out).toBe('\x1b\x01');
  });
  it('leaves pastes and escape sequences alone and keeps the modifier armed', () => {
    expect(applyMods('hello', { ctrl: true, alt: false })).toEqual({ out: 'hello', used: false });
    expect(applyMods(KEYS.up, { ctrl: true, alt: false }).used).toBe(false);
  });
  it('leaves a character with no control form unchanged but still consumes the modifier', () => {
    expect(applyMods('1', { ctrl: true, alt: false })).toEqual({ out: '1', used: true });
  });
});

describe('font sizing', () => {
  it('clamps to a readable range', () => {
    expect(clampFont(3)).toBe(9);
    expect(clampFont(99)).toBe(28);
    expect(clampFont(13.6)).toBe(14);
  });
  it('scales with the pinch ratio', () => {
    expect(pinchFont(14, 1.5)).toBe(21);
    expect(pinchFont(14, 0.5)).toBe(9);
  });
});
