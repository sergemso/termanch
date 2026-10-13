import { describe, expect, it } from 'vitest';
import { b64url, certExpiry, challengeMessage, deviceKey, publicKeyB64, signChallenge, type KeyStore } from './device';

function memoryStore(): KeyStore & { puts: number } {
  let pair: CryptoKeyPair | undefined;
  return {
    puts: 0,
    async get() {
      return pair;
    },
    async put(p) {
      this.puts++;
      pair = p;
    },
  };
}

describe('device key', () => {
  it('is created once, kept, and cannot be exported', async () => {
    const store = memoryStore();
    const a = await deviceKey(store);
    const b = await deviceKey(store);
    expect(b).toBe(a);
    expect(store.puts).toBe(1);
    expect(a.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('pkcs8', a.privateKey)).rejects.toThrow();
  });

  it('exports an uncompressed P-256 public key', async () => {
    const raw = Uint8Array.from(atob((await publicKeyB64(await deviceKey(memoryStore()))).replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0));
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(4);
  });

  it('signs a challenge that verifies only for that server and nonce', async () => {
    const pair = await deviceKey(memoryStore());
    const sig = await signChallenge(pair, 'server-a', 'nonce-1');
    const raw = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    expect(raw.length).toBe(64);
    const verify = (server: string, nonce: string) =>
      crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, raw, challengeMessage(server, nonce));
    expect(await verify('server-a', 'nonce-1')).toBe(true);
    expect(await verify('server-b', 'nonce-1')).toBe(false);
    expect(await verify('server-a', 'nonce-2')).toBe(false);
  });

  it('reads the expiry of a certificate and treats junk as expired', () => {
    const body = b64url(new TextEncoder().encode(JSON.stringify({ exp: 1234 })));
    expect(certExpiry(`${body}.sig`)).toBe(1234);
    expect(certExpiry('garbage')).toBe(0);
  });
});

describe('avatar', () => {
  const cert = (payload: object) => `${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`;
  it('reads the account id from the certificate and builds a one-host URL', async () => {
    const { certUserId, avatarUrl } = await import('./device');
    expect(certUserId(cert({ sub: 12345, login: 'a' }))).toBe(12345);
    expect(certUserId('garbage')).toBe(0);
    expect(avatarUrl(12345)).toBe('https://avatars.githubusercontent.com/u/12345?s=64&v=4');
    expect(avatarUrl(0)).toBe('');
  });
});
