// Direction B: decision inbox. The queue is the product; the focused decision is the stage. Terminal is secondary.
(function () {
  const U = UI, { icon, ses, sessions, STATE } = U;
  const NAV = [['home', 'Inbox', 'home'], ['session-t1', 'Sessions', 'list'], ['report', 'Activity', 'pulse'], ['settings', 'Settings', 'settings']];
  const queue = () => U.needs();
  const rest = () => sessions.filter((s) => s.state === 'working' || s.state === 'idle');
  const curTab = (s) => (['home', 'empty', 'empty-servers', 'decision'].includes(s) ? 'home' : s === 'report' ? 'report' : s === 'settings' ? 'settings' : 'session-t1');

  const qRow = (s, sel) => `<a class="b-q st-${s.state} ${sel ? 'sel' : ''}" href="#${U.hrefFor(s)}">${U.avatar(s.agent, null, 34)}
    <span class="b-q-b"><b>${U.esc(s.name)}</b><span>${U.esc(s.title)}</span></span><span class="b-q-m">${U.chip(s.state, STATE[s.state].label)}<small>${s.wait}</small></span></a>`;
  const pager = (n, of) => `<div class="b-pager"><span><b>${n}</b> of ${of} waiting</span><span class="b-dots">${Array.from({ length: of }, (_, i) => `<i class="${i + 1 === n ? 'on' : ''}"></i>`).join('')}</span></div>`;

  const topM = (title, extra = '') => `<header class="b-top">${U.logo(28)}<b>${title}</b>${extra}<span class="grow"></span>${U.iconBtn('bell', 'Notifications', 'ghost')}</header>`;
  const bottom = (cur) => `<nav class="b-bottom" aria-label="Destinations">${NAV.map(([h, l, ic]) =>
    `<a href="#${h}" class="${cur === h ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span>${h === 'home' ? `<em>${queue().length}</em>` : ''}</a>`).join('')}</nav>`;

  const decisionStage = (opts = {}) => {
    const s = ses('s1'), d = U.decision;
    return `<article class="b-stage">
      <header class="b-who">${U.avatar(s.agent, null, 40)}<div><b>${U.esc(s.name)}</b><small>${U.AGENT[s.agent].name} · ${U.esc(U.srv(s.server).name)} · waiting ${s.wait}</small></div></header>
      <p class="b-task">${U.esc(s.title)}</p>
      <p class="b-ctx">${U.esc(d.context)}</p>
      <h2 class="b-q-title">${U.esc(d.question)}</h2>
      <div class="b-opts">${d.options.map((o, i) => `<button class="b-opt ${i === 0 ? 'primary' : ''}"><kbd>${o.key}</kbd><span><b>${U.esc(o.label)}</b><small>${U.esc(o.hint)}</small></span>${U.icon('arrow', 18)}</button>`).join('')}</div>
      ${U.composer('Or answer in your own words')}
      <div class="b-foot"><button class="btn ghost sm">${icon('skip', 15)}<span>Skip to next</span><kbd>J</kbd></button><button class="btn ghost sm">${icon('terminal', 15)}<span>Open terminal</span><kbd>T</kbd></button></div>
    </article>`;
  };

  const sheet = (head, body, foot = '') => `<div class="b-sheet">${head}<div class="b-sbody">${body}</div>${foot ? `<footer class="b-sfoot">${foot}</footer>` : ''}</div>`;
  const sheetHead = (s) => `<header class="b-shead"><a class="icon-btn" href="#home" aria-label="Back">${icon('back', 22)}</a>${U.avatar(s.agent, null, 32)}
    <div class="b-shead-t"><b>${U.esc(s.name)}</b><small>${U.esc(U.srv(s.server).name)}</small></div>${U.chip(s.state)}</header>`;

  function mobile(screen) {
    const s1 = ses('s1');
    if (screen === 'decision') return sheet(sheetHead(s1), `${pager(1, queue().length)}${decisionStage()}`);
    if (screen === 'session-t1') return sheet(sheetHead(s1) + '<div class="b-tier">T1 · hooks and transcript<a href="#terminal">' + icon('terminal', 14) + ' Full terminal</a></div>',
      U.transcriptView(), `<div class="b-dock"><b>${U.esc(U.decision.question)}</b><div class="b-pills">${U.decision.options.map((o, i) => `<button class="pill ${i === 0 ? 'primary' : ''}">${U.esc(o.label)}</button>`).join('')}</div></div>${U.composer('Reply to Claude')}`);
    if (screen === 'session-t3') { const s = ses('s3'); return sheet(sheetHead(s) + '<div class="b-tier">T3 · generic view, read from the terminal<a href="#terminal">' + icon('terminal', 14) + ' Full terminal</a></div>',
      U.genericPrompt() + U.termPane('s3', { bare: true, input: false }), U.composer('Type to the agent')); }
    if (screen === 'terminal') { const s = ses('s3'); return sheet(sheetHead(s), U.termPane('s3', { bare: true, input: false }), U.composer('Send input to agent…', true)); }
    const page = {
      report: () => `<div class="b-page report">${U.report()}</div>`,
      settings: () => `<div class="b-page"><header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p></div>`,
      'empty-servers': () => `<div class="b-page">${U.emptyServers()}</div>`,
      empty: () => `<div class="b-page">${U.emptyQuiet()}<h2 class="b-sec">Continue</h2>${qRow(ses('s6'))}<h2 class="b-sec">Fleet</h2>${U.statChips()}</div>`,
      home: () => `<div class="b-page">${pager(1, queue().length)}${decisionStage()}
        <h2 class="b-sec">Next in queue</h2><div class="b-list">${queue().slice(1).map((s) => qRow(s)).join('')}</div>
        <h2 class="b-sec">Fleet</h2>${U.statChips()}<div class="b-list">${rest().map((s) => qRow(s)).join('')}</div></div>`,
    }[screen]();
    return `<div class="b-phone">${topM(screen === 'report' ? 'Activity' : 'Inbox')}${page}${bottom(curTab(screen))}</div>`;
  }

  // desktop: rail | queue | stage
  const rail = (cur) => `<nav class="b-rail" aria-label="Destinations">${U.logo(34)}${NAV.map(([h, l, ic]) =>
    `<a href="#${h}" class="${cur === h ? 'on' : ''}" title="${l}">${icon(ic, 22)}${h === 'home' ? `<em>${queue().length}</em>` : ''}</a>`).join('')}<span class="grow"></span>${U.avatar('claude', null, 34)}</nav>`;
  const queueCol = (sel) => `<aside class="b-queue"><header><h2>Inbox</h2><span class="muted">${queue().length} need you</span></header>
    <div class="b-qscroll"><h3 class="b-sec">Needs you</h3>${queue().map((s) => qRow(s, s.id === sel)).join('')}
    <h3 class="b-sec">Fleet</h3>${U.statChips()}<div style="height:8px"></div>${rest().map((s) => qRow(s)).join('')}</div></aside>`;
  const hints = `<div class="b-hints"><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> answer</span><span><kbd>J</kbd><kbd>K</kbd> next · previous</span><span><kbd>T</kbd> terminal</span><span><kbd>Ctrl</kbd><kbd>K</kbd> jump</span></div>`;
  function desktop(screen) {
    const cur = curTab(screen); let stage, q = queueCol('s1');
    if (screen === 'report') { stage = `<section class="b-wide report">${U.report()}</section>`; q = ''; }
    else if (screen === 'settings') { stage = `<section class="b-wide"><header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p></section>`; q = ''; }
    else if (screen === 'empty-servers') { stage = `<section class="b-wide">${U.emptyServers()}</section>`; q = ''; }
    else if (screen === 'empty') { stage = `<section class="b-center">${U.emptyQuiet()}<div class="b-cont"><span class="muted">Continue where you left off</span>${qRow(ses('s6'))}</div></section>`; q = queueCol(''); }
    else if (screen === 'session-t1') stage = `<section class="b-center"><div class="b-cap">${U.sessionHeader(ses('s1'), { size: 40, more: false })}</div><div class="card" style="margin-top:12px">${U.transcriptView()}</div><div class="b-dock-d">${U.composer('Reply to Claude')}</div></section>`;
    else if (screen === 'session-t3' || screen === 'terminal') { q = queueCol('s3'); stage = `<section class="b-center"><div class="b-cap">${U.sessionHeader(ses('s3'), { size: 40, more: false })}</div>${screen === 'session-t3' ? U.genericPrompt() : ''}<div class="b-term">${U.termPane('s3')}</div></section>`; }
    else stage = `<section class="b-center">${pager(1, queue().length)}${decisionStage()}<details class="b-more" open><summary>${icon('file', 16)}Session details</summary><div class="b-two">${U.stepsCard('s1')}${U.activityCard()}</div></details>${hints}</section>`;
    return `<div class="b-desk ${q ? '' : 'noq'}">${rail(cur)}${q}<main class="b-main">${stage}</main></div>`;
  }
  window.boot({ mobile, desktop });
})();
