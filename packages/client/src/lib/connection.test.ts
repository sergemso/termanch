import { afterEach, describe, it, expect, vi } from 'vitest';
import { backoffDelay, b64ToBytes, textToB64, Connection } from './connection';
import type { Transport } from './transport';

describe('backoffDelay', () => {
  it('doubles from 1s up to a 30s cap', () => {
    const none = () => 0;
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((n) => backoffDelay(n, none))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
  it('adds at most 25% jitter', () => {
    expect(backoffDelay(0, () => 1)).toBe(1250);
  });
});

describe('utf-8 base64', () => {
  it('round-trips non-latin text as bytes', () => {
    const bytes = b64ToBytes(textToB64('héllo ✓'));
    expect(new TextDecoder().decode(bytes)).toBe('héllo ✓');
  });
});

describe('heartbeat', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function fake() {
    const sent: string[] = [];
    const t: Transport = { kind: 'ws', onmessage: null, onclose: null, send: (x) => void sent.push(x), close: () => {} };
    return { t, sent };
  }

  async function connected() {
    vi.useFakeTimers();
    const doc = { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
    const { t, sent } = fake();
    const drops: string[] = [];
    const states: string[] = [];
    const c = new Connection({
      target: async () => ({ wsUrl: 'ws://x' }),
      openers: { rtc: async () => t, ws: async () => t },
      credentials: async () => ({ cert: 'c', sign: async () => 's' }),
      onState: (s) => states.push(s),
      onReady: () => {},
      onFatal: () => {},
      onDrop: (reason) => drops.push(reason),
    });
    c.start();
    await vi.advanceTimersByTimeAsync(10);
    t.onmessage!(JSON.stringify({ type: 'challenge', nonce: 'n', server_id: 's' }));
    await vi.advanceTimersByTimeAsync(10);
    t.onmessage!(JSON.stringify({ type: 'auth_ok', user: 'u', server_name: 's' }));
    return { c, t, sent, drops, states };
  }

  it('survives a reply that is several seconds late, which is normal on a mobile link', async () => {
    const { t, drops, states } = await connected();
    await vi.advanceTimersByTimeAsync(5000); // a ping goes out
    await vi.advanceTimersByTimeAsync(8000); // 8 s without a reply
    expect(drops).toEqual([]);
    t.onmessage!(JSON.stringify({ type: 'pong' }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(drops).toEqual([]);
    expect(states[states.length - 1]).toBe('connected');
  });

  it('drops a connection that has been silent for the whole window, and says why', async () => {
    const { c, drops, states } = await connected();
    await vi.advanceTimersByTimeAsync(5000 + 12000 + 100);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toContain('no reply for 12 s');
    expect(c.drops).toBe(1);
    expect(states).toContain('reconnecting');
  });
});
