import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings } from './settings';

describe('device settings', () => {
  it('persists theme and cache TTL together without replacing the other setting', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    saveSettings({ theme: 'light', skin: 'teal', cacheTtlMs: 3600000, keepWarm: '', renderer: 'dom' }, storage);
    expect(loadSettings(storage)).toEqual({ theme: 'light', skin: 'teal', cacheTtlMs: 3600000, keepWarm: '', renderer: 'dom' });
  });
  it('falls back to the navy skin for an unknown palette', () => {
    expect(loadSettings({ getItem: () => '{"skin":"neon"}' }).skin).toBe('navy');
    expect(loadSettings({ getItem: () => '{"skin":"graphite"}' }).skin).toBe('graphite');
  });
  it('validates corrupt or unsupported settings and tolerates blocked storage', () => {
    expect(loadSettings({ getItem: () => '{' })).toEqual({ theme: 'dark', skin: 'navy', cacheTtlMs: 300000, keepWarm: '', renderer: 'webgl' });
    expect(loadSettings({ getItem: () => '{"theme":"bogus","cacheTtlMs":1}' })).toEqual({ theme: 'dark', skin: 'navy', cacheTtlMs: 300000, keepWarm: '', renderer: 'webgl' });
    expect(() => saveSettings({ theme: 'system', skin: 'navy', cacheTtlMs: 300000, keepWarm: '', renderer: 'webgl' }, { setItem: () => { throw new Error('private'); } })).not.toThrow();
  });
});
