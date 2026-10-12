// Browser end-to-end test and resource gates (issue #21). Real Chromium, real termanch-server, real tmux;
// only the hosted function that issues certificates is a stand-in (here: a key pair made in this script). Usage: node e2e/run.mjs   (needs a built server, a built harness, and Chrome)
//   TERMANCH_BIN   server binary          (default ../../target/release/termanch-server)
//   CHROME_PATH    Chrome/Chromium binary (default: Playwright's "chrome" channel)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { randomBytes, generateKeyPairSync, sign, createPrivateKey, createPublicKey } from 'node:crypto';

const here = import.meta.dirname;
const BIN = process.env.TERMANCH_BIN ?? resolve(here, '../../../target/release/termanch-server');
const LIMITS = { rssMb: 300, cpuShare: 0.5 }; // issue #21: RSS with 10 sessions, CPU for 10k lines/s
const TICKS = 100; // clock ticks per second on Linux

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const randomPort = () => 30000 + Math.floor(Math.random() * 30000);

// --- stand-ins and helpers ---------------------------------------------------------------------------
// Stand-in for the Pages function: mints device certificates exactly like functions/api/oauth/exchange.ts.
const signer = generateKeyPairSync('ed25519');
const signerPublic = signer.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const mint = (deviceKey, id, login, exp = Math.floor(Date.now() / 1000) + 3600) => {
  const payload = Buffer.from(JSON.stringify({ v: 1, kid: 'e2e', sub: id, login, dpk: deviceKey, exp }));
  return `${payload.toString('base64url')}.${sign(null, payload, signer.privateKey).toString('base64url')}`;
};
// The server's id is its public key; the client pins it, and the signed challenge names it.
const serverIdOf = (configDir) => {
  const seed = readFileSync(join(configDir, 'server_key'));
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  return createPublicKey(createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }))
    .export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
};
// The real client build (pnpm build), served with the single-page-app fallback.
const appDist = resolve(here, '../dist');
const appServer = createServer((req, res) => {
  const path = req.url.split('?')[0];
  let file = join(appDist, path);
  if (!file.startsWith(appDist) || !existsSync(file) || path === '/') file = join(appDist, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const dist = join(here, 'dist');
const statics = createServer((req, res) => {
  const file = join(dist, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(dist) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});

function procStat(pid) {
  const status = readFileSync(`/proc/${pid}/status`, 'utf8');
  const rssKb = Number(/VmRSS:\s+(\d+)/.exec(status)[1]);
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
  return { rssMb: rssKb / 1024, cpuSec: (Number(stat[11]) + Number(stat[12])) / TICKS };
}

async function waitFor(fn, what, ms = 15000) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

// --- run ---------------------------------------------------------------------------------------------
if (!existsSync(BIN)) throw new Error(`server binary not found: ${BIN}`);
if (!existsSync(join(appDist, 'index.html'))) throw new Error('client not built: run pnpm build');
if (!existsSync(join(dist, 'index.html'))) throw new Error('harness not built: run vite build -c e2e/vite.config.ts');

const webPort = await listen(statics);
const appPort = await listen(appServer);
const home = mkdtempSync(join(tmpdir(), 'termanch-e2e-'));
const httpPort = randomPort();
const udpPort = randomPort();
const claim = randomBytes(32).toString('base64url');

const server = spawn(BIN, [], {
  env: {
    ...process.env,
    TMUX_TMPDIR: home, // a private tmux server: never touches the developer's sessions
    TERMANCH_CONFIG_DIR: join(home, 'config'),
    TERMANCH_HOST: '127.0.0.1',
    TERMANCH_PORT: String(httpPort),
    TERMANCH_UDP_PORT: String(udpPort),
    TERMANCH_PUBLIC_IP: '127.0.0.1',
    TERMANCH_DIRECTORY_URL: '',
    TERMANCH_DEV_INFO: 'on',
    TERMANCH_CERT_KEYS: `e2e=${signerPublic}`,
    TERMANCH_CLAIM_SECRET: claim,
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let browser;
try {
  await waitFor(() => fetch(`http://127.0.0.1:${httpPort}/health`).then((r) => r.ok, () => false), 'server health');
  const info = await (await fetch(`http://127.0.0.1:${httpPort}/rtc-info`)).json();
  const record = { ip: info.ip, udp_port: info.port, fingerprint: info.fingerprint };
  const serverId = serverIdOf(join(home, 'config'));

  browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'],
  });
  const open = async (who, claimSecret, pinnedId = serverId) => {
    const page = await (await browser.newContext()).newPage();
    page.on('pageerror', (e) => fail(`page error: ${e.message}`));
    await page.goto(`http://127.0.0.1:${webPort}/`);
    const cert = mint(await page.evaluate(() => window.__e2e.deviceKey()), who.id, who.login);
    await page.evaluate((o) => window.__e2e.start(o), { record, cert, serverId: pinnedId, claim: claimSecret });
    return page;
  };
  const e2e = (page, fn, arg) => page.evaluate(fn, arg);

  // 1. Claim: the first GitHub user to present the secret becomes the owner, over WebRTC.
  const alice = await open({ id: 1, login: 'alice' }, claim);
  await waitFor(() => e2e(alice, () => window.__e2e.state === 'connected'), 'alice connected');
  if ((await e2e(alice, () => window.__e2e.kind())) !== 'rtc') fail('expected the WebRTC transport');
  console.log('ok  login and claim over WebRTC');

  // 2. Someone else is refused.
  const bob = await open({ id: 2, login: 'bob' });
  await waitFor(() => e2e(bob, () => window.__e2e.fatal !== ''), 'bob refused');
  console.log('ok  a second GitHub user is refused');

  // 2b. A server that relays another server's challenge gets no signature: the client signs only for the id it pinned.
  const relayed = await open({ id: 1, login: 'alice' }, undefined, 'not-this-server');
  await waitFor(() => e2e(relayed, () => window.__e2e.fatal.includes('not the one you added')), 'pinned id enforced');
  console.log('ok  the challenge must name the server the client pinned');

  // 2c. Soft keyboard: with a faked visualViewport (what iOS reports), the key row must stay inside the
  // visible area both when the viewport only shrinks (Android) and when Safari also pans it (iPhone).
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => {
      const vv = Object.assign(new EventTarget(), { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { value: vv });
      window.__vv = (patch, ev) => { Object.assign(vv, patch); vv.dispatchEvent(new Event(ev)); };
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail(`page error: ${e.message}`));
    await page.goto(`http://127.0.0.1:${webPort}/shell.html`);
    const keyRowInView = () =>
      page.evaluate(() => {
        const r = document.querySelector('[role=toolbar]').getBoundingClientRect();
        const vv = window.visualViewport;
        return { top: r.top, bottom: r.bottom, headerTop: document.querySelector('header').getBoundingClientRect().top, viewTop: vv.offsetTop, viewBottom: vv.offsetTop + vv.height };
      });
    // Flush with the keyboard (no gap below, nothing cut off), and the header still at the top of the view.
    const inside = (m) => Math.abs(m.bottom - m.viewBottom) <= 1 && m.top >= m.viewTop - 0.5 && Math.abs(m.headerTop - m.viewTop) <= 1;
    const closed = await keyRowInView();
    if (!inside(closed)) fail(`key row outside the view with no keyboard: ${JSON.stringify(closed)}`);
    await page.evaluate(() => window.__vv({ height: 800 - 336 }, 'resize'));
    const shrunk = await keyRowInView();
    if (!inside(shrunk)) fail(`key row hidden when the viewport shrinks: ${JSON.stringify(shrunk)}`);
    await page.evaluate(() => window.__vv({ height: 800 - 336 - 44, offsetTop: 180 }, 'scroll'));
    const panned = await keyRowInView();
    if (!inside(panned)) fail(`key row hidden when Safari pans the viewport: ${JSON.stringify(panned)}`);
    await page.evaluate(() => window.__vv({ height: 800, offsetTop: 0 }, 'resize'));
    if (!inside(await keyRowInView())) fail('key row not restored after the keyboard closed');
    // Toggle keys must return to their normal colour after a tap on a touch screen (no sticky :hover).
    const ctrl = page.getByRole('button', { name: 'Ctrl' });
    const bg = () => ctrl.evaluate((el) => getComputedStyle(el).backgroundColor);
    const normal = await bg();
    await ctrl.tap();
    await sleep(400); // the colour change is a 150 ms transition
    const on = await bg();
    await ctrl.tap();
    await sleep(400);
    const off = await bg();
    if (on === normal) fail('Ctrl does not show it is on');
    if (off !== normal) fail(`Ctrl stays highlighted after being toggled off: ${off} instead of ${normal}`);
    await ctx.close();
    console.log('ok  the key row stays visible when the keyboard opens, shrinks the view or pans it');
  }

  // 3. Create a session, type, see the output.
  await e2e(alice, () => window.__e2e.send({ type: 'new_session', name: 's1' }));
  await waitFor(() => e2e(alice, () => (window.__e2e.send({ type: 'list_sessions' }), window.__e2e.sessions.length > 0)), 'session listed');
  const id = await e2e(alice, () => window.__e2e.sessions[0].id);
  await e2e(alice, (id) => window.__e2e.send({ type: 'attach', session_id: id }), id);
  await sleep(500);
  await e2e(alice, () => window.__e2e.type('echo marker-$((20+22))\r'));
  await waitFor(() => e2e(alice, () => window.__e2e.output.includes('marker-42')), 'typed output');
  console.log('ok  typed a command and saw its output');

  // 4. Drop the transport; the client must reconnect, re-attach, and the screen must come back.
  await e2e(alice, () => { window.__e2e.clear(); window.__e2e.dropTransport(); });
  await waitFor(() => e2e(alice, () => window.__e2e.ready >= 2 && window.__e2e.state === 'connected'), 'reconnected', 60000);
  await e2e(alice, (id) => window.__e2e.send({ type: 'attach', session_id: id }), id);
  await waitFor(() => e2e(alice, () => window.__e2e.output.includes('marker-42')), 'screen replay after reconnect');
  console.log('ok  reconnected and the earlier screen was replayed');

  // 5. Gate: server RSS with 10 sessions open.
  for (let i = 2; i <= 10; i++) {
    await e2e(alice, (n) => window.__e2e.send({ type: 'new_session', name: `s${n}` }), i);
    await sleep(150);
  }
  await waitFor(() => e2e(alice, () => (window.__e2e.send({ type: 'list_sessions' }), window.__e2e.sessions.length >= 10)), '10 sessions');
  const ids = await e2e(alice, () => window.__e2e.sessions.map((s) => s.id));
  for (const sid of ids) {
    await e2e(alice, (sid) => window.__e2e.send({ type: 'attach', session_id: sid }), sid);
    await sleep(150);
  }
  const rss = procStat(server.pid).rssMb;
  console.log(`    server RSS with ${ids.length} sessions: ${rss.toFixed(1)} MB (limit ${LIMITS.rssMb})`);
  if (rss > LIMITS.rssMb) fail(`server RSS ${rss.toFixed(1)} MB exceeds ${LIMITS.rssMb} MB`);

  // 6. Gate: 10 s of continuous terminal output must cost the server under half a CPU. (tmux repaints the
  // screen instead of forwarding every line, so the check is on CPU over time, not on line counts.)
  await e2e(alice, () => window.__e2e.clear());
  const before = procStat(server.pid).cpuSec;
  const t0 = Date.now();
  await e2e(alice, () => window.__e2e.type("timeout 10 sh -c 'while :; do seq 1 5000; done'; echo end-$((40+2))\r"));
  await waitFor(() => e2e(alice, () => window.__e2e.output.includes('end-42')), 'throughput output', 60000);
  const wall = (Date.now() - t0) / 1000;
  const cpu = procStat(server.pid).cpuSec - before;
  const bytes = await e2e(alice, () => window.__e2e.output.length);
  const share = cpu / wall;
  console.log(`    10 s of output (${(bytes / 1048576).toFixed(1)} MB reached the browser): ${cpu.toFixed(2)} CPU-s in ${wall.toFixed(1)} s = ${(share * 100).toFixed(0)}% of one vCPU (limit ${LIMITS.cpuShare * 100}%)`);
  if (bytes < 100000) fail(`only ${bytes} bytes of output reached the browser`);
  if (share > LIMITS.cpuShare) fail(`relaying output used ${(share * 100).toFixed(0)}% of a vCPU, over ${LIMITS.cpuShare * 100}%`);

  // 7. The real app on a phone: connect, open a session, go back to the server list and connect again.
  // Each lap used to risk a hang or a broken screen, so run several and fail on any page error.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`http://127.0.0.1:${appPort}/`);
    const deviceKey = await page.evaluate(async () => {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      await new Promise((ok, no) => {
        const r = indexedDB.open('termanch', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('device');
        r.onsuccess = () => {
          const tx = r.result.transaction('device', 'readwrite');
          tx.objectStore('device').put(pair, 'key');
          tx.oncomplete = ok;
          tx.onerror = () => no(tx.error);
        };
        r.onerror = () => no(r.error);
      });
      const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
      return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    });
    await page.evaluate(
      ([cert, item]) => {
        localStorage.setItem('termanch_auth', JSON.stringify({ cert, login: 'alice' }));
        localStorage.setItem('termanch_servers', JSON.stringify([item]));
      },
      [mint(deviceKey, 1, 'alice'), { server_url: '', server_id: serverId, server_name: 'e2e-server', registered_at: Date.now(), record }],
    );
    await page.reload();
    // Removing a server asks first; declining keeps it.
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Remove server' }).click();
    if (!(await page.getByText('e2e-server').isVisible())) fail('the server was removed without confirmation');
    for (let lap = 1; lap <= 3; lap++) {
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.locator('.dot.ok').waitFor({ timeout: 20000 }).catch(async (e) => {
        console.log('page errors:', errors, '\n', (await page.locator('body').innerText()).slice(0, 400));
        throw e;
      });
      // Connecting lands in a session by itself: the top bar names it instead of saying "Sessions".
      await page.waitForFunction(() => !document.querySelector('button[aria-label=Sessions]')?.textContent?.includes('Sessions'), null, { timeout: 5000 });
      await page.getByRole('button', { name: 'Sessions' }).click();
      await page.getByText('s1', { exact: true }).first().click();
      await page.locator('.xterm').waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: 'Sessions' }).click();
      await page.getByRole('button', { name: '← Servers' }).click();
      await page.getByText('Your Servers').waitFor({ timeout: 5000 });
      console.log(`    lap ${lap}: connect, session, back to servers`);
    }
    if (errors.length) fail(`app flow raised errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
    console.log('ok  connect, open a session and return to the server list, three times, on a phone');
  }
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  server.kill();
  statics.close();
  rmSync(home, { recursive: true, force: true });
}
if (process.exitCode) process.exit(process.exitCode);
console.log('browser end-to-end: all checks passed');
process.exit(0);
