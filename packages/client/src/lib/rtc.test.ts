import { describe, it, expect } from 'vitest';
import { buildAnswer, setIceCredentials, randomUfrag, SERVER_UFRAG, SERVER_PWD } from './rtc';

const rec = { ip: '185.199.108.153', udp_port: 4443, fingerprint: 'sha-256 ' + Array(32).fill('AB').join(':') };

describe('buildAnswer', () => {
  const sdp = buildAnswer(rec, '0');
  it('describes an ICE-lite passive DTLS server with one host candidate', () => {
    for (const line of [
      'a=ice-lite', 'a=setup:passive', `a=ice-ufrag:${SERVER_UFRAG}`, `a=ice-pwd:${SERVER_PWD}`, `a=fingerprint:${rec.fingerprint}`,
      'm=application 4443 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 185.199.108.153', 'a=mid:0',
      'a=candidate:1 1 UDP 2113929471 185.199.108.153 4443 typ host', 'a=end-of-candidates',
    ]) expect(sdp.split('\r\n')).toContain(line);
    expect(sdp.endsWith('\r\n')).toBe(true);
  });

  it('uses IP6 lines for IPv6 servers and the mid of the offer', () => {
    const v6 = buildAnswer({ ...rec, ip: '2606:4700:4700::1111' }, 'data').split('\r\n');
    expect(v6).toContain('c=IN IP6 2606:4700:4700::1111');
    expect(v6).toContain('a=group:BUNDLE data');
  });

  it('keeps the server password long enough for browsers (22+ characters)', () => {
    expect(SERVER_PWD.length).toBeGreaterThanOrEqual(22);
  });
});

describe('setIceCredentials', () => {
  it('replaces both ufrag and pwd with the same string and touches nothing else', () => {
    const offer = 'v=0\r\na=ice-ufrag:abcd\r\na=ice-pwd:efghefghefghefghefghefgh\r\na=mid:0\r\n';
    const out = setIceCredentials(offer, 'X'.repeat(32));
    expect(out).toBe(`v=0\r\na=ice-ufrag:${'X'.repeat(32)}\r\na=ice-pwd:${'X'.repeat(32)}\r\na=mid:0\r\n`);
  });

  it('generates alphanumeric ufrags the server accepts (16-64 chars)', () => {
    const u = randomUfrag();
    expect(u).toMatch(/^[a-z0-9]{32}$/);
    expect(randomUfrag()).not.toBe(u);
  });
});
