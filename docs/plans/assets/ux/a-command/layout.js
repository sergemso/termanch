// Direction A: command centre. Agent list | session detail | live terminal (desktop); list-first phone.
(function () {
  const U = UI, { icon, ses, sessions, STATE } = U;
  const sorted = () => [...sessions].sort((a, b) => STATE[a.state].rank - STATE[b.state].rank);
  const NAV = [['home', 'Home', 'home'], ['session-t1', 'Sessions', 'list'], ['report', 'Activity', 'pulse'], ['settings', 'Settings', 'settings']];

  const topbar = () => `
    <header class="a-top">${U.logo(30)}<b class="brand">termenbox</b>
      <button class="a-server">${icon('server', 16)}<span>hetzner-box</span>${icon('down', 16)}</button>
      <span class="a-conn"><i class="dot ok"></i>Connected</span><span class="grow"></span>
      <span class="only-d">${U.btn('New session', 'primary', 'plus')}</span>${U.iconBtn('settings', 'Settings', 'ghost')}</header>`;

  const bottom = (cur) => `<nav class="a-bottom" aria-label="Destinations">${NAV.map(([h, l, ic]) =>
    `<a href="#${h}" class="${cur === h ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span></a>`).join('')}</nav>`;
  const curTab = (s) => (['home', 'empty', 'empty-servers'].includes(s) ? 'home' : s === 'report' ? 'report' : s === 'settings' ? 'settings' : 'session-t1');

  const sheet = (head, body, foot = '') => `<div class="a-sheet"><div>${head}</div><div class="a-sbody">${body}</div>${foot ? `<footer class="a-sfoot">${foot}</footer>` : ''}</div>`;
  const sheetHead = (s, back = 'home') => `<header class="a-shead"><a class="icon-btn" href="#${back}" aria-label="Back">${icon('back', 22)}</a>
    ${U.avatar(s.agent, s.state, 36)}<div class="a-shead-t"><b>${U.esc(s.name)}</b><small>${U.esc(U.srv(s.server).name)} · ${s.branch}</small></div>${U.chip(s.state)}</header>`;
  const segs = (on) => `<div class="a-seg">${['Overview', 'Transcript', 'Terminal'].map((t, i) => `<a href="#${['decision', 'session-t1', 'terminal'][i]}" class="${on === i ? 'on' : ''}">${t}</a>`).join('')}</div>`;

  // ---------------- phone ----------------
  function mobile(screen) {
    if (screen === 'decision') { const s = ses('s1'); return sheet(sheetHead(s) + segs(0), U.waitingCard({ composer: false }) + U.stepsCard('s1') + U.activityCard(), U.composer('Or answer in your own words')); }
    if (screen === 'session-t1') { const s = ses('s1'); return sheet(sheetHead(s) + segs(1), U.transcriptView() + U.waitingCard({ hints: false, composer: false }), U.composer('Reply to Claude')); }
    if (screen === 'session-t3') { const s = ses('s3'); return sheet(sheetHead(s) + segs(0), `<p class="a-tier">${icon('info', 14)} Generic view · screen read from the terminal</p>` + U.genericPrompt() + U.stepsCard('s3') + U.activityCard(), U.composer('Type to the agent')); }
    if (screen === 'terminal' || screen === 'terminal-more') { const s = ses('s1'); return `<div class="a-sheet term-sheet"><div>${sheetHead(s)}${U.tabStrip('s1')}${segs(2)}</div><div class="a-tbody">${U.phoneTerm('s1')}</div><footer>${U.inputDock({ context: U.dockLine() })}</footer>${screen === 'terminal-more' ? U.moreSheet() : ''}</div>`; }
    const body = {
      report: () => `<div class="a-page report">${U.report()}</div>`,
      settings: () => `<div class="a-page"><header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p></div>`,
      'empty-servers': () => `<div class="a-page">${U.emptyServers()}</div>`,
      empty: () => `<div class="a-page">${U.statChips()}${U.emptyQuiet()}<h2 class="a-sec">Continue</h2>${U.listRow(ses('s6'))}<h2 class="a-sec">All sessions</h2>${sorted().filter((s) => (s.state === 'working' || s.state === 'idle') && s.id !== 's6').map((s) => U.listRow(s)).join('')}</div>`,
      home: () => `<div class="a-page"><div class="a-chips">${U.statChips()}</div>
        <h2 class="a-sec">Needs you <em>${U.needs().length}</em></h2>${U.needs().map((s) => U.listRow(s)).join('')}
        <h2 class="a-sec">Everything else</h2>${sorted().filter((s) => s.state === 'working' || s.state === 'idle').map((s) => U.listRow(s)).join('')}</div>`,
    }[screen]();
    return `<div class="a-phone">${topbar()}${body}${bottom(curTab(screen))}</div>`;
  }

  // ---------------- desktop ----------------
  const side = (sel) => `<aside class="a-list"><header><b>AGENTS</b><span class="count">${sessions.length}</span></header>
    <div class="a-scroll">${sorted().map((s) => U.listRow(s, s.id === sel)).join('')}</div></aside>`;
  const detail = (id, kind) => {
    const s = ses(id);
    const prompt = s.state === 'needs_input' ? U.waitingCard({ composer: false }) : s.state === 'failed' ? U.genericPrompt() : '';
    return `<section class="a-detail">${U.sessionHeader(s)}${kind === 'transcript' ? `<div class="card"><header class="card-h">${icon('file', 18)}<b>Transcript</b></header>${U.transcriptView()}</div>` : U.stepsCard(id)}${prompt}${U.activityCard()}</section>`;
  };
  function desktop(screen) {
    const strip = `<div class="a-strip">${U.statChips({ all: true })}<span class="grow"></span>
      <label class="a-search">${icon('search', 16)}<input placeholder="Search agents, tasks, or keywords…" aria-label="Search"></label>${U.btn('Filter', '', 'filter')}</div>`;
    let main;
    if (screen === 'report') main = `${side('')}<section class="a-wide a-detail report">${U.report()}</section>`;
    else if (screen === 'settings') main = `<section class="a-wide a-detail"><header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p></section>`;
    else if (screen === 'empty-servers') main = `<section class="a-wide a-detail">${U.emptyServers()}</section>`;
    else if (screen === 'empty') main = `${side('')}<section class="a-detail">${U.emptyQuiet()}</section><section class="a-term">${U.termPane('s1')}</section>`;
    else {
      const id = screen === 'session-t3' || screen === 'terminal' ? 's3' : 's1';
      main = `${side(id)}${detail(id, screen === 'session-t1' ? 'transcript' : 'task')}<section class="a-term">${U.termPane(id)}</section>`;
    }
    return `<div class="a-desk">${topbar()}${strip}<div class="a-grid ${['report', 'settings', 'empty-servers'].includes(screen) ? 'two' : ''}">${main}</div></div>`;
  }
  window.boot({ mobile, desktop });
})();
