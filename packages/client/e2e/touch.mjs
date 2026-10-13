// Touch behaviour of the terminal against real herdr (mouse reporting) and tmux (alternate screen): a tap reaches
// a mouse-aware app as a click, and a one-finger drag scrolls. Real Chrome with touch emulation, real server.
// Usage: node e2e/touch.mjs   (needs the built client, the e2e harness and herdr on PATH)
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { randomBytes, generateKeyPairSync, sign, createPrivateKey, createPublicKey } from 'node:crypto';

const here = import.meta.dirname;
const BIN = process.env.TERMANCH_BIN ?? resolve(here, '../../../target/release/termanch-server');
const SHOTS = process.env.SHOTS ?? '';
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const signer = generateKeyPairSync('ed25519');
const signerPublic = signer.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const mint = (dk, id, login) => {
  const payload = Buffer.from(JSON.stringify({ v: 1, kid: 'e2e', sub: id, login, dpk: dk, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${payload.toString('base64url')}.${sign(null, payload, signer.privateKey).toString('base64url')}`;
};
const serverIdOf = (dir) => {
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), readFileSync(join(dir, 'server_key'))]);
  return createPublicKey(createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
};
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const dist = join(here, 'dist');
const statics = createServer((req, res) => {
  const file = join(dist, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(dist) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
async function waitFor(fn, what, ms = 15000) {
  const t = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) throw new Error(`timed out: ${what}`); await sleep(100); }
}

const webPort = await listen(statics);
const home = mkdtempSync(join(tmpdir(), 'termanch-touch-'));
const httpPort = 30000 + Math.floor(Math.random() * 30000);
const udpPort = 30000 + Math.floor(Math.random() * 30000);
const claim = randomBytes(32).toString('base64url');
const cleanEnv = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, 'xdg'), TMUX_TMPDIR: home };
for (const k of Object.keys(cleanEnv)) if (k.startsWith('HERDR_') || k === 'TERM_PROGRAM') delete cleanEnv[k];
import { mkdirSync } from 'node:fs';
mkdirSync(join(home, 'xdg/herdr'), { recursive: true });
writeFileSync(join(home, 'xdg/herdr/config.toml'), 'onboarding = false\n'); // no first-run dialog over the screen
const herdr = (...a) => execFileSync('herdr', a, { env: cleanEnv, encoding: 'utf8' });
const server = spawn(BIN, [], {
  env: { ...cleanEnv, TERMANCH_BACKEND: process.env.BACKEND ?? 'tmux', TERMANCH_CONFIG_DIR: join(home, 'config'), TERMANCH_HOST: '127.0.0.1', TERMANCH_PORT: String(httpPort),
    TERMANCH_UDP_PORT: String(udpPort), TERMANCH_PUBLIC_IP: '127.0.0.1', TERMANCH_DIRECTORY_URL: '', TERMANCH_DEV_INFO: 'on',
    TERMANCH_CERT_KEYS: `e2e=${signerPublic}`, TERMANCH_CLAIM_SECRET: claim },
  stdio: ['ignore', 'inherit', 'inherit'],
});
let browser;
try {
  await waitFor(() => fetch(`http://127.0.0.1:${httpPort}/health`).then((r) => r.ok, () => false), 'server health');
  const info = await (await fetch(`http://127.0.0.1:${httpPort}/rtc-info`)).json();
  const record = { ip: info.ip, udp_port: info.port, fingerprint: info.fingerprint };
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  // No WebGL: xterm falls back to its DOM renderer, whose rows can be read back as text.
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { return String(t).startsWith('webgl') ? null : orig.call(this, t, ...a); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`page error: ${e.message}`));
  await page.goto(`http://127.0.0.1:${webPort}/`);
  const cert = mint(await page.evaluate(() => window.__e2e.deviceKey()), 1, 'alice');
  await page.evaluate((o) => window.__e2e.start(o), { record, cert, serverId: serverIdOf(join(home, 'config')), claim });
  await waitFor(() => page.evaluate(() => window.__e2e.state === 'connected'), 'connected');
  await page.evaluate(() => window.__e2e.send({ type: 'new_session', name: 'h1' }));
  await waitFor(() => page.evaluate(() => window.__e2e.sessions.some((s) => s.id === 'h1')), 'herdr session listed');
  await page.evaluate(() => { window.__e2e.mountTerminal('h1'); window.__e2e.send({ type: 'attach', session_id: 'h1' }); });

  const screenText = () => page.evaluate(() => [...document.querySelectorAll('.xterm-rows > div')].map((r) => r.textContent.replace(/\s+$/, '')).join('\n'));
  const snap = () => JSON.parse(herdr('--session', 'h1', 'api', 'snapshot')).result.snapshot;
  const cellXY = (col, row) => page.evaluate(({ col, row }) => {
    const r = document.querySelector('.xterm-screen').getBoundingClientRect();
    const rows = document.querySelector('.xterm-rows').children;
    return { x: r.left + (col + 0.5) * (r.width / rows[0].textContent.length), y: r.top + (row + 0.5) * (r.height / rows.length) };
  }, { col, row });

  // Real touch events through the browser's input pipeline.
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  const tap = async (x, y) => { await touch('touchStart', [{ x, y }]); await sleep(60); await touch('touchEnd', []); };
  const drag = async (x, y0, y1, steps = 12) => {
    await touch('touchStart', [{ x, y: y0 }]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x, y: y0 + ((y1 - y0) * i) / steps }]); await sleep(16); }
    await touch('touchEnd', []);
  };
  const lastLine = async () => (await screenText()).split('\n').filter((l) => l.trim()).slice(-1)[0] ?? '';

  if (process.env.BACKEND === 'herdr') {
    // herdr is mouse-first. At phone width it shows a "switch" button on its top rows (or "+" for a new tab); a tap
    // on it must change the screen. A click that never arrives leaves the screen as it was.
    const target = (t) => { const l = t.split('\n'); const row = l.findIndex((x) => /switch|\s\+$/.test(x)); return row < 0 ? null : { row, col: /switch/.test(l[row]) ? l[row].indexOf('switch') + 2 : l[row].lastIndexOf('+') }; };
    await waitFor(async () => target(await screenText()), 'herdr painted', 25000);
    const before = await screenText();
    const t = target(before);
    const pt = await cellXY(t.col, t.row);
    console.log('herdr area', JSON.stringify(snap().layouts[0].area), 'tapping', JSON.stringify(before.split('\n')[t.row]));
    await tap(pt.x, pt.y);
    await sleep(1200);
    if ((await screenText()) === before) fail('a tap on herdr\'s button changed nothing on screen');
    else console.log('ok  a tap clicks herdr\'s button');
    if (process.env.HOLD) await sleep(Number(process.env.HOLD));
    throw new Error('done');
  }
  // A stand-in for a mouse-first app: it switches on SGR mouse reporting and echoes what it receives.
  await sleep(1500);
  await page.evaluate(() => window.__e2e.type("printf '\\033[?1000h\\033[?1006h'; stty raw -echo; cat -v\r"));
  await sleep(800);
  const bytes = async () => (await screenText()).replace(/\s+/g, '');
  const cellOf = (col, row) => cellXY(col, row);

  // 1. A tap arrives as a press and a release at the cell under the finger.
  const p = await cellOf(10, 8);
  await tap(p.x, p.y);
  await sleep(500);
  const afterTap = await bytes();
  const press = /\^\[\[<0;(\d+);(\d+)M/.exec(afterTap);
  const release = /\^\[\[<0;(\d+);(\d+)m/.exec(afterTap);
  if (!press || !release) fail(`a tap did not arrive as press and release: ${afterTap.slice(0, 200)}`);
  else if (press[1] !== '11' || press[2] !== '9') fail(`the tap landed on the wrong cell: ${press[0]} (want col 11, row 9)`);
  else console.log('ok  a tap arrives as a press and a release on the cell under the finger');

  // 2. A drag up sends wheel-down reports, a drag down wheel-up, about one per row dragged.
  await page.evaluate(() => (window.__e2e.sent.length = 0));
  const rowPx = p.y - (await cellOf(10, 7)).y;
  await drag(p.x, p.y + rowPx * 6, p.y, 12);
  await sleep(600);
  const up = (await bytes()).match(/\^\[\[<65;/g)?.length ?? 0;
  if (up < 4) fail(`a drag up sent ${up} wheel-down reports, want about 6`);
  else console.log(`ok  a drag up scrolls forward (${up} wheel reports)`);
  await drag(p.x, p.y, p.y + rowPx * 6, 12);
  await sleep(600);
  const down = (await bytes()).match(/\^\[\[<64;/g)?.length ?? 0;
  if (down < 4) fail(`a drag down sent ${down} wheel-up reports, want about 6`);
  else console.log(`ok  a drag down scrolls back (${down} wheel reports)`);
  if (process.env.HOLD) await sleep(Number(process.env.HOLD));
} finally {
  await browser?.close();
  server.kill();
  try { herdr('--session', 'h1', 'server', 'stop'); } catch {}
  statics.close();
  // The static server and the Chrome pipes would otherwise keep this process (and the CI job) alive.
  setTimeout(() => process.exit(process.exitCode ?? 0), 100);
}
