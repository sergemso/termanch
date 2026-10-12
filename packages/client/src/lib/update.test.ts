import { describe, expect, it } from 'vitest';
import { bundleOf, checkForUpdate } from './update';

describe('update check', () => {
  it('finds the bundle named in an index.html', () => {
    expect(bundleOf('<script type="module" src="/assets/index-AbC_12-x.js"></script>')).toBe('/assets/index-AbC_12-x.js');
    expect(bundleOf('<html></html>')).toBeNull();
  });

  it('says no when the page was not built with a hashed bundle (dev)', async () => {
    expect(await checkForUpdate((async () => new Response('x')) as typeof fetch)).toBe(false);
  });
});
