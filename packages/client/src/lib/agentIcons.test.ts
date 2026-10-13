import { describe, expect, it } from 'vitest';
import { iconFor, isAgentIcon } from './agentIcons';

describe('icons', () => {
  it('has a colour icon for every agent the server recognises', () => {
    for (const a of ['claude', 'codex', 'copilot', 'opencode', 'kilo', 'gemini', 'aider', 'cursor-agent', 'amp', 'goose', 'qwen']) {
      const i = iconFor(a, a);
      expect(i.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(isAgentIcon(a, a)).toBe(true);
    }
  });
  it('knows common programs, ignores a login dash, and falls back for the rest', () => {
    expect(iconFor('bash').label).toBe('bash');
    expect(iconFor('-bash').label).toBe('bash');
    expect(iconFor('lazygit').glyph).toBe('⎇');
    expect(iconFor('mc').label).toBe('Midnight Commander');
    expect(iconFor('weirdtool').label).toBe('weirdtool');
    expect(isAgentIcon('bash')).toBe(false);
  });
  it('lets the server-detected agent win over the command name', () => {
    expect(iconFor('node', 'gemini').label).toBe('Gemini');
  });
});
