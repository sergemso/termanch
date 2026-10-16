// Mobile-only pieces for the second spike round: state strip, fleet grid, docks, an iOS keyboard illustration, terminal screen frame.
(function () {
  const U = window.UI, { icon, avatar, chip, esc, sessions, STATE, ses, srv, decision } = U;
  const rank = (a, b) => STATE[a.state].rank - STATE[b.state].rank;

  U.stateStrip = (cur) => `<div class="sstrip" role="tablist" aria-label="Sessions across servers">${[...sessions].sort(rank).map((s) =>
    `<a class="sdot st-${s.state} ${s.id === cur ? 'on' : ''}" role="tab" aria-selected="${s.id === cur}" href="#terminal" aria-label="${esc(s.name)}, ${STATE[s.state].label}">${avatar(s.agent, s.state, 36)}<span>${esc(s.name)}</span></a>`).join('')}<a class="sdot add" aria-label="New session">${icon('plus', 18)}</a></div>`;

  U.fleetGrid = () => [['Needs you', (s) => s.state === 'needs_input' || s.state === 'failed', 'needs_input'], ['Working', (s) => s.state === 'working', 'working'], ['Finished', (s) => s.state === 'finished_unseen', 'finished_unseen'], ['Idle', (s) => s.state === 'idle', 'idle']]
    .map(([name, f, st]) => { const list = sessions.filter(f); return `<h3 class="fg-h st-${st}"><i class="dot"></i>${name}<em>${list.length}</em></h3><div class="fg">${list.map((s) =>
      `<a class="fg-t st-${s.state}" href="#${U.hrefFor(s) === 'decision' ? 'terminal' : 'terminal'}">${avatar(s.agent, s.state, 34)}<span><b>${esc(s.name)}</b><small>${esc(srv(s.server).name)} · ${s.wait}</small></span></a>`).join('')}</div>`; }).join('');

  const first = decision.options[0];
  U.dockLine = () => `<div class="dockline"><span class="dl-t">${icon('info', 16)}<b>Needs you</b><span>${esc(decision.question)}</span></span>
    <button class="dl-a"><kbd>1</kbd>${esc(first.label)}</button><a class="dl-m" href="#decision" aria-label="More options">${icon('more', 18)}</a></div>`;

  U.kbd = () => {
    const row = (ks, cls = '') => `<div class="kr ${cls}">${ks.split('').map((k) => `<b>${k}</b>`).join('')}</div>`;
    return `<div class="ioskb" aria-hidden="true"><div class="qt"><span>“Keep”</span><span>signed</span><span>in</span></div>${row('qwertyuiop')}${row('asdfghjkl', 'r2')}<div class="kr r3"><b class="w">⇧</b>${'zxcvbnm'.split('').map((k) => `<b>${k}</b>`).join('')}<b class="w">⌫</b></div>
      <div class="kr r4"><b class="w2">123</b><b class="sp">space</b><b class="w2 go">return</b></div><p>iOS keyboard (illustration)</p></div>`;
  };

  // Frame shared by the three terminal screens. Keyboard open: the head collapses to one line, chips go, the footer stays docked.
  U.termScreen = (o) => `<div class="screen ${o.kbd ? 'kb' : ''}"><div class="tsheet"><div class="thead">${o.head}</div>
    <div class="tbody">${U.phoneTerm(o.id || 's1')}</div><footer class="tfoot">${o.foot}</footer></div>${o.kbd ? U.kbd() : ''}${o.more ? U.moreSheet() : ''}${o.over || ''}</div>`;

  U.slimHead = (s, extra = '') => `<header class="slim"><a class="icon-btn" href="#home" aria-label="Back">${icon('back', 22)}</a>${avatar(s.agent, null, 32)}<div class="sl-t"><b>${esc(s.name)}</b><small>${esc(srv(s.server).name)}</small></div>${extra}${chip(s.state)}</header>`;
})();
