import { describe, it, expect } from 'vitest';
import { backoffDelay, b64ToBytes, textToB64 } from './connection';

describe('backoffDelay', () => {
  it('doubles from 1s up to a 30s cap', () => {
    const none = () => 0;
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((n) => backoffDelay(n, none))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
  it('adds at most 25% jitter', () => {
    expect(backoffDelay(0, () => 1)).toBe(1250);
  });
});

describe('utf-8 base64', () => {
  it('round-trips non-latin text as bytes', () => {
    const bytes = b64ToBytes(textToB64('héllo ✓'));
    expect(new TextDecoder().decode(bytes)).toBe('héllo ✓');
  });
});
