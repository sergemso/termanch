import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { claimHash, verifyClaimProof, randomClaimSecret, type DirRecord } from './directory';

const fixture = JSON.parse(readFileSync(new URL('../../../server/testdata/announce.json', import.meta.url), 'utf8')) as DirRecord;

describe('claim secrets', () => {
  it('hashes and proves the way the Rust server does (fixture signed with "fixture-secret")', async () => {
    expect(await claimHash('fixture-secret')).toBe(fixture.claim_hash);
    expect(await verifyClaimProof('fixture-secret', fixture)).toBe(true);
  });

  it('rejects a wrong secret and a record whose address was swapped', async () => {
    expect(await verifyClaimProof('another-secret', fixture)).toBe(false);
    expect(await verifyClaimProof('fixture-secret', { ...fixture, ip: '185.199.108.154' })).toBe(false);
    expect(await verifyClaimProof('fixture-secret', { ...fixture, fingerprint: fixture.fingerprint.replace('AB', 'AC') })).toBe(false);
  });

  it('generates url-safe 43-character secrets', () => {
    const s = randomClaimSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomClaimSecret()).not.toBe(s);
  });
});
