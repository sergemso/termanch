// Shared components for the three prototype directions. Pure string templates.
window.UI = (function () {
  const { servers, sessions, STATE, AGENT, decision, steps, activity, transcript, term, timeline, usage } = window.TB;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const srv = (id) => servers.find((s) => s.id === id);
  const ses = (id) => sessions.find((s) => s.id === id);
  const needs = () => sessions.filter((s) => STATE[s.state].rank <= 2).sort((a, b) => STATE[a.state].rank - STATE[b.state].rank);
  const count = (st) => sessions.filter((s) => s.state === st).length;

  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.2 3.5 5.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    branch: '<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 7.2v9.6M18 10.2c0 4-6 3-12 6"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16 9.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    kbd: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    skip: '<path d="m6 5 8 7-8 7zM19 5v14"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  };
  const icon = (n, size = 18) =>
    `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const logo = (size = 30) =>
    `<svg class="logo" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="m9.5 11.5 5 4.5-5 4.5M17 21h6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const chip = (state, label) => `<span class="chip st-${state}"><i class="dot"></i>${label || STATE[state].short}</span>`;
  const avatar = (agent, state, size = 40) =>
    `<span class="avatar" data-a="${agent}" style="--sz:${size}px" title="${AGENT[agent].name}" role="img" aria-label="${AGENT[agent].name}">${AGENT[agent].mark}${state ? `<i class="ring st-${state}"></i>` : ''}</span>`;
  const btn = (label, cls = '', ic = '') => `<button class="btn ${cls}">${ic ? icon(ic, 16) : ''}<span>${esc(label)}</span></button>`;
  const iconBtn = (n, label, cls = '') => `<button class="icon-btn ${cls}" aria-label="${esc(label)}">${icon(n, 20)}</button>`;
  const progress = (p) => (p ? `<span class="progress" role="img" aria-label="${p[0]} of ${p[1]} steps"><i style="width:${(p[0] / p[1]) * 100}%"></i></span><span class="pcount">${p[0]}/${p[1]}</span>` : '');

  const waitingCard = (opts = {}) => {
    const s = ses(decision.session);
    return `
    <section class="waiting" aria-label="Waiting for your input">
      <header>${icon('info', 18)}<b>Waiting for your input</b><span class="since">${s.wait}</span></header>
      <p class="ctx">${esc(decision.context)}</p>
      <h3 class="q">${esc(decision.question)}</h3>
      <div class="opts">${decision.options.map((o, i) => `
        <button class="opt ${i === 0 ? 'primary' : ''}"><span class="k">${o.key}</span>
          <span class="t"><b>${esc(o.label)}</b>${opts.hints === false ? '' : `<small>${esc(o.hint)}</small>`}</span></button>`).join('')}
      </div>
      ${opts.composer === false ? '' : composer('Or answer in your own words')}
    </section>`;
  };

  const composer = (ph, keys) => `
    <form class="composer" onsubmit="return false">
      <input type="text" placeholder="${esc(ph)}" aria-label="${esc(ph)}" />
      <button class="icon-btn" type="button" aria-label="Dictate">${icon('mic', 20)}</button>
      <button class="icon-btn send" type="submit" aria-label="Send">${icon('send', 18)}</button>
    </form>${keys ? keyRow() : ''}`;

  // Redesigned phone keys. Words not glyphs, 44px targets, sticky modifiers that read as sticky,
  // agent-aware action chips, a swipeable arrow pad, and everything else in a More sheet.
  const chipsFor = (agent) => ({
    claude: [['Interrupt', 'danger'], ['Accept edits'], ['Commands'], ['New line'], ['Paste'], ['Select']],
    codex: [['Interrupt', 'danger'], ['Approve'], ['Commands'], ['Paste'], ['Select']],
  }[agent] || [['Interrupt', 'danger'], ['Yes'], ['No'], ['Paste'], ['Select']]);
  const actionChips = (agent = 'claude') => `<div class="achips" role="toolbar" aria-label="Agent actions">${chipsFor(agent).map(([l, c]) => `<button class="achip ${c || ''}">${esc(l)}</button>`).join('')}</div>`;
  const arrowsIcon = `<svg class="i" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>`;
  const keyBar = (opts = {}) => `<div class="kbar" role="toolbar" aria-label="Terminal keys">
    <button class="kk">esc</button><button class="kk">tab</button>
    <button class="kk mod ${opts.ctrl ? 'on' : ''}" aria-pressed="${!!opts.ctrl}">ctrl</button><button class="kk mod" aria-pressed="false">alt</button>
    <button class="kk wide" aria-label="Arrow keys: tap or drag to move">${arrowsIcon}</button>
    <button class="kk" aria-label="More keys">${icon('more', 20)}</button></div>`;
  const lineInput = (ph = 'Send a line to the agent') => `<form class="lineinput" onsubmit="return false">
    <input type="text" placeholder="${esc(ph)}" aria-label="${esc(ph)}" />
    <button class="icon-btn" type="button" aria-label="Dictate">${icon('mic', 20)}</button>
    <button class="icon-btn send" type="submit" aria-label="Send line and press Enter">${icon('send', 18)}</button></form>`;
  // One calm surface: a context row (the decision if one is waiting, else agent actions), the line, the keys.
  const inputDock = (o = {}) => `<div class="idock">${o.context === undefined ? '' : o.context}${o.line === false ? '' : lineInput(o.ph)}${keyBar()}</div>`;
  const moreSheet = () => `<div class="scrim"></div><section class="msheet" role="dialog" aria-label="More keys">
    <header><b>More keys</b><span class="muted">Tap to send</span></header>
    <div class="mgroup"><h4>Claude Code</h4><div class="mkeys agent">${['Interrupt', 'Accept edits', 'Commands', 'New line', 'Paste', 'Select text'].map((k) => `<button class="${k === 'Interrupt' ? 'danger' : ''}">${k}</button>`).join('')}</div></div>
    ${[
      ['Navigate', ['Home', 'End', 'PgUp', 'PgDn', '⌃A', '⌃E', '⌃W', '⌃U']],
      ['Symbols', ['|', '~', '`', '\\', '{', '}', '[', ']', '<', '>', '-', '_', '=', '*']],
      ['Function', ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']],
      ['tmux', ['Prefix', 'New window', 'Next', 'Previous', 'Detach', 'Scroll mode']],
    ].map(([t, ks]) => `<div class="mgroup"><h4>${t}</h4><div class="mkeys">${ks.map((k) => `<button>${esc(k)}</button>`).join('')}</div></div>`).join('')}
    <div class="mrow"><button>Copy</button><button>A−</button><button>A+</button><button>Dictation: Auto</button></div></section>`;
  const keyRow = () => ''; // desktop uses the physical keyboard; phone uses keyBar
  const tabStrip = (cur) => {
    const order = [...sessions].sort((a, b) => STATE[a.state].rank - STATE[b.state].rank).slice(0, 8);
    return `<div class="tabstrip" role="tablist" aria-label="Sessions across servers">${order.map((s) => `<a role="tab" aria-selected="${s.id === cur}" class="tab st-${s.state} ${s.id === cur ? 'on' : ''}" href="#${s.id === cur ? 'terminal' : 'terminal'}">
      <i class="dot"></i><span>${esc(s.name)}</span></a>`).join('')}<a class="tab add" aria-label="New session">${icon('plus', 16)}</a></div>`;
  };
  const seg = (labels, hrefs, on) => `<div class="switch">${labels.map((t, i) => `<a href="#${hrefs[i]}" class="${on === i ? 'on' : ''}">${t}</a>`).join('')}</div>`;
  // Decision peek: the structured layer sits above the keys and never covers the input line.
  const dock = (open) => `<div class="dock ${open ? 'open' : ''}"><div class="dock-h">${icon('info', 16)}<b>Needs you</b><span class="muted">${esc(decision.question)}</span><span class="dock-n">1 of 5</span></div>
    <div class="dock-o">${decision.options.map((o, i) => `<button class="pill ${i === 0 ? 'primary' : ''}"><kbd>${o.key}</kbd>${esc(o.label)}</button>`).join('')}</div></div>`;
  const phoneTerm = (id) => `<pre class="term full" aria-label="Terminal output">${termText(id)}\n<span class="caret">▍</span></pre>`;

  const stepsCard = (id) => {
    const s = ses(id);
    const labels = ['Plan the change', 'Make the edits', 'Run the checks', 'Fix what fails', 'Report back', 'Final review', 'Hand over', 'Close out'];
    const total = s.progress ? s.progress[1] : 4;
    const list = steps[id] || Array.from({ length: Math.min(total, 5) }, (_, i) => ({
      t: labels[i], st: i < (s.progress ? s.progress[0] : 0) ? 'done' : i === (s.progress ? s.progress[0] : 0) ? (s.state === 'needs_input' ? 'wait' : 'todo') : 'todo',
      note: i === (s.progress ? s.progress[0] : 0) && s.state === 'needs_input' ? 'waiting for you' : '' }));
    return `
    <section class="card task">
      <header class="card-h">${icon('file', 18)}<b>Current task</b></header>
      <div class="task-row"><span class="task-t">${esc(s.title.length > 60 ? s.title.slice(0, 58) + '…' : s.title)}</span>${progress(s.progress)}</div>
      <ul class="steps">${list.map((x) => `<li class="${x.st}"><span class="s-i">${x.st === 'done' ? icon('checkc', 20) : x.st === 'wait' ? '<i class="s-wait"></i>' : '<i class="s-todo"></i>'}</span><span>${esc(x.t)}${x.note ? ` <em>(${x.note})</em>` : ''}</span></li>`).join('')}</ul>
    </section>`;
  };

  const activityCard = () => `
    <section class="card">
      <header class="card-h">${icon('history', 18)}<b>Recent activity</b></header>
      <ul class="tl">${activity.map((a) => `<li><time>${a.time}</time><i class="tl-dot t-${a.tone}"></i><span>${esc(a.text)}</span></li>`).join('')}</ul>
    </section>`;

  const colorize = (line) => {
    const l = esc(line);
    if (/^✔/.test(line)) return `<span class="tg">${l}</span>`;
    if (/^✖/.test(line)) return `<span class="tr">${l}</span>`;
    if (/^\[\d/.test(line)) return l.replace(/^(\[[\d:]+\])( &gt; )(.*)$/, '<span class="tm">$1</span><span class="tb">$2$3</span>');
    if (/\[(y\/n|1\/2\/3)\]/.test(line)) return `<span class="ty">${l}</span>`;
    return l;
  };
  const termText = (id) => (term[id] || term.s3).map(colorize).join('\n');
  const termPane = (id, opts = {}) => `
    <section class="termpane">
      ${opts.bare ? '' : `<header class="term-h"><b>TERMINAL</b><span class="tabs"><a class="on">Live</a><a>Scrollback</a></span>
        <span class="grow"></span><button class="btn ghost sm">${icon('search', 15)}<span>Search</span></button>
        <label class="toggle"><input type="checkbox" checked><i></i><span>Follow</span></label>${iconBtn('expand', 'Fullscreen', 'sm')}</header>`}
      <pre class="term" aria-label="Terminal output">${termText(id)}</pre>
      ${opts.input === false ? '' : composer('Send input to agent…') + '<p class="hints">⌃C interrupt · Esc · Tab · ⇧Tab accept edits · / commands</p>'}
    </section>`;

  const transcriptView = () => `<div class="transcript">${transcript.map((t) =>
    `<div class="turn ${t.who}">${t.who === 'tool' ? `<code>${esc(t.text)}</code>` : `<p>${esc(t.text)}</p>`}</div>`).join('')}</div>`;

  const sessionHeader = (s, opts = {}) => `
    <header class="s-head">${avatar(s.agent, null, opts.size || 46)}
      <div class="s-id"><div class="s-name"><b>${esc(s.name)}</b>${chip(s.state)}</div>
        <span class="s-branch">${icon('branch', 14)}${esc(s.branch)}</span></div>
      ${opts.more === false ? '' : iconBtn('more', 'More', 'ghost')}</header>
    <dl class="meta"><div>${icon('terminal', 18)}<dt>Runtime</dt><dd>${esc(s.runtime)}</dd></div>
      <div>${icon('clock', 18)}<dt>Uptime</dt><dd>${esc(s.uptime)}</dd></div>
      <div>${icon('history', 18)}<dt>Last activity</dt><dd>${esc(s.last)}</dd></div></dl>`;

  const statChips = (opts = {}) => `<div class="statchips">
    ${opts.all ? `<span class="sc plain">${icon('users', 16)}<b>${sessions.length}</b> sessions</span>` : ''}
    <span class="sc st-working"><i class="dot"></i>${count('working')} working</span>
    <span class="sc st-needs_input"><i class="dot"></i>${count('needs_input')} needs input</span>
    <span class="sc st-failed"><i class="dot"></i>${count('failed')} failed</span>
    <span class="sc st-finished_unseen"><i class="dot"></i>${count('finished_unseen')} finished</span></div>`;

  const listRow = (s, sel) => `
    <a class="lrow st-${s.state} ${sel ? 'sel' : ''}" href="#${hrefFor(s)}">${avatar(s.agent, s.state, 40)}
      <span class="lbody"><span class="l1"><b>${esc(s.name)}</b>${chip(s.state)}</span>
        <span class="l2">${esc(s.title)}</span>
        <span class="l3">${esc(srv(s.server).name)} · ${s.wait === '4 min' ? 'waiting ' : ''}${s.wait}${s.state === 'needs_input' || s.state === 'failed' || s.state === 'finished_unseen' ? ' ago' : ''}</span></span></a>`;
  const hrefFor = (s) => (s.state === 'needs_input' ? 'decision' : s.tier === 'T1' ? 'session-t1' : 'session-t3');

  const genericPrompt = () => `
    <section class="waiting" aria-label="Prompt read from the terminal">
      <header>${icon('info', 18)}<b>The agent is asking</b><span class="since tier-tag">T3 · read from terminal</span></header>
      <h3 class="q">Apply these 3 changes?</h3>
      <div class="opts row2"><button class="opt primary"><span class="k">y</span><span class="t"><b>Yes</b></span></button><button class="opt"><span class="k">n</span><span class="t"><b>No</b></span></button></div>
    </section>`;
  const emptyQuiet = () => `<div class="empty"><div class="e-mark">${icon('checkc', 30)}</div><h2>Nothing needs you</h2><p>Four agents are working. We will tell you the moment one needs a decision.</p></div>`;
  const emptyServers = () => `<div class="empty"><div class="e-mark">${icon('server', 30)}</div><h2>Add your first server</h2><p>Run one command on any machine you own. Your agents show up here.</p>
    <pre class="cmd">docker run -d ghcr.io/termenbox/termenbox</pre>${btn('Add a server', 'primary', 'plus')}</div>`;

  const report = () => {
    const rows = Object.entries(timeline).map(([id, segs]) => {
      const s = ses(id);
      return `<div class="lane"><span class="lane-l">${avatar(s.agent, null, 32)}<span>${esc(s.name)}</span></span>
        <span class="lane-bar" role="img" aria-label="${esc(s.name)} over 24 hours">${segs.map(([a, b, st]) =>
          `<i class="seg st-${st}" style="left:${(a / 24) * 100}%;width:${((b - a) / 24) * 100}%" title="${STATE[st].label}"></i>`).join('')}</span></div>`;
    }).join('');
    return `
      <header class="page-h"><h1>Activity</h1><span class="muted">Last 24 hours</span></header>
      <div class="stats">
        <div class="stat"><small>Decisions asked</small><b>9</b></div><div class="stat"><small>Median wait</small><b>6 min</b></div>
        <div class="stat"><small>Tokens</small><b>${usage.tokens}</b></div><div class="stat"><small>Cost</small><b>${usage.cost}</b></div></div>
      <section class="card"><header class="card-h">${icon('pulse', 18)}<b>Timeline</b></header>
        <div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>${rows}
        <ul class="legend">${['working', 'needs_input', 'failed', 'idle'].map((st) => `<li><i class="seg st-${st}"></i>${STATE[st].label}</li>`).join('')}</ul></section>
      <section class="card"><header class="card-h">${icon('server', 18)}<b>Servers</b></header>
        ${servers.map((sv) => `<div class="srv"><div><b>${esc(sv.name)}</b><small>${esc(sv.host)} · up ${sv.up}</small></div>
          <div class="meters"><span>CPU ${sv.cpu}%<i class="meter"><b style="width:${sv.cpu}%"></b></i></span><span>Mem ${sv.mem}%<i class="meter"><b style="width:${sv.mem}%"></b></i></span></div></div>`).join('')}</section>`;
  };

  const palette = () => `
    <div class="scrim"></div><div class="palette" role="dialog" aria-label="Command palette">
      <div class="p-in">${icon('search', 18)}<input value="mig" aria-label="Search" /><kbd>Esc</kbd></div>
      <ul><li class="on">${avatar('claude', null, 28)}<span>auth-migration</span><small>hetzner-box · session</small></li>
      <li><span class="act">${icon('plus', 16)}</span><span>New session on home-lab</span><small>action</small></li>
      <li><span class="act">${icon('server', 16)}</span><span>Open server work-vps</span><small>server</small></li></ul></div>`;

  return { esc, srv, ses, needs, count, icon, logo, chip, avatar, btn, iconBtn, progress, waitingCard, composer, keyRow, actionChips, keyBar, lineInput, inputDock, moreSheet, tabStrip, seg, dock, phoneTerm, genericPrompt, stepsCard, activityCard,
    termPane, transcriptView, sessionHeader, statChips, listRow, hrefFor, emptyQuiet, emptyServers, report, palette, sessions, servers, STATE, AGENT, decision };
})();
