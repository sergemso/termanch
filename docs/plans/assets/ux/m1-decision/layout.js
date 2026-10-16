// M1: decision first. Home is the oldest waiting decision; terminal is one tap away on every session.
(function () {
  const U = UI, { icon, ses, sessions, STATE } = U;
  const NAV = [['home', 'Inbox', 'home'], ['fleet', 'Sessions', 'list'], ['report', 'Activity', 'pulse'], ['settings', 'Settings', 'settings']];
  const queue = () => U.needs();
  const qRow = (s) => `<a class="m1-q st-${s.state}" href="#${U.hrefFor(s)}">${U.avatar(s.agent, null, 40)}<span class="m1-q-b"><b>${U.esc(s.name)}</b><span>${U.esc(s.title)}</span></span><span class="m1-q-m">${U.chip(s.state, STATE[s.state].label)}<small>${s.wait}</small></span></a>`;
  const pager = (n, of) => `<div class="m1-pager"><span><b>${n}</b> of ${of} waiting</span><span class="m1-dots">${Array.from({ length: of }, (_, i) => `<i class="${i + 1 === n ? 'on' : ''}"></i>`).join('')}</span></div>`;
  const bottom = (cur) => `<nav class="m1-bottom" aria-label="Destinations">${NAV.map(([h, l, ic]) => `<a href="#${h}" class="${cur === h ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span>${h === 'home' ? `<em>${queue().length}</em>` : ''}</a>`).join('')}</nav>`;
  const top = (t) => `<header class="m1-top">${U.logo(28)}<b>${t}</b><span class="grow"></span>${U.iconBtn('bell', 'Notifications', 'ghost')}</header>`;
  const stage = () => { const s = ses('s1'), d = U.decision; return `<article class="m1-stage">
      <header class="m1-who">${U.avatar(s.agent, null, 44)}<div><b>${U.esc(s.name)}</b><small>${U.AGENT[s.agent].name} · ${U.esc(U.srv(s.server).name)} · waiting ${s.wait}</small></div></header>
      <p class="m1-task">${U.esc(s.title)}</p><p class="m1-ctx">${U.esc(d.context)}</p><h2 class="m1-q-title">${U.esc(d.question)}</h2>
      <div class="m1-opts">${d.options.map((o, i) => `<button class="m1-opt ${i === 0 ? 'primary' : ''}"><kbd>${o.key}</kbd><span><b>${U.esc(o.label)}</b><small>${U.esc(o.hint)}</small></span>${icon('arrow', 18)}</button>`).join('')}</div>
      ${U.lineInput('Or answer in your own words')}
      <div class="m1-foot"><button class="btn ghost">${icon('skip', 15)}<span>Skip to next</span></button><a class="btn ghost" href="#terminal">${icon('terminal', 15)}<span>Open terminal</span></a></div></article>`; };
  const head = (s) => U.slimHead(s) + U.tabStrip(s.id) + U.seg(['Decision', 'Terminal'], ['decision', 'terminal'], 1);
  const foot = (kbd) => U.inputDock({ context: U.dockLine() });
  function mobile(screen) {
    const s1 = ses('s1');
    if (screen === 'decision') return `<div class="m1-sheetwrap">${U.slimHead(s1)}${U.seg(['Decision', 'Terminal'], ['decision', 'terminal'], 0)}<div class="m1-sbody">${pager(1, queue().length)}${stage()}</div></div>`;
    if (screen === 'terminal' || screen === 'terminal-more') return U.termScreen({ head: head(s1), foot: foot(false), more: screen === 'terminal-more' });
    if (screen === 'terminal-kbd') return U.termScreen({ head: U.slimHead(s1), foot: foot(true), kbd: true });
    const page = {
      home: () => `<div class="m1-chips">${U.statChips()}</div>${pager(1, queue().length)}${stage()}<h2 class="m1-sec">Next in queue</h2><div class="m1-list">${queue().slice(1).map(qRow).join('')}</div><a class="m1-more" href="#fleet"><span>All ${sessions.length} sessions</span>${icon('arrow', 18)}</a>`,
      fleet: () => `<header class="page-h"><h1>Sessions</h1><span class="muted">${sessions.length} on 3 servers</span></header>${U.fleetGrid()}`,
      empty: () => `${U.emptyQuiet()}<h2 class="m1-sec">Continue</h2>${qRow(ses('s6'))}<div class="m1-chips" style="margin-top:14px">${U.statChips()}</div>`,
      report: () => `<div class="report">${U.report()}</div>`,
      settings: () => `<header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p>`,
    }[screen]();
    return `<div class="screen" style="overflow:auto">${top(screen === 'fleet' ? 'Sessions' : 'Inbox')}<div class="m1-page">${page}</div>${bottom(screen === 'fleet' ? 'fleet' : screen === 'report' ? 'report' : 'home')}</div>`;
  }
  window.boot({ phoneOnly: true, mobile });
})();
