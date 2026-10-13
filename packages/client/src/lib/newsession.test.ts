import { describe, expect, it } from 'vitest';
import { recentDirs, suggestName, TEMPLATES, validDir, validName } from './newsession';

const w = (path: string) => ({ index: 0, name: 'n', command: 'bash', path, active: false });

describe('new session', () => {
  it('offers every agent the server recognises, plus a plain shell', () => {
    const ids = TEMPLATES.map(t => t.id);
    for (const a of ['claude', 'codex', 'copilot', 'opencode', 'kilo', 'gemini', 'aider', 'cursor-agent', 'amp', 'goose', 'qwen', 'shell']) expect(ids).toContain(a);
  });
  it('names a session after its directory and agent, and keeps the name unique and valid', () => {
    expect(suggestName('/home/u/my app', 'claude', [])).toBe('my-app-claude');
    expect(suggestName('/srv/api', 'shell', [])).toBe('api');
    expect(suggestName('/srv/api', 'shell', ['api', 'api-2'])).toBe('api-3');
    expect(suggestName('', '', [])).toBe('session');
    expect(validName(suggestName('/x/' + 'a'.repeat(200), 'claude', []))).toBe(true);
    expect(validName(suggestName('/x/ünï', 'codex', []))).toBe(true);
  });
  it('lists directories in use on one server, most used first', () => {
    const windows = {
      's1/a': { windows: [w('/srv/app'), w('/srv/app')], representative: 0 },
      's1/b': { windows: [w('/srv/api')], representative: 0 },
      's2/c': { windows: [w('/other')], representative: 0 },
    };
    expect(recentDirs(windows, 's1/')).toEqual(['/srv/app', '/srv/api']);
    expect(recentDirs(windows, 's1/', 1)).toEqual(['/srv/app']);
  });
  it('accepts only absolute, clean directories (or none)', () => {
    expect(validDir('')).toBe(true);
    expect(validDir('/srv/app')).toBe(true);
    expect(validDir('app')).toBe(false);
    expect(validDir('/a\nb')).toBe(false);
  });
});
