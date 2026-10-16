// Audits the phone design against DESIGN-PRINCIPLES.md (rules DR1 to DR15). Usage: CHROME_PATH=... node audit.mjs [dir]   (default f-final)
import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const require = createRequire(path.resolve('../../../../packages/client/package.json'));
const { chromium } = require('playwright-core');
const dir = process.argv[2] || 'f-final';
const screens = ['home', 'decision', 'fleet', 'empty', 'terminal', 'terminal-kbd', 'terminal-more', 'report', 'settings'];
const skins = ['navy', 'graphite', 'teal'], modes = ['dark', 'light'];
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const fails = {}; const add = (k, m) => ((fails[k] ||= new Set()).add(m));
const boxes = {};
function probe() {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.className || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const over = (f, bg) => [f[0] * f[3] + bg[0] * (1 - f[3]), f[1] * f[3] + bg[1] * (1 - f[3]), f[2] * f[3] + bg[2] * (1 - f[3]), 1];
  const lum = ([r, g, bl]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl); };
  const gradStops = (e) => { for (let n = e; n; n = n.parentElement) { const bi = getComputedStyle(n).backgroundImage; if (bi && bi !== 'none') { const m = bi.match(/rgba?\([^)]+\)/g); if (m) return m.map(parse); } if (parse(getComputedStyle(n).backgroundColor)[3] === 1) break; } return null; };
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] === 1) break; } let bg = [11, 18, 32, 1]; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  const opac = (e) => { let o = 1; for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const tabs = document.querySelector('.f-tabs'); const tabsTop = tabs ? tabs.getBoundingClientRect().top : 1e9;
  const scrim = document.querySelector('.f-scrim, .scrim'); const targets = [...document.querySelectorAll('button, a[href], input, [role=tab]')].filter(vis).filter((e) => !scrim || e.closest('.f-sheet, .msheet')).filter((e) => e.closest('.f-tabs') || !tabs || e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2 < tabsTop);
  const small = targets.map((e) => ({ n: name(e), r: e.getBoundingClientRect(), dense: !!e.closest('.f-keys.dense') })).filter((t) => t.r.height < 43.5 || (t.r.width < 43.5 && !t.dense)).map((t) => `${t.n} ${Math.round(t.r.width)}x${Math.round(t.r.height)}`);
  const gaps = [];
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
    const a = targets[i], c = targets[j]; if (a.contains(c) || c.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
    const dx = Math.max(rc.left - ra.right, ra.left - rc.right, 0), dy = Math.max(rc.top - ra.bottom, ra.top - rc.bottom, 0);
    const g = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
    const sameTabs = (a.closest('[role=tablist]') && a.closest('[role=tablist]') === c.closest('[role=tablist]')) || (a.closest('form') && a.closest('form') === c.closest('form'));
    const denseKeys = a.closest('.f-keys.dense') && a.closest('.f-keys.dense') === c.closest('.f-keys.dense');
    if (!denseKeys && g < (sameTabs ? 3.5 : 7.5)) gaps.push(`${name(a)} | ${name(c)} ${g.toFixed(1)}`);
  }
  const rows = {}; targets.forEach((e) => { const r = e.getBoundingClientRect(); const k = Math.round((r.top + r.height / 2) / 8); (rows[k] ||= []).push(e); });
  const wide = Object.values(rows).filter((l) => l.length > 7 && !l[0].closest('.f-keys.dense')).map((l) => l.length + ' controls in a row');
  const contrast = [], sizes = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) { if (!t.nodeValue.trim()) continue; const e = t.parentElement; if (!vis(e) || e.closest('.ioskb')) continue;
    const cs = getComputedStyle(e); const fg = parse(cs.color); fg[3] *= opac(e); const stops = gradStops(e); const bgs = stops ? stops.map((c) => over(c, [0, 0, 0, 1])) : [bgOf(e)];
    let ratio = 99; for (const bg of bgs) { const f = over(fg, bg); const L1 = lum(f), L2 = lum(bg); ratio = Math.min(ratio, (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)); }
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700; sizes.add(px);
    const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) contrast.push(`"${t.nodeValue.trim().slice(0, 22)}" ${ratio.toFixed(2)} < ${need} (${px}px)`); }
  const inputs = [...document.querySelectorAll('input')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length;
  const q = (s) => document.querySelector(s);
  const h = (s) => { const e = q(s); return e ? e.getBoundingClientRect().height : null; };
  return { small, gaps, wide, contrast: contrast.slice(0, 6), sizes: [...sizes].sort((a, b) => a - b), inputs, overflow: document.documentElement.scrollWidth - innerWidth,
    chrome: h('.thead'), term: h('.tbody'), kbd: !!q('.screen.kb'), targets: targets.map((e) => { const r = e.getBoundingClientRect(); return [name(e), Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); }),
    lineTop: (() => { const e = q('.f-line, .lineinput, .f-keys'); return e ? e.getBoundingClientRect().top : null; })() };
}
for (const skin of skins) for (const mode of modes) for (const s of screens) {
  await p.goto(pathToFileURL(path.resolve(dir, 'index.html')).href + `?skin=${skin}&theme=${mode}#${s}`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(100);
  const r = await p.evaluate(probe); const tag = `${s} [${skin}/${mode}]`;
  r.small.forEach((m) => add('DR1 target < 44 pt', `${s}: ${m}`));
  r.gaps.forEach((m) => add('DR2 gap < 8 pt', `${s}: ${m}`));
  r.wide.forEach((m) => add('DR4 > 7 controls in a row', `${s}: ${m}`));
  r.contrast.forEach((m) => add('DR8 text contrast', `${tag} ${m}`));
  if (r.sizes.length > 7) add('DR5 more than 7 font sizes', `${s}: ${r.sizes.join(',')}`);
  if (r.inputs) add('DR5 input under 16 px', s);
  if (r.overflow > 0) add('DR15 horizontal overflow', `${s} ${r.overflow}px`);
  if (s === 'terminal') { if (r.chrome / 844 > 0.2) add('DR12 chrome over 20%', `${(100 * r.chrome / 844).toFixed(1)}%`); }
  if (s === 'terminal-kbd') { const share = r.term / (844 - 291); if (share < 0.5) add('DR12 terminal under 50% above keyboard', `${(100 * share).toFixed(0)}%`); }
  if (['terminal', 'terminal-kbd', 'home'].includes(s) && r.lineTop != null && r.lineTop < 844 / 3 && s !== 'home') add('DR13 input not in lower two thirds', `${s} ${Math.round(r.lineTop)}`);
  (boxes[s] ||= {})[`${skin}/${mode}`] = r.targets.join('|');
  if (skin === 'navy' && mode === 'dark') console.log(`${s.padEnd(14)} sizes ${r.sizes.join('/')}  chrome ${r.chrome ? Math.round(100 * r.chrome / 844) + '%' : '-'}  terminal ${r.term ? Math.round(r.term) + 'px' : '-'}`);
}
for (const s of screens) { const v = Object.values(boxes[s]); if (new Set(v).size > 1) add('DR11 layout differs between skins', s); }
console.log('\n=== AUDIT ' + dir + ' ===');
const keys = Object.keys(fails);
if (!keys.length) console.log('PASS: every rule held on 9 screens x 3 skins x 2 modes');
for (const k of keys) { console.log('FAIL ' + k + ' (' + fails[k].size + ')'); [...fails[k]].slice(0, 6).forEach((m) => console.log('   ' + m)); }
await b.close();
