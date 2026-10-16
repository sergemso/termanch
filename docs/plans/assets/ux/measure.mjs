// Measures phone layouts: terminal height share and tap targets under 44 px. Usage: node measure.mjs (CHROME_PATH set)
import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const require = createRequire(path.resolve('../../../../packages/client/package.json'));
const { chromium } = require('playwright-core');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const dirs = ['m1-decision', 'm2-terminal', 'm3-split'];
const screens = ['home', 'decision', 'terminal', 'terminal-kbd', 'terminal-more', 'fleet'];
for (const d of dirs) {
  const out = [];
  for (const s of screens) {
    await p.goto(pathToFileURL(path.resolve(d, 'index.html')).href + '?skin=navy&theme=dark#' + s);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(120);
    const r = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight; };
      const term = document.querySelector('.tbody, .m3-bot-pane .term, .m3-tail .term');
      const small = [...document.querySelectorAll('button, a[href], [role=tab], input')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { n: (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((x) => x.w < 44 || x.h < 44);
      return { term: term ? Math.round(term.getBoundingClientRect().height) : null, small };
    });
    out.push(`  ${s.padEnd(14)} terminal ${r.term == null ? '-' : r.term + 'px (' + Math.round(r.term / 8.44) + '%)'}  targets<44: ${r.small.length}${r.small.length ? ' [' + r.small.slice(0, 5).map((x) => x.n + ' ' + x.w + 'x' + x.h).join('; ') + ']' : ''}`);
  }
  console.log(d + '\n' + out.join('\n'));
}
await b.close();
