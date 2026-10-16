// M2: terminal first, state always visible. The app opens in the terminal of the session that needs you;
// the strip across the top is the whole fleet; the decision is docked above the input.
(function () {
  const U = UI, { icon, ses, sessions } = U;
  const s1 = () => ses('s1');
  const stripHead = (s) => U.slimHead(s, `<button class="m2-fleetbtn" aria-label="All sessions"><a href="#fleet">${icon('list', 20)}</a></button>`) + U.stateStrip(s.id);
  const foot = (kbd) => U.inputDock({ context: U.dockLine() });
  const decisionSheet = () => { const d = U.decision, s = s1(); return `<div class="scrim"></div><section class="dsheet" role="dialog" aria-label="Decision">
      <div class="grab"></div><header class="ds-h">${U.avatar(s.agent, null, 40)}<div><b>${U.esc(s.name)}</b><small>waiting ${s.wait} · ${U.esc(U.srv(s.server).name)}</small></div><a class="icon-btn" href="#terminal" aria-label="Close">${icon('down', 22)}</a></header>
      <p class="ds-ctx">${U.esc(d.context)}</p><h2 class="ds-q">${U.esc(d.question)}</h2>
      <div class="ds-o">${d.options.map((o, i) => `<button class="m2-opt ${i === 0 ? 'primary' : ''}"><kbd>${o.key}</kbd><span><b>${U.esc(o.label)}</b><small>${U.esc(o.hint)}</small></span></button>`).join('')}</div>
      ${U.lineInput('Or answer in your own words')}</section>`; };
  const fleetSheet = () => `<div class="scrim"></div><section class="pull" role="dialog" aria-label="All sessions"><header><b>Sessions</b><span class="muted">${sessions.length} on 3 servers</span><a class="icon-btn" href="#terminal" aria-label="Close">${icon('down', 22)}</a></header><div class="pull-b">${U.fleetGrid()}</div></section>`;
  function mobile(screen) {
    const s = s1();
    if (screen === 'home' || screen === 'terminal') return U.termScreen({ head: stripHead(s), foot: foot(false) });
    if (screen === 'terminal-kbd') return U.termScreen({ head: U.slimHead(s), foot: foot(true), kbd: true });
    if (screen === 'terminal-more') return U.termScreen({ head: stripHead(s), foot: foot(false), more: true });
    if (screen === 'decision') return U.termScreen({ head: stripHead(s), foot: foot(false), over: decisionSheet() });
    if (screen === 'fleet') return U.termScreen({ head: stripHead(s), foot: foot(false), over: fleetSheet() });
    if (screen === 'empty') { const q = ses('s6'); return U.termScreen({ id: 's3', head: U.slimHead(q) + U.stateStrip('s6'), foot: U.inputDock({ context: U.actionChips('claude') }) }); }
    return `<div class="screen" style="overflow:auto"><div style="padding:16px 16px 40px">${screen === 'report' ? `<div class="report">${U.report()}</div>` : '<header class="page-h"><h1>Settings</h1></header>'}</div></div>`;
  }
  window.boot({ phoneOnly: true, mobile });
})();
