// M3: split view. Home is a list; a session is a split: structured on top, terminal below, with snap points.
(function () {
  const U = UI, { icon, ses, sessions, STATE } = U;
  const NAV = [['home', 'Home', 'home'], ['fleet', 'Sessions', 'list'], ['report', 'Activity', 'pulse'], ['settings', 'Settings', 'settings']];
  const bottom = (cur) => `<nav class="m3-bottom" aria-label="Destinations">${NAV.map(([h, l, ic]) => `<a href="#${h}" class="${cur === h ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span></a>`).join('')}</nav>`;
  const top = (t) => `<header class="m3-top">${U.logo(28)}<b>${t}</b><span class="grow"></span>${U.iconBtn('search', 'Search', 'ghost')}${U.iconBtn('settings', 'Settings', 'ghost')}</header>`;
  const snaps = (on) => `<div class="snaps" role="tablist" aria-label="Split position">${['Details', 'Split', 'Terminal'].map((t, i) => `<a href="#${['decision', 'decision', 'terminal'][i]}" class="${on === i ? 'on' : ''}" role="tab">${t}</a>`).join('')}</div>`;
  const decisionCard = () => { const d = U.decision; return `<section class="m3-dec"><header>${icon('info', 16)}<b>Needs you</b><span>waiting ${ses('s1').wait}</span></header><h2>${U.esc(d.question)}</h2>
      <div class="m3-opts">${d.options.map((o, i) => `<button class="m3-opt ${i === 0 ? 'primary' : ''}"><kbd>${o.key}</kbd><b>${U.esc(o.label)}</b></button>`).join('')}</div></section>`; };
  const tail = () => `<div class="m3-tail"><header>${icon('terminal', 16)}<b>Terminal</b><a href="#terminal">Expand ${icon('expand', 14)}</a></header>${U.phoneTerm('s1')}</div>`;
  const miniBar = () => `<div class="m3-mini">${U.lineInput('Send a line to the agent')}</div>`;
  const foot = (kbd) => `<a class="m3-sum" href="#decision">${icon('info', 16)}<b>Needs you</b><span>${U.esc(U.decision.question)}</span>${icon('arrow', 16)}</a>` + (kbd ? '' : U.actionChips('claude')) + U.lineInput() + U.keyBar();
  function mobile(screen) {
    const s1 = ses('s1');
    if (screen === 'decision') return `<div class="screen"><div class="m3-split">${U.slimHead(s1)}${snaps(1)}<div class="m3-top-pane">${decisionCard()}</div><div class="m3-handle" aria-hidden="true"><i></i></div><div class="m3-bot-pane">${tail()}${miniBar()}</div></div></div>`;
    if (screen === 'terminal' || screen === 'terminal-more') return U.termScreen({ head: U.slimHead(s1) + snaps(2), foot: foot(false), more: screen === 'terminal-more' });
    if (screen === 'terminal-kbd') return U.termScreen({ head: U.slimHead(s1), foot: foot(true), kbd: true });
    const list = (arr) => arr.map((s) => U.listRow(s)).join('');
    const page = {
      home: () => `<div class="m3-chips">${U.statChips()}</div><h2 class="m3-sec">Needs you <em>${U.needs().length}</em></h2>${list(U.needs())}<h2 class="m3-sec">Everything else</h2>${list(sessions.filter((s) => s.state === 'working' || s.state === 'idle'))}`,
      fleet: () => `<header class="page-h"><h1>Sessions</h1><span class="muted">${sessions.length} on 3 servers</span></header>${U.fleetGrid()}`,
      empty: () => `<div class="m3-chips">${U.statChips()}</div>${U.emptyQuiet()}<h2 class="m3-sec">Continue</h2>${U.listRow(ses('s6'))}`,
      report: () => `<div class="report">${U.report()}</div>`,
      settings: () => `<header class="page-h"><h1>Settings</h1></header><p class="muted">Out of scope for the spike.</p>`,
    }[screen]();
    return `<div class="screen" style="overflow:auto">${top(screen === 'fleet' ? 'Sessions' : 'Termenbox')}<div class="m3-page">${page}</div>${bottom(screen === 'fleet' ? 'fleet' : screen === 'report' ? 'report' : 'home')}</div>`;
  }
  window.boot({ phoneOnly: true, mobile });
})();
