import { describe, it, expect } from 'vitest';
import { wsUrl, parseAddFragment } from './servers';

describe('wsUrl', () => {
  it('maps https tunnel urls to wss /ws', () => {
    expect(wsUrl('https://abc.trycloudflare.com')).toBe('wss://abc.trycloudflare.com/ws');
  });
  it('keeps an explicit path and maps http to ws', () => {
    expect(wsUrl('http://localhost:8080/ws')).toBe('ws://localhost:8080/ws');
  });
});

describe('parseAddFragment', () => {
  const frag = (o: object) => '#add=' + btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  it('reads url, claim token and name', () => {
    expect(parseAddFragment(frag({ u: 'https://s.dev', t: 'tok', n: 'vps' }))).toEqual({
      server_url: 'https://s.dev',
      server_name: 'vps',
      claim: 'tok',
    });
  });
  it('rejects other fragments and malformed payloads', () => {
    expect(parseAddFragment('#other')).toBeNull();
    expect(parseAddFragment('#add=!!!')).toBeNull();
    expect(parseAddFragment(frag({ u: 'not a url', t: 'x' }))).toBeNull();
    expect(parseAddFragment(frag({ t: 'x' }))).toBeNull();
  });
});
