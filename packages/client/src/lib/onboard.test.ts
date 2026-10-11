import { describe, it, expect, vi } from 'vitest';
import { installCommand, claimLink, parseClaim, pollDelay, waitForServer, ClaimTimeout, CLAIM_WINDOW_MS, type WaitDeps } from './onboard';
import type { DirRecord } from './directory';

const S = 'A'.repeat(43);
const rec = { server_id: 'K'.repeat(43) } as DirRecord;

describe('claim text', () => {
  it('builds one command that carries the secret and the origin', () => {
    expect(installCommand('https://app.example.dev', S)).toBe(`curl -fsSL https://app.example.dev/install.sh | sh -s -- ${S} https://app.example.dev`);
  });

  it('round-trips through a link the phone camera can open', () => {
    const link = claimLink('https://app.example.dev/', S);
    expect(link).toBe(`https://app.example.dev/#claim=${S}`);
    expect(parseClaim(link)).toBe(S);
    expect(parseClaim(`#claim=${S}`)).toBe(S);
    expect(parseClaim(`  ${S}\n`)).toBe(S);
  });

  it('rejects anything that is not a 43-character secret', () => {
    for (const bad of ['', 'short', `#claim=${'A'.repeat(42)}`, `#claim=${'A'.repeat(44)}`, 'https://evil.example/#add=xyz', `x ${'!'.repeat(43)}`]) {
      expect(parseClaim(bad), bad).toBeNull();
    }
  });
});

describe('waitForServer', () => {
  const deps = (seq: Array<DirRecord | null | Error>): WaitDeps & { slept: number[] } => {
    let t = 0;
    const slept: number[] = [];
    return {
      slept,
      pending: vi.fn(async () => {
        const next = seq.shift();
        if (next instanceof Error) throw next;
        return next ?? null;
      }),
      sleep: async (ms) => { slept.push(ms); t += ms; },
      now: () => t,
    };
  };

  it('backs off 2s, 4s, 8s, then 10s and returns the record once it appears', async () => {
    const d = deps([null, null, null, null, null, rec]);
    expect(await waitForServer('o', S, new AbortController().signal, d)).toBe(rec);
    expect(d.slept).toEqual([2000, 4000, 8000, 10000, 10000]);
    expect(pollDelay(0)).toBe(2000);
    expect(pollDelay(99)).toBe(10000);
  });

  it('keeps waiting through directory hiccups', async () => {
    const d = deps([new Error('directory answered 500'), new TypeError('fetch failed'), rec]);
    expect(await waitForServer('o', S, new AbortController().signal, d)).toBe(rec);
  });

  it('stops at once when a record fails verification', async () => {
    const d = deps([new Error('announcement does not prove knowledge of the claim secret'), rec]);
    await expect(waitForServer('o', S, new AbortController().signal, d)).rejects.toThrow('claim secret');
    expect(d.slept).toEqual([]);
  });

  it('gives up after the 15-minute claim window', async () => {
    const d = deps([]);
    await expect(waitForServer('o', S, new AbortController().signal, d)).rejects.toBeInstanceOf(ClaimTimeout);
    expect(d.slept.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(CLAIM_WINDOW_MS);
    expect(d.slept.length).toBeLessThan(100);
  });

  it('can be cancelled', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(waitForServer('o', S, ac.signal, deps([rec]))).rejects.toThrow('aborted');
  });
});
