// Hash router for the prototypes. Each direction supplies {mobile(screen), desktop(screen)}.
window.boot = function (dir) {
  const params = new URLSearchParams(location.search);
  if (params.get('theme')) document.documentElement.dataset.theme = params.get('theme');
  const known = ['home', 'empty', 'empty-servers', 'decision', 'session-t1', 'session-t3', 'terminal', 'report', 'settings'];
  function render() {
    const h = (location.hash || '#home').slice(1);
    const screen = known.includes(h) ? h : 'home';
    document.body.dataset.screen = screen;
    $('#root').innerHTML = `<div class="mobile">${dir.mobile(screen)}</div><div class="desktop">${dir.desktop(screen)}</div>${params.has('palette') ? UI.palette() : ''}`;
    window.scrollTo(0, 0);
  }
  function $(s) { return document.querySelector(s); }
  window.addEventListener('hashchange', render);
  render();
};
