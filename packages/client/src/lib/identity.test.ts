import { describe, expect, it } from 'vitest';
import { identityOf } from './identity';

describe('identityOf', () => {
  it('gives the same number to the same object and different ones to different objects', () => {
    const a = {}, b = {};
    expect(identityOf(a)).toBe(identityOf(a));
    expect(identityOf(a)).not.toBe(identityOf(b));
    expect(identityOf(a)).toBeGreaterThan(0);
  });
  it('is 0 for no object', () => {
    expect(identityOf(null)).toBe(0);
    expect(identityOf(undefined)).toBe(0);
  });
});
