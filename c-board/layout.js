// Direction C: fleet board. Every session's state on one screen; answer in place on the card; detail in a drawer.
(function () {
  const U = UI, { icon, ses, sessions, STATE } = U;
  const NAV = [['home', 'Board', 'home'], ['session-t1', 'Sessions', 'list'], ['report', 'Activity', 'pulse'], ['settings', 'Settings', 'settings']];
  const cols = [
    ['Needs you', (s) => s.state === 'needs_input' || s.state === 'failed', 'needs_input'],
    ['Working', (s) => s.state === 'working', 'working'],
    ['Finished', (s) => s.state === 'finished_unseen', 'finished_unseen'],
    ['Idle', (s) => s.state === 'idle', 'idle'],
  ];
  const curTab = (s) => (['home', 'empty', 'empty-servers', 'decision'].includes(s) ? 'home' : s === 'report' ? 'report' : s === 'settings' ? 'settings' : 'session-t1');
  const mini = (s) => `<div class="c-prog">${U.progress(s.progress)}</div>`;

  // inline-answer controls: act on the card itself
  const inline = (s) => {
    if (s.id === 's1') return `<div class="c-act">${U.decision.options.slice(0, 2).map((o, i) => `<button class="btn ${i === 0 ? 'warn' : ''}">${U.esc(o.label)}</button>`).join('')}<a class="btn ghost" href="#decision">More…</a></div>`;
    if (s.state === 'needs_input') return `<div class="c-act"><button class="btn warn">Approve</button><button class="btn">Review</button></div>`;
    if (s.state === 'failed') return `<div class="c-act"><button class="btn">Retry</button><a class="btn ghost" href="#session-t3">Open</a></div>`;
    return '';
  };
  const card = (s, opts = {}) => `<article class="bcard st-${s.state} ${opts.sel ? 'sel' : ''} ${opts.compact ? 'compact' : ''}">
    <a class="bhead" href="#${U.hrefFor(s)}">${U.avatar(s.agent, s.state, opts.compact ? 32 : 38)}
      <span class="bt"><b>${U.esc(s.name)}</b><small>${U.esc(U.srv(s.server).name)} · ${s.wait}</small></span>${opts.compact || opts.nochip ? '' : U.chip(s.state, STATE[s.state].label)}</a>
    ${opts.compact ? '' : `<p class="btitle">${U.esc(s.title)}</p>`}${opts.compact ? mini(s) : mini(s) + inline(s)}</article>`;

  const top = (title) => `<header class="c-top">${U.logo(28)}<b class="c-brand">${title}</b><span class="grow"></span>
    <span class="only-d">${U.statChips()}</span><span class="only-d grow"></span>${U.iconBtn('search', 'Search', 'ghost')}<span class="only-d">${U.btn('New session', 'primary', 'plus')}</span>${U.iconBtn('settings', 'Settings', 'ghost')}</header>`;
  const bottom = (cur) => `<nav class="c-bottom" aria-label="Destinations">${NAV.map(([h, l, ic]) => `<a href="#${h}" class="${cur === h ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span></a>`).join('')}</nav>`;

  const sheet = (head, body, foot = '') => `<div class="c-sheet"><div>${head}</div><div class="c-sbody">${body}</div>${foot ? `<footer class="c-sfoot">${foot}</footer>` : ''}</div>`;
  const sheetHead = (s) => `<header class="c-shead"><a class="icon-btn" href="#home" aria-label="Back">${icon('back', 22)}</a>${U.avatar(s.agent, s.state, 34)}
    <div class="c-shead-t"><b>${U.esc(s.name)}</b><small>${U.esc(s.branch)}</small></div>${U.chip(s.state)}</header>`;

  function mobile(screen) {
    const s1 = ses('s1');
    if (screen === 'decision') return sheet(sheetHead(s1) + U.seg(['Details', 'Terminal'], ['decision', 'terminal'], 0), U.waitingCard({ composer: false }) + U.stepsCard('s1') + U.activityCard(), U.composer('Or answer in your own words'));
    if (screen === 'session-t1') return sheet(sheetHead(s1) + U.seg(['Details', 'Terminal'], ['session-t1', 'terminal'], 0), U.transcriptView() + `<div class="c-dockstrip"><b>${U.esc(U.decision.question)}</b><div class="c-pills">${U.decision.options.map((o, i) => `<button class="pill ${i === 0 ? 'primary' : ''}">${U.esc(o.label)}</button>`).join('')}</div></div>`, U.composer('Reply to Claude'));
    if (screen === 'session-t3') { const s = ses('s3'); return sheet(sheetHead(s), `<p class="c-tier">T3 · generic view, read from the terminal</p>${U.genericPrompt()}${U.termPane('s3', { bare: true, input: false })}`, U.composer('Type to the agent')); }
    if (screen === 'terminal' || screen === 'terminal-more') { const s = ses('s1'); return `<div class="c-sheet term-sheet"><div>${sheetHead(s)}${U.tabStrip('s1')}${U.seg(['Details', 'Terminal'], ['decision', 'terminal'], 1)}</div><div class="c-tbody">${U.phoneTerm('s1')}</div><footer>${U.dock()}${U.actionChips('claude')}${U.lineInput()}${U.keyBar()}</footer>${screen === 'terminal-more' ? U.moreSheet() : ''}</div>`; }
    const page = {
      report: () => `<div class="c-page report">${U.report()}</div>`,
      settings: () => `<div class="c-page"><header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p></div>`,
      'empty-servers': () => `<div class="c-page">${U.emptyServers()}</div>`,
      empty: () => `<div class="c-page">${U.emptyQuiet()}<h2 class="c-sec">Working <em>${U.count('working')}</em></h2><div class="c-grid2">${sessions.filter((s) => s.state === 'working').map((s) => card(s, { compact: true })).join('')}</div></div>`,
      home: () => `<div class="c-page">
        ${cols.map(([name, f, st]) => {
          const list = sessions.filter(f);
          const compact = st === 'working' || st === 'idle';
          return `<h2 class="c-sec st-${st}"><i class="dot"></i>${name}<em>${list.length}</em></h2>${compact ? `<div class="c-grid2">${list.map((s) => card(s, { compact: true })).join('')}</div>` : list.map((s) => card(s)).join('')}`;
        }).join('')}</div>`,
    }[screen]();
    return `<div class="c-phone">${top(screen === 'report' ? 'Activity' : 'Fleet')}${page}${bottom(curTab(screen))}</div>`;
  }

  const rail = (cur) => `<nav class="c-rail" aria-label="Destinations">${NAV.map(([h, l, ic]) => `<a href="#${h}" class="${cur === h ? 'on' : ''}">${icon(ic, 18)}<span>${l}</span></a>`).join('')}</nav>`;
  const board = (sel) => `<div class="c-board">${cols.map(([name, f, st]) => {
    const list = sessions.filter(f);
    return `<section class="c-col"><header class="st-${st}"><i class="dot"></i><b>${name}</b><em>${list.length}</em></header><div class="c-cards">${list.map((s) => card(s, { sel: s.id === sel, compact: st === 'idle', nochip: st !== 'needs_input' })).join('')}</div></section>`;
  }).join('')}</div>`;
  const drawer = (id, kind) => {
    const s = ses(id);
    const prompt = s.state === 'needs_input' ? U.waitingCard({ composer: false, hints: false }) : s.state === 'failed' ? U.genericPrompt() : '';
    return `<aside class="c-drawer"><header class="c-dhead">${U.sessionHeader(s, { size: 40 })}</header>${prompt}
      <div class="c-dterm"><header class="c-dl">${icon('terminal', 16)}<b>Live terminal</b><span class="grow"></span><span class="muted">${s.tier} view</span></header>${U.termPane(id, { bare: true })}</div></aside>`;
  };
  function desktop(screen) {
    const cur = curTab(screen);
    let main;
    if (screen === 'report') main = `<main class="c-main wide report">${U.report()}</main>`;
    else if (screen === 'settings') main = `<main class="c-main wide"><header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p></main>`;
    else if (screen === 'empty-servers') main = `<main class="c-main wide">${U.emptyServers()}</main>`;
    else if (screen === 'empty') main = `<main class="c-main wide">${U.emptyQuiet()}<h2 class="c-sec st-working"><i class="dot"></i>Working<em>${U.count('working')}</em></h2><div class="c-grid4">${sessions.filter((s) => s.state === 'working').map((s) => card(s, { compact: true })).join('')}</div></main>`;
    else {
      const id = screen === 'session-t3' || screen === 'terminal' ? 's3' : 's1';
      main = `<main class="c-main">${board(id)}</main>${drawer(id)}`;
    }
    const two = ['report', 'settings', 'empty-servers', 'empty'].includes(screen);
    return `<div class="c-desk">${top('Fleet')}<div class="c-body ${two ? 'one' : ''}">${rail(cur)}${main}</div></div>`;
  }
  window.boot({ mobile, desktop });
})();
