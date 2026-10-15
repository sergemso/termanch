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
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
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
    return { c, t, sent, drops, states, doc };
  }

  it('suspends pings and pending timeouts while hidden, then probes and resumes on foreground', async () => {
    const { c, t, sent, drops, doc } = await connected();
    await vi.advanceTimersByTimeAsync(5000);
    const count = sent.length;
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(sent).toHaveLength(count); expect(drops).toEqual([]);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    expect(sent).toHaveLength(count + 1);
    t.onmessage!(JSON.stringify({ type: 'pong' }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(count + 2);
    c.close();
  });

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

describe('terminal lane', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function connect(lanes: boolean, channels?: string[]) {
    vi.useFakeTimers();
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
    const sent: string[] = [];
    const term: Uint8Array[] = [];
    let termOpen = true;
    const t: Transport = {
      kind: 'ws',
      onmessage: null,
      onclose: null,
      send: (x) => void sent.push(x),
      close: () => {},
      ...(lanes ? { lanes: true, onterm: null, sendTerm: (b: Uint8Array) => (termOpen ? (term.push(b), true) : false) } : {}),
    };
    const heard: string[] = [];
    const c = new Connection({
      target: async () => ({ wsUrl: 'ws://x' }),
      openers: { rtc: async () => t, ws: async () => t },
      credentials: async () => ({ cert: 'c', sign: async () => 's' }),
      onState: () => {},
      onReady: () => {},
      onFatal: () => {},
    });
    c.subscribe((m) => heard.push(m.type === 'term' ? `term:${new TextDecoder().decode(m.bytes)}` : m.type));
    c.start();
    await vi.advanceTimersByTimeAsync(10);
    t.onmessage!(JSON.stringify({ type: 'challenge', nonce: 'n', server_id: 's' }));
    await vi.advanceTimersByTimeAsync(10);
    t.onmessage!(JSON.stringify({ type: 'auth_ok', user: 'u', server_name: 's', ...(channels ? { channels } : {}) }));
    return { c, t, sent, term, heard, close: () => (termOpen = false) };
  }

  it('asks for the lane only on a carrier that has one', async () => {
    const a = await connect(true, ['term']);
    expect(JSON.parse(a.sent.find((s) => s.includes('"auth"'))!).channels).toBe(true);
    a.c.close();
    const b = await connect(false);
    expect(JSON.parse(b.sent.find((s) => s.includes('"auth"'))!).channels).toBeUndefined();
    b.c.close();
  });

  it('sends keystrokes as raw bytes and hands received bytes to listeners once the server agreed', async () => {
    const { c, t, sent, term, heard } = await connect(true, ['term']);
    c.send({ type: 'input', data: textToB64('ls\r') });
    expect(term.map((b) => new TextDecoder().decode(b))).toEqual(['ls\r']);
    expect(sent.some((s) => s.includes('"input"'))).toBe(false);
    t.onterm!(new TextEncoder().encode('hello'));
    expect(heard).toContain('term:hello');
    c.close();
  });

  it('keeps the JSON pipe when the server did not list the lane (an older server) or the lane is not open', async () => {
    const old = await connect(true);
    old.c.send({ type: 'input', data: textToB64('a') });
    expect(old.term).toEqual([]);
    expect(old.sent.some((s) => s.includes('"input"'))).toBe(true);
    old.c.close();
    const shut = await connect(true, ['term']);
    shut.close();
    shut.c.send({ type: 'input', data: textToB64('b') });
    expect(shut.sent.some((s) => s.includes('"input"'))).toBe(true);
    shut.c.close();
  });
});
