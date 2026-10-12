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
if (!existsSync(join(dist, 'index.html'))) throw new Error('harness not built: run vite build -c e2e/vite.config.ts');

const webPort = await listen(statics);
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
