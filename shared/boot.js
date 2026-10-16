// Hash router for the prototypes. Each direction supplies {mobile(screen), desktop(screen)}.
window.boot = function (dir) {
  const params = new URLSearchParams(location.search);
  const pick = (k) => { let v = params.get(k); try { if (v) localStorage.setItem('tb-' + k, v); else v = localStorage.getItem('tb-' + k); } catch (e) {} return v; };
  const skin = pick('skin'), theme = pick('theme');
  if (skin) document.documentElement.dataset.skin = skin;
  if (theme) document.documentElement.dataset.theme = theme;
  const known = ['home', 'empty', 'empty-servers', 'decision', 'session-t1', 'session-t3', 'terminal', 'terminal-more', 'terminal-kbd', 'fleet', 'report', 'settings'];
  function render() {
    const h = (location.hash || '#home').slice(1);
    const screen = known.includes(h) ? h : 'home';
    document.body.dataset.screen = screen;
    if (dir.phoneOnly) { $('#root').innerHTML = `<div class="frame">${dir.mobile(screen)}</div>`; window.scrollTo(0, 0); return; }
    $('#root').innerHTML = `<div class="mobile">${dir.mobile(screen)}</div><div class="desktop">${dir.desktop(screen)}</div>${params.has('palette') ? UI.palette() : ''}`;
    window.scrollTo(0, 0);
  }
  function $(s) { return document.querySelector(s); }
  window.addEventListener('hashchange', render);
  render();
};
