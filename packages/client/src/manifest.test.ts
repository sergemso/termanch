import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('the web app manifest', () => {
  const m = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  it('asks the browser to open in-scope links in the installed app and to reuse its window', () => {
    expect(m.scope).toBe('/');
    expect(m.handle_links).toBe('preferred');
    expect(m.launch_handler.client_mode).toEqual(['navigate-existing', 'auto']);
  });
});
