import { describe, expect, it } from 'vitest';
import { add, clean, DEFAULTS, load, MAX_LEN, MAX_SNIPPETS, remove, save } from './snippets';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('snippets', () => {
  it('starts from the defaults, saves, deletes and survives a reload', () => {
    const st = mem();
    expect(load(st)).toEqual(DEFAULTS);
    let list = add(load(st), 'deploy to staging');
    save(list, st);
    expect(load(st)).toContain('deploy to staging');
    list = remove(list, 'continue');
    save(list, st);
    expect(load(st)).not.toContain('continue');
  });
  it('cleans control characters, drops duplicates and empties, and caps length and count', () => {
    expect(clean('a\u001b[31m\nb\r\tc')).toBe('a [31m b c');
    expect(add(['x'], 'x')).toEqual(['x']);
    expect(add(['x'], '  \n ')).toEqual(['x']);
    expect(clean('y'.repeat(500)).length).toBe(MAX_LEN);
    let list: string[] = [];
    for (let i = 0; i < 30; i++) list = add(list, `s${i}`);
    expect(list).toHaveLength(MAX_SNIPPETS);
    expect(list[list.length - 1]).toBe('s29');
  });
  it('ignores a corrupt store', () => {
    expect(load({ getItem: () => '{not json' })).toEqual(DEFAULTS);
    expect(load({ getItem: () => JSON.stringify([1, 'ok', '']) })).toEqual(['ok']);
  });
});
