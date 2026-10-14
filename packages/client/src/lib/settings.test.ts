import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings } from './settings';

describe('device settings', () => {
  it('persists theme and cache TTL together without replacing the other setting', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    saveSettings({ theme: 'light', cacheTtlMs: 3600000, keepWarm: '', renderer: 'dom' }, storage);
    expect(loadSettings(storage)).toEqual({ theme: 'light', cacheTtlMs: 3600000, keepWarm: '', renderer: 'dom' });
  });
  it('validates corrupt or unsupported settings and tolerates blocked storage', () => {
    expect(loadSettings({ getItem: () => '{' })).toEqual({ theme: 'dark', cacheTtlMs: 300000, keepWarm: '', renderer: 'webgl' });
    expect(loadSettings({ getItem: () => '{"theme":"bogus","cacheTtlMs":1}' })).toEqual({ theme: 'dark', cacheTtlMs: 300000, keepWarm: '', renderer: 'webgl' });
    expect(() => saveSettings({ theme: 'system', cacheTtlMs: 300000, keepWarm: '', renderer: 'webgl' }, { setItem: () => { throw new Error('private'); } })).not.toThrow();
  });
});
