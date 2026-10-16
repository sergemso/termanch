// Prototype renderer shared by all three directions. Direction look comes from
// each direction's theme.css; markup variants hang off body[data-dir].
(function () {
  const { servers, sessions, STATE, AGENT, decision, transcript, tail, timeline, usage } = window.TB;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const srv = (id) => servers.find((s) => s.id === id);
  const ses = (id) => sessions.find((s) => s.id === id);
  const params = new URLSearchParams(location.search);
  const dir = document.body.dataset.dir;
  if (params.get('theme')) document.documentElement.dataset.theme = params.get('theme');

  const G = {
    needs_input: '<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" fill="currentColor"/>',
    failed: '<path d="M8 2 14.6 13.5H1.4z" fill="currentColor"/>',
    finished_unseen: '<path d="M3 8.4 6.4 11.6 13 4.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    working: '<circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2.2"/><path d="M8 2.8a5.2 5.2 0 0 1 5.2 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="spin"/>',
    idle: '<circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="2"/>',
  };
  const glyph = (state) => `<svg class="gl" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">${G[state]}</svg>`;
  const chip = (state) => `<span class="chip st-${state}">${glyph(state)}${STATE[state].label}</span>`;
  const badge = (agent) => `<span class="agent" data-a="${agent}" title="${AGENT[agent].name}" aria-label="${AGENT[agent].name}">${AGENT[agent].mark}</span>`;
  const icon = {
    mic: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    term: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke-linecap="round"/></svg>',
  };

  // ---------- pieces ----------
  const queueItem = (s) => `
    <a class="q-item st-${s.state}" href="#${s.state === 'needs_input' ? 'decision' : 'session-' + (s.tier === 'T1' ? 't1' : 't3')}">
      ${badge(s.agent)}
      <span class="q-body">
        <span class="q-top">${chip(s.state)}<span class="q-wait">${s.wait}</span></span>
        <span class="q-title">${esc(s.title)}</span>
        <span class="q-meta">${esc(srv(s.server).name)} · ${AGENT[s.agent].name}</span>
      </span>
    </a>`;

  const needsYou = () => sessions.filter((s) => STATE[s.state].rank <= 2)
    .sort((a, b) => STATE[a.state].rank - STATE[b.state].rank);

  const fleet = () => servers.map((sv) => {
    const list = sessions.filter((s) => s.server === sv.id);
    const count = (st) => list.filter((s) => s.state === st).length;
    return `
      <section class="fleet-srv">
        <header><h3>${esc(sv.name)}</h3>
          <span class="counts">
            <b class="c-work">${count('working')}<small> working</small></b>
            <b class="c-idle">${count('idle')}<small> idle</small></b>
            <b class="c-done">${count('finished_unseen') + count('failed') + count('needs_input')}<small> to look at</small></b>
          </span></header>
        <ul>${list.map((s) => `
          <li><a href="#session-${s.tier === 'T1' ? 't1' : 't3'}" class="row st-${s.state}">
            ${badge(s.agent)}<span class="row-title">${esc(s.title)}</span>${chip(s.state)}</a></li>`).join('')}
        </ul>
      </section>`;
  }).join('');

  const continueCard = () => {
    const s = ses('s6');
    return `<a class="continue" href="#session-t1"><span class="eyebrow">Continue</span>
      <span class="c-title">${esc(s.title)}</span>
      <span class="q-meta">${badge(s.agent)} ${esc(srv(s.server).name)} · last used ${s.wait} ago</span></a>`;
  };

  const composer = (placeholder) => `
    <form class="composer" onsubmit="return false">
      <button class="icon-btn mic" type="button" aria-label="Dictate">${icon.mic}</button>
      <input type="text" placeholder="${esc(placeholder)}" aria-label="Answer in your own words" />
      <button class="icon-btn send" type="submit" aria-label="Send">${icon.send}</button>
    </form>`;

  // ---------- screens ----------
  const screens = {};

  screens.home = () => {
    const q = needsYou();
    return `
      <header class="screen-head"><h1>Home</h1><span class="sub">${q.length} need you · ${sessions.filter((s) => s.state === 'working').length} working</span></header>
      <section class="queue" aria-label="Needs you"><h2 class="sec">Needs you</h2>${q.map(queueItem).join('')}</section>
      <section aria-label="Fleet"><h2 class="sec">Fleet</h2>${fleet()}</section>`;
  };

  screens.empty = () => `
    <header class="screen-head"><h1>Home</h1><span class="sub">All quiet</span></header>
    <div class="empty"><div class="empty-mark" aria-hidden="true">✓</div><h2>Nothing needs you</h2>
      <p>Four agents are working. We will tell you the moment one needs a decision.</p></div>
    ${continueCard()}
    <section aria-label="Fleet"><h2 class="sec">Fleet</h2>${fleet()}</section>`;

  screens['empty-servers'] = () => `
    <header class="screen-head"><h1>Home</h1><span class="sub">No servers yet</span></header>
    <div class="empty"><div class="empty-mark" aria-hidden="true">+</div><h2>Add your first server</h2>
      <p>Run one command on any machine you own. Your agents show up here.</p>
      <pre class="cmd">docker run -d ghcr.io/termenbox/termenbox</pre>
      <button class="btn primary">Add a server</button></div>`;

  screens.decision = () => {
    const s = ses(decision.session);
    return `
      <header class="sheet-head"><a class="back" href="#home" aria-label="Back">${icon.back}</a>
        <div class="sheet-title">${badge(s.agent)}<span><b>${AGENT[s.agent].name}</b><small>waiting ${s.wait} · ${esc(srv(s.server).name)}</small></span></div>
        <a class="btn ghost small" href="#session-t1">${icon.term}<span>Session</span></a></header>
      <article class="decision">
        <p class="task">${esc(s.title)}</p>
        <p class="context">${esc(decision.context)}</p>
        <h2 class="question">${esc(decision.question)}</h2>
        <div class="options">${decision.options.map((o, i) => `
          <button class="opt ${i === 0 ? 'primary' : ''}"><span class="opt-key">${o.key}</span>
            <span class="opt-text"><b>${esc(o.label)}</b><small>${esc(o.hint)}</small></span></button>`).join('')}
        </div>
        <p class="or">or answer in your own words</p>
        ${composer('Type or dictate an answer')}
      </article>`;
  };

  const sessionHead = (s) => `
    <header class="sheet-head"><a class="back" href="#home" aria-label="Back">${icon.back}</a>
      <div class="sheet-title">${badge(s.agent)}<span><b>${esc(s.title.length > 46 ? s.title.slice(0, 44) + '…' : s.title)}</b>
        <small>${AGENT[s.agent].name} · ${esc(srv(s.server).name)}</small></span></div>
      ${chip(s.state)}</header>`;

  screens['session-t1'] = () => {
    const s = ses('s1');
    return `${sessionHead(s)}
      <div class="tier">T1 · hooks and transcript <a href="#terminal" class="link">${icon.term} Full terminal</a></div>
      <div class="transcript">${transcript.map((t) => `<div class="turn ${t.who}">${t.who === 'tool' ? `<code>${esc(t.text)}</code>` : `<p>${esc(t.text)}</p>`}</div>`).join('')}</div>
      <div class="decision-strip"><b>${esc(decision.question)}</b>
        <div class="chips">${decision.options.map((o) => `<button class="pill">${esc(o.label)}</button>`).join('')}</div></div>
      ${composer('Reply to Claude')}`;
  };

  screens['session-t3'] = () => {
    const s = ses('s3');
    return `${sessionHead(s)}
      <div class="tier">T3 · generic view, screen read from the terminal <a href="#terminal" class="link">${icon.term} Full terminal</a></div>
      <div class="decision-strip"><b>Apply these 3 changes?</b>
        <div class="chips"><button class="pill primary">Yes</button><button class="pill">No</button></div></div>
      <pre class="tail" aria-label="Recent terminal output">${tail.map(esc).join('\n')}</pre>
      ${composer('Type to the agent')}`;
  };

  screens.terminal = () => `${sessionHead(ses('s3'))}<pre class="tail term">${tail.concat(['', '$ ']).map(esc).join('\n')}</pre>
      <div class="keyrow">${['Esc', 'Tab', 'Ctrl', '↑', '↓', '←', '→', 'Enter'].map((k) => `<button>${k}</button>`).join('')}</div>`;

  screens.report = () => {
    const rows = Object.entries(timeline).map(([id, segs]) => {
      const s = ses(id);
      return `<div class="lane"><span class="lane-label">${badge(s.agent)}<span>${esc(s.title.slice(0, 26))}${s.title.length > 26 ? '…' : ''}</span></span>
        <span class="lane-bar" role="img" aria-label="${esc(s.title)} over 24 hours">${segs.map(([a, b, st]) =>
          `<i class="seg st-${st}" style="left:${(a / 24) * 100}%;width:${((b - a) / 24) * 100}%" title="${STATE[st].label}"></i>`).join('')}</span></div>`;
    }).join('');
    return `
      <header class="screen-head"><h1>Activity</h1><span class="sub">Last 24 hours</span></header>
      <div class="stats">
        <div class="stat"><small>Decisions asked</small><b>9</b></div>
        <div class="stat"><small>Median wait</small><b>6 min</b></div>
        <div class="stat"><small>Tokens</small><b>${usage.tokens}</b></div>
        <div class="stat"><small>Cost</small><b>${usage.cost}</b></div>
      </div>
      <section class="chart" aria-label="Timeline"><h2 class="sec">Timeline</h2>
        <div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>${rows}
        <ul class="legend">${['working', 'needs_input', 'failed', 'idle'].map((st) => `<li class="st-${st}"><i class="seg st-${st}"></i>${glyph(st)} ${STATE[st].label}</li>`).join('')}</ul>
      </section>
      <section><h2 class="sec">Servers</h2>${servers.map((sv) => `
        <div class="srv-health"><b>${esc(sv.name)}</b><small>${esc(sv.host)} · up ${sv.up}</small>
          <span class="meter" role="img" aria-label="CPU ${sv.cpu}%"><i style="width:${sv.cpu}%"></i></span><small>CPU ${sv.cpu}%</small>
          <span class="meter" role="img" aria-label="Memory ${sv.mem}%"><i style="width:${sv.mem}%"></i></span><small>Mem ${sv.mem}%</small></div>`).join('')}
      </section>`;
  };

  // ---------- chrome ----------
  const nav = [['home', 'Home', icon.home], ['sessions', 'Sessions', icon.list], ['report', 'Activity', icon.pulse], ['settings', 'Settings', icon.gear]];
  const SHEETS = ['decision', 'session-t1', 'session-t3', 'terminal'];

  const sidebar = (cur) => `
    <aside class="sidebar" aria-label="Navigation">
      <div class="brand">termenbox</div>
      <nav>${nav.map(([id, l, ic]) => `<a href="#${id === 'sessions' ? 'session-t1' : id}" class="${cur === id ? 'on' : ''}">${ic}<span>${l}</span>${id === 'home' ? `<em>${needsYou().length}</em>` : ''}</a>`).join('')}</nav>
      ${servers.map((sv) => `<div class="side-srv"><h4>${esc(sv.name)}</h4>${sessions.filter((s) => s.server === sv.id).map((s) =>
        `<a class="side-ses st-${s.state}" href="#${s.state === 'needs_input' ? 'decision' : 'session-' + (s.tier === 'T1' ? 't1' : 't3')}">${glyph(s.state)}<span>${esc(s.title)}</span></a>`).join('')}</div>`).join('')}
      <div class="kbd">Search or jump <kbd>Ctrl K</kbd></div>
    </aside>`;

  const rightPane = () => `
    <aside class="rightpane" aria-label="Terminal">
      <header><b>Terminal</b><small>hetzner-box · claude</small></header>
      <pre class="tail term">${['$ claude', '', '  I need one decision before touching the tests.', '', '  1. Keep them signed in', '  2. Sign everyone out once', '  3. Ask me again later', '', '  ❯ '].map(esc).join('\n')}</pre>
    </aside>`;

  const bottomBar = (cur) => `<nav class="bottombar" aria-label="Destinations">${nav.map(([id, l, ic]) =>
    `<a href="#${id === 'sessions' ? 'session-t1' : id}" class="${cur === id ? 'on' : ''}">${ic}<span>${l}</span></a>`).join('')}</nav>`;

  const palette = () => `
    <div class="palette" role="dialog" aria-label="Command palette"><input value="mig" aria-label="Search" />
      <ul><li class="on">${badge('claude')}<span>Migrate the auth middleware…</span><small>hetzner-box</small></li>
      <li><span class="act">+</span><span>New session on home-lab</span><small>action</small></li>
      <li><span class="act">⏸</span><span>Pause work-vps</span><small>action</small></li></ul></div>`;

  function render() {
    const hash = (location.hash || '#home').slice(1);
    const name = screens[hash] ? hash : 'home';
    const cur = ['report'].includes(name) ? 'report' : SHEETS.includes(name) ? 'sessions' : name === 'settings' ? 'settings' : 'home';
    const sheet = SHEETS.includes(name);
    document.body.dataset.screen = name;
    document.body.classList.toggle('is-sheet', sheet);
    const body = name === 'settings' ? '<header class="screen-head"><h1>Settings</h1></header><p class="sub pad">Out of scope for the spike.</p>' : screens[name]();
    $('#root').innerHTML = `
      <div class="app">${sidebar(cur)}
        <main class="main" id="main">${body}</main>
        ${rightPane()}
        ${bottomBar(cur)}
      </div>${params.has('palette') ? palette() : ''}`;
    if (sheet) {
      const m = $('#main');
      const body = document.createElement('div');
      body.className = 'sheet-body';
      [...m.children].forEach((c) => { if (!c.matches('.sheet-head,.composer,.keyrow')) body.appendChild(c); });
      m.insertBefore(body, m.querySelector('.composer,.keyrow'));
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
})();
