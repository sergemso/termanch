import { describe, it, expect } from 'vitest';
import { wsUrl } from './servers';

describe('wsUrl', () => {
  it('maps https tunnel urls to wss /ws', () => {
    expect(wsUrl('https://abc.trycloudflare.com')).toBe('wss://abc.trycloudflare.com/ws');
  });
  it('keeps an explicit path and maps http to ws', () => {
    expect(wsUrl('http://localhost:8080/ws')).toBe('ws://localhost:8080/ws');
  });
});
