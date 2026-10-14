import { describe, expect, it } from 'vitest';
import { serverAtLeast } from './serverVersion';

describe('serverAtLeast', () => {
  it('compares major, minor and patch numerically', () => {
    expect(serverAtLeast('0.1.12', [0, 1, 12])).toBe(true);
    expect(serverAtLeast('0.1.13', [0, 1, 12])).toBe(true);
    expect(serverAtLeast('0.2.0', [0, 1, 12])).toBe(true);
    expect(serverAtLeast('0.1.9', [0, 1, 12])).toBe(false);
    expect(serverAtLeast('0.1.6+dev', [0, 1, 12])).toBe(false);
  });
  it('treats a missing or odd version as old', () => {
    expect(serverAtLeast('', [0, 1, 12])).toBe(false);
    expect(serverAtLeast('dev', [0, 1, 12])).toBe(false);
  });
});
