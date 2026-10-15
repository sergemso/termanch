import { describe, expect, it } from 'vitest';
import { keyBytes, subscribeMessage } from './push';

describe('push helpers', () => {
  it('turns the server key into bytes', () => {
    // 65 bytes of an uncompressed point survive base64url without padding.
    const raw = Uint8Array.from({ length: 65 }, (_, i) => (i * 7 + 4) % 256);
    const b64 = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect([...keyBytes(b64)]).toEqual([...raw]);
  });

  it('builds the subscribe message only from a complete subscription', () => {
    expect(subscribeMessage({ endpoint: 'https://p/x', keys: { p256dh: 'k', auth: 'a' } })).toEqual({ type: 'push_subscribe', endpoint: 'https://p/x', p256dh: 'k', auth: 'a' });
    expect(subscribeMessage({ endpoint: 'https://p/x', keys: { p256dh: 'k' } })).toBeNull();
    expect(subscribeMessage({ endpoint: 'https://p/x' })).toBeNull();
  });
});
