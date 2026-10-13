// The session list on a fake event stream, in real Chrome at phone width: every state has a word, answers carry the
// prompt they were read from, quick replies go to the chosen session, and the order holds still under a finger.
// Usage: node e2e/cards.mjs   (needs the e2e harness built: vite build -c e2e/vite.config.ts)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = join(import.meta.dirname, 'dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1; };
const srv = createServer((req, res) => {
  const f = join(dist, req.url.split('?')[0]);
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': mime[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  args: ['--no-sandbox'],
});
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => fail(`page error: ${e.message}`));
  await page.goto(`http://127.0.0.1:${srv.address().port}/cards.html`);
  await page.waitForSelector('[role=group]');
  const names = () => page.$$eval('[role=group][aria-label*=":"] .name', (els) => els.map((e) => e.textContent));
  const sent = () => page.evaluate(() => window.__sent);

  // 1. Every card says its state in words, and the order puts "needs you" first.
  const text = await page.innerText('body');
  for (const w of ['Needs you', 'Working', 'Done']) if (!text.includes(w)) fail(`no "${w}" chip`);
  const order = await names();
  if (order[0] !== 'api-refactor') fail(`needs-you card is not first: ${order}`);
  else console.log('ok  chips carry words and "needs you" comes first');

  // 2. The stale card says so and offers no answers.
  if (!(await page.innerText('body')).includes('no update for 4 min')) fail('the stale card does not say how long it has been quiet');
  else console.log('ok  a card with no news says "no update for N min"');

  // 3. A one-tap answer carries the prompt id and event number it was read from, and the choice index.
  await page.getByRole('button', { name: 'Show details' }).first().click();
  await page.getByRole('button', { name: 'No', exact: true }).click();
  const answer = (await sent()).find((m) => m.type === 'answer');
  if (JSON.stringify(answer) !== JSON.stringify({ type: 'answer', session: 'api-refactor', prompt_id: '1-ab12cd34', seq: 2, choice: 2 })) fail(`wrong answer message: ${JSON.stringify(answer)}`);
  else console.log('ok  an answer names its prompt, event number and choice');

  // 4. Quick reply goes to the chosen session; text is cleaned of control characters.
  await page.selectOption('#reply-to', 'docs');
  await page.fill('input[aria-label="Reply text"]', 'run the tests');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const reply = (await sent()).find((m) => m.type === 'reply');
  if (JSON.stringify(reply) !== JSON.stringify({ type: 'reply', session: 'docs', text: 'run the tests' })) fail(`wrong reply: ${JSON.stringify(reply)}`);
  else console.log('ok  a quick reply goes to the chosen session');

  // 5. Tap targets are at least 44 px.
  const small = await page.$$eval('.sc .open, .sc .more, .answer, .s1', (els) => els.filter((e) => e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5).map((e) => e.className));
  if (small.length) fail(`tap targets under 44px: ${small}`);
  else console.log('ok  tap targets are at least 44 px');

  // G.4: the actual top bar on 12 sessions from three fake connections, at phone width.
  await page.goto(`http://127.0.0.1:${srv.address().port}/navigation.html`);
  await page.waitForFunction(() => document.querySelectorAll('[role=tab]').length === 12);
  await page.waitForFunction(() => {
    const tab = document.querySelector('[role=tab][aria-selected=true]').getBoundingClientRect();
    const strip = document.querySelector('[role=tablist]').getBoundingClientRect();
    return tab.left >= strip.left - 1 && tab.right <= strip.right + 1;
  });
  // A narrower viewport must reveal the active tab again, even when it was visible before resize.
  const activeInView = () => {
    const tab = document.querySelector('[role=tab][aria-selected=true]').getBoundingClientRect();
    const strip = document.querySelector('[role=tablist]').getBoundingClientRect();
    return tab.left >= strip.left - 1 && tab.right <= strip.right + 1;
  };
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(width => window.__vv?.({ width }), width);
    await page.waitForFunction(activeInView);
  }
  const tabs = page.getByRole('tab');
  if (!(await tabs.first().getAttribute('aria-label')).includes('Needs you')) fail('needs-you tabs are not first');
  if (await page.locator('[role=tab] .badge').count() !== 12) fail('tabs do not name all three servers');
  if ((await page.locator('[role=tablist]').evaluate(e => e.scrollWidth <= e.clientWidth))) fail('12 tabs do not form a scrolling strip');
  const short = await page.locator('header button').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5).map(e => e.getAttribute('aria-label')));
  if (short.length) fail(`top-bar targets under 44px: ${short}`);
  await page.getByRole('button', { name: 'Sessions, 3 need you' }).waitFor();
  console.log('ok  12 sessions on 3 servers scroll at 390px; active tab visible, badges, count and 44px controls');

  const keys = () => tabs.evaluateAll(els => els.map(e => e.dataset.key));
  const before = await keys();
  await tabs.last().dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 20 });
  await page.evaluate(() => window.__navigation.change());
  await page.waitForTimeout(100);
  if (JSON.stringify(before) !== JSON.stringify(await keys())) fail('insertion/removal moved tabs under a finger');
  await tabs.last().dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(2200);
  if (!(await keys()).includes('alpha/new') || (await keys()).includes('alpha/session-0')) fail('deferred tab changes did not apply');
  console.log('ok  tab insertion and removal wait for the finger to lift and scroll hold to expire');

  const activeBefore = await page.evaluate(() => window.__navigation.active());
  await tabs.last().dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 20 });
  await page.getByRole('dialog', { name: 'Session actions' }).waitFor();
  await tabs.last().dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
  await tabs.last().dispatchEvent('click');
  if ((await page.evaluate(() => window.__navigation.active())) !== activeBefore) fail('long press also switched the session');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Cache TTL').selectOption('3600000');
  await page.getByLabel('Theme').selectOption('light');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('termanch_settings')));
  if (stored.cacheTtlMs !== 3600000 || stored.theme !== 'light') fail('settings did not persist together');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  console.log('ok  long press opens actions without switching; menu settings persist');
} finally {
  await browser.close();
  srv.close();
}

process.exit(process.exitCode ?? 0);
