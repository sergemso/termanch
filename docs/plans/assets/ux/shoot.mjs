// Screenshots every direction/screen/width/theme. Usage: node shoot.mjs [chromium|webkit]
// Run from this directory; needs playwright-core from packages/client.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(path.resolve('../../../../packages/client/package.json'));
const pw = require('playwright-core');
const engine = process.argv[2] || 'webkit';
const dirs = ['a-calm', 'b-dense', 'c-focus'];
const screens = ['home', 'empty', 'empty-servers', 'decision', 'session-t1', 'session-t3', 'terminal', 'report', 'palette'];
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const browser = await pw[engine].launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const errors = [];
for (const d of dirs) for (const [sz, vp] of Object.entries(sizes)) for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: sz === 'phone' ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${d} ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${d} ${e.message}`));
  for (const s of screens) {
    if (s === 'palette' && sz === 'phone') continue;
    const q = `?theme=${theme}${s === 'palette' ? '&palette' : ''}`;
    await page.goto(pathToFileURL(path.resolve(d, 'index.html')).href + q + '#' + (s === 'palette' ? 'home' : s));
    await page.waitForTimeout(80);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (over > 0) errors.push(`${d} ${s} ${sz} ${theme}: horizontal overflow ${over}px`);
    fs.mkdirSync(`${d}/screens`, { recursive: true });
    await page.screenshot({ path: `${d}/screens/${s}-${sz}-${theme}.png` });
    if (sz === 'phone' && ['home', 'report'].includes(s)) {
      // Full length, bottom bar hidden (a fixed bar would float mid-page in a full-page capture).
      await page.addStyleTag({ content: '.bottombar{display:none!important}' });
      await page.screenshot({ path: `${d}/screens/${s}-phone-${theme}-full.png`, fullPage: true });
    }
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no console errors');
