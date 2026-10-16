// Final mobile design, built to DESIGN-PRINCIPLES.md. Phone only.
(function () {
  const U = UI, { icon, ses, sessions, STATE, srv, esc } = U;
  const ST = ['needs_input', 'working', 'failed', 'finished_unseen'];
  const count = (st) => sessions.filter((s) => s.state === st).length;
  const NAV = [['home', 'Inbox', 'home'], ['fleet', 'Sessions', 'list'], ['report', 'Activity', 'pulse'], ['settings', 'Settings', 'settings']];
  const hrefFor = (s) => (s.state === 'needs_input' ? 'decision' : 'terminal');

  const nav = (cur) => `<nav class="f-tabs" aria-label="Destinations">${NAV.map(([h, l, ic]) => `<a href="#${h}" class="${cur === h ? 'on' : ''}" ${cur === h ? 'aria-current="page"' : ''}>${icon(ic, 24)}<span>${l}</span>${h === 'home' ? `<em aria-label="${U.needs().length} need you">${U.needs().length}</em>` : ''}</a>`).join('')}</nav>`;
  const bar = (title, right = '') => `<header class="f-bar"><h1>${title}</h1><span class="grow"></span>${right}</header>`;
  const summary = () => `<section class="f-sum" aria-label="Fleet state">${[['needs_input', 'Need you'], ['working', 'Working'], ['failed', 'Failed'], ['finished_unseen', 'Finished']].map(([st, l]) =>
    `<a class="f-tile st-${st}" href="#fleet"><b>${count(st)}</b><span><i class="dot"></i>${l}</span></a>`).join('')}</section>`;
  const row = (s) => `<a class="f-row st-${s.state}" href="#${hrefFor(s)}">${U.avatar(s.agent, s.state, 44)}<span class="f-rb"><b>${esc(s.name)}</b><span>${esc(s.title)}</span><small>${esc(srv(s.server).name)} · ${s.wait}</small></span>${U.chip(s.state, STATE[s.state].label)}</a>`;
  const hero = (full) => { const s = ses('s1'), d = U.decision; return `<article class="f-hero">
      <header>${U.avatar(s.agent, null, 44)}<div><b>${esc(s.name)}</b><small>${U.AGENT[s.agent].name} · ${esc(srv(s.server).name)}</small></div><span class="f-wait">waiting ${s.wait}</span></header>
      <p class="f-ctx">${esc(d.context)}</p><h2>${esc(d.question)}</h2>
      <div class="f-opts">${d.options.map((o, i) => `<button class="f-opt ${i === 0 ? 'primary' : ''}"><span class="f-k">${o.key}</span><span><b>${esc(o.label)}</b><small>${esc(o.hint)}</small></span></button>`).join('')}</div>
      <form class="f-line" onsubmit="return false"><input type="text" placeholder="Write a reply" aria-label="Write a reply"/><button class="f-ib" type="button" aria-label="Dictate">${icon('mic', 20)}</button><button class="f-ib send" type="submit" aria-label="Send reply">${icon('send', 18)}</button></form>
      ${full ? '' : `<div class="f-more"><a href="#terminal">${icon('terminal', 18)}<span>Open terminal</span></a><button>${icon('skip', 18)}<span>Skip to next</span></button></div>`}</article>`; };

  // ----- session terminal -----
  const strip = (cur) => `<div class="f-strip" role="tablist" aria-label="Sessions across servers">${[...sessions].sort((a, b) => STATE[a.state].rank - STATE[b.state].rank).map((s) =>
    `<a role="tab" class="f-sd st-${s.state} ${s.id === cur ? 'on' : ''}" aria-selected="${s.id === cur}" href="#terminal" aria-label="${esc(s.name)}, ${STATE[s.state].label}">${U.avatar(s.agent, s.state, 36)}${s.id === cur ? `<b>${esc(s.name)}</b>` : ''}</a>`).join('')}<a class="f-sd add" aria-label="New session" href="#home">${icon('plus', 20)}</a></div>`;
  const seg = (on) => `<div class="f-seg" role="tablist"><a role="tab" href="#decision" class="${on === 0 ? 'on' : ''}" aria-selected="${on === 0}">Decision</a><a role="tab" href="#terminal" class="${on === 1 ? 'on' : ''}" aria-selected="${on === 1}">Terminal</a></div>`;
  const sbar = (s) => `<header class="f-sbar"><a class="f-ib" href="#home" aria-label="Back">${icon('back', 24)}</a><div class="f-st"><b>${esc(s.name)}</b><small>${esc(srv(s.server).name)}</small></div>${U.chip(s.state)}</header>`;
  const ctxRow = () => `<div class="f-ctxrow"><span class="f-ct"><b>Needs you</b><span>${esc(U.decision.question)}</span></span><button class="f-quick"><span class="f-k">1</span>${esc(U.decision.options[0].short)}</button><a class="f-ib" href="#decision" aria-label="See all options">${icon('more', 20)}</a></div>`;
  // The current client's row (KeyRow.svelte), kept as the default; which keys show is configurable in Settings.
  const KEYS = [['/', 'Slash'], ['^C', 'Control C'], ['⎋', 'Escape'], ['↵', 'New line'], ['⌃', 'Ctrl', 'mod'], ['⌥', 'Alt', 'mod'], ['⇧', 'Shift', 'mod'], ['⇥', 'Tab'], ['Fn', 'More keys', 'mod'], ['↑', 'Arrow up'], ['↓', 'Arrow down'], ['⌨', 'Show or hide the keyboard'], ['mic', 'Dictate'], ['EN', 'Dictation language'], ['A−', 'Smaller text'], ['A+', 'Larger text']];
  const keyRow = () => `<div class="f-keys dense" role="toolbar" aria-label="Terminal keys">${KEYS.map(([k, n, c]) => `<button class="${c || ''}" aria-label="${n}" ${c === 'mod' ? 'aria-pressed="false"' : ''}>${k === 'mic' ? icon('mic', 16) : k}</button>`).join('')}</div>`;
  const dock = () => `<div class="f-dock">${ctxRow()}<form class="f-line" onsubmit="return false"><input type="text" placeholder="Send a line to the agent" aria-label="Send a line to the agent"/><button class="f-ib" type="button" aria-label="Dictate">${icon('mic', 20)}</button><button class="f-ib send" type="submit" aria-label="Send line, or press Enter when empty">${icon('send', 18)}</button></form>
    ${keyRow()}</div>`;
  const more = () => `<div class="f-scrim"></div><section class="f-sheet" role="dialog" aria-label="More keys"><div class="f-grab"></div><header><b>More</b><span>Tap to send</span></header>
    ${[['Claude Code', ['Interrupt', 'Accept edits', 'Commands', 'New line'], 'agent'], ['Navigate', ['←', '→', 'Home', 'End', 'PgUp', 'PgDn']], ['Control', ['^C', '^D', '^Z', '^L', '^A', '^E', '^W', '^U']], ['Symbols', ['|', '~', '`', '\\', '{', '}', '[', ']', '<', '>', '-', '_']], ['Function', ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']], ['tmux', ['Prefix', 'New window', 'Next', 'Previous', 'Detach']]]
      .map(([t, ks, c]) => `<div class="f-grp"><h3>${t}</h3><div class="f-kk ${c || ''}">${ks.map((k) => `<button class="${k === 'Interrupt' ? 'danger' : ''}">${esc(k)}</button>`).join('')}</div></div>`).join('')}
    <div class="f-grp"><h3>Tools</h3><div class="f-kk tools"><button>Paste</button><button>Copy</button><button>Select text</button><button>A−</button><button>A+</button><button>Type into terminal</button></div></div></section>`;
  const termScreen = (o) => `<div class="screen ${o.kbd ? 'kb' : ''}"><div class="tsheet f-ts"><div class="thead">${o.kbd ? sbar(ses('s1')) : sbar(ses('s1')) + strip('s1') + seg(1)}</div><div class="tbody">${U.phoneTerm('s1')}</div><footer class="tfoot">${dock()}</footer></div>${o.kbd ? U.kbd() : ''}${o.more ? more() : ''}</div>`;

  const keysSettings = () => `<section class="f-set"><h2>Terminal keys</h2><p class="muted">Choose which keys appear in the row. The default is today's row. Drag to reorder (not in this prototype).</p>
    <div class="f-keycfg">${KEYS.map(([k, n]) => `<button aria-pressed="true" aria-label="${n}"><span>${k === 'mic' ? icon('mic', 18) : k}</span><small>${n.length > 11 ? n.slice(0, 10) + '…' : n}</small></button>`).join('')}</div>
    <div class="f-seg2"><button class="on">Today's row</button><button>Minimal (6)</button><button>Custom</button></div></section>`;
  const skinPicker = () => `<section class="f-set"><h2>Appearance</h2><div class="f-seg2" data-k="skin">${['navy', 'graphite', 'teal'].map((v) => `<button data-v="${v}" onclick="setSkin('skin','${v}')">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
    <div class="f-seg2" data-k="theme">${['dark', 'light'].map((v) => `<button data-v="${v}" onclick="setSkin('theme','${v}')">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
    <p class="muted">Skins change colour only. The layout never changes.</p></section>`;
  window.setSkin = (k, v) => { document.documentElement.dataset[k] = v; try { localStorage.setItem('tb-' + k, v); } catch (e) {} mark(); };
  const mark = () => document.querySelectorAll('.f-seg2[data-k]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (document.documentElement.dataset[g.dataset.k] || (g.dataset.k === 'skin' ? 'navy' : 'dark')) === b.dataset.v)));

  function mobile(screen) {
    if (screen === 'terminal' || screen === 'terminal-more') return termScreen({ more: screen === 'terminal-more' });
    if (screen === 'terminal-kbd') return termScreen({ kbd: true });
    if (screen === 'decision') return `<div class="screen f-page nobar"><header class="f-sbar"><a class="f-ib" href="#home" aria-label="Back">${icon('back', 24)}</a><div class="f-st"><b>Decision</b><small>1 of ${U.needs().length} waiting</small></div></header>${seg(0)}<div class="f-body">${hero(true)}</div></div>`;
    const page = {
      home: () => `${summary()}${hero(false)}<h2 class="f-h">Next up</h2><div class="f-list">${U.needs().slice(1).map(row).join('')}</div>`,
      fleet: () => ['needs_input', 'failed', 'finished_unseen', 'working', 'idle'].map((st) => { const l = sessions.filter((s) => s.state === st); return l.length ? `<h2 class="f-h st-${st}"><i class="dot"></i>${STATE[st].label}<em>${l.length}</em></h2><div class="f-list">${l.map(row).join('')}</div>` : ''; }).join(''),
      empty: () => `${summary()}${U.emptyQuiet()}<h2 class="f-h">Continue</h2><div class="f-list">${row(ses('s6'))}</div>`,
      report: () => `<div class="report">${U.report()}</div>`,
      settings: () => skinPicker() + keysSettings(),
    }[screen]();
    const title = { home: 'Inbox', fleet: 'Sessions', empty: 'Inbox', report: 'Activity', settings: 'Settings' }[screen];
    const cur = { home: 'home', empty: 'home', fleet: 'fleet', report: 'report', settings: 'settings' }[screen];
    return `<div class="screen f-page">${bar(title, screen === 'home' || screen === 'empty' ? `<button class="f-ib" aria-label="Notifications">${icon('bell', 22)}</button>` : '')}<div class="f-body">${page}</div>${nav(cur)}</div>`;
  }
  window.boot({ phoneOnly: true, mobile });
  mark(); window.addEventListener('hashchange', () => setTimeout(mark));
})();
