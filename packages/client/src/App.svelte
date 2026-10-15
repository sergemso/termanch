<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Terminal from './Terminal.svelte';
  import ServerList from './ServerList.svelte';
  import AddServerModal from './AddServerModal.svelte';
  import { Toast } from './lib/ui';
  import SessionSheet from './SessionSheet.svelte';
  import type { SheetHeight } from './lib/sheet';
  import NavigationBar from './NavigationBar.svelte';
  import MenuSheet from './MenuSheet.svelte';
  import InboxSheet from './InboxSheet.svelte';
  import { inbox, mergeAttention, markAllRead, unreadCount } from './lib/inbox';
  import { currentEndpoint, disablePush, enablePush, pushSupported } from './lib/push';
  import SessionActions from './SessionActions.svelte';
  import WindowMenu from './WindowMenu.svelte';
  import NeedsYouBanner from './NeedsYouBanner.svelte';
  import NewSessionSheet from './NewSessionSheet.svelte';
  import { SnapshotStore } from './lib/snapshots';
  import { serverAtLeast, NEW_WINDOW_VERSION } from './lib/serverVersion';
  import { loadHidden, openTabs, saveHidden } from './lib/tabs';
  import { announce, waitingList } from './lib/notify';
  import { attentionToAck } from './lib/agents';
  import { cacheRemaining, expiringSoon } from './lib/cache';
  import { settings, applyTheme } from './lib/settings';
  import type { ServerListItem } from './lib/protocol';
  import { parseClaim, parseServerLink, serverLink } from './lib/onboard';
  import { sendServerLink } from './lib/share';
  import { ServerHub, serverKey, sessionDestinations, sessionKey, type HubServer } from './lib/hub';
  import { lookup } from './lib/directory';
  import { deviceKey, publicKeyB64, signChallenge, certExpiry, certUserId, avatarUrl } from './lib/device';
  import AppShell from './AppShell.svelte';
  import ReportDialog from './ReportDialog.svelte';
  import { buildReport, noteError, recentErrors } from './lib/report';
  import { runningBundle } from './lib/update';
  import { startUsageMeter } from './lib/usageMeter';
  import { DEBUG_KEY, tapCounter, viewportReading } from './lib/viewport';
  import { crumb, crumbText } from './lib/breadcrumbs';
  import { identityOf } from './lib/identity';
  import { watchForUpdates } from './lib/update';
  import { isIosBrowser } from './lib/pwa';

  const titleTap = tapCounter();
  /** Five quick taps on the title switch the viewport overlay on or off; an installed PWA has no address bar for ?debug. */
  function titleTapped() {
    if (!titleTap(Date.now())) return;
    const on = localStorage.getItem(DEBUG_KEY) !== '1';
    localStorage.setItem(DEBUG_KEY, on ? '1' : '0');
    window.dispatchEvent(new Event('termenbox-debug'));
    showToast(on ? 'Debug overlay on' : 'Debug overlay off');
  }

  let reportText: string | null = null;
  /** Version of the connected server (`0.1.0+abc1234`), shown so a stale image is noticed. */
  let serverVersion = '';
  function openReport() {
    crumb('report opened');
    const vv = window.visualViewport;
    reportText = buildReport({
      version: runningBundle(),
      userAgent: navigator.userAgent,
      inner: `${window.innerWidth}x${window.innerHeight}`,
      visual: viewportReading(vv, window, document.activeElement),
      steps: crumbText(),
      connection: selectedServer ? connState : 'no server selected',
      layout: ['.shell', '.workspace', '.terminal-pane', '.screen', '.xterm', '.xterm canvas'].map((q) => {
        const e = document.querySelector(q);
        if (!e) return `${q} -`;
        const b = e.getBoundingClientRect();
        return `${q} x${Math.round(b.left)} w${Math.round(b.width)} s${e.scrollLeft}`;
      }).join('; '),
      server: serverVersion || undefined,
      errors: $recentErrors,
    });
  }

  let user: string | null = null;
  $: avatar = deviceCert ? avatarUrl(certUserId(deviceCert)) : '';
  /** Device certificate from the hosted function; the GitHub token itself is never kept (DECISION-0062). */
  let deviceCert: string | null = null;
  let servers: ServerListItem[] = [];
  let activeKey: string | null = null;
  let activeServerId: string | null = null;
  let serversPage = false;
  const hub = new ServerHub({
    credentials: async () => {
      const pair = await deviceKey();
      return { cert: deviceCert!, sign: (id, nonce) => signChallenge(pair, id, nonce) };
    },
    target: async (server, refresh) => {
      if (refresh && server.server_id) {
        try { server.record = (await lookup(location.origin, server.server_id)) ?? server.record; }
        catch { /* Try the last verified address before reporting unreachable. */ }
      }
      return { record: server.record, wsUrl: server.server_url || undefined };
    },
    onSaved: server => saveServers(servers.map(s => serverKey(s) === serverKey(server) ? server : s)),
    onReady: (id, msg, reconnect) => {
      hub.send(id, { type: 'push_info' });
      if (!reconnect) showToast(`Connected to ${msg.server_name}`); // a reconnect is shown by the status line, not a toast each time
      if (!reconnect || serversPage || id !== activeServerId || !activeKey) return;
      const key = activeKey;
      // Retry and Resume replace the connection: mount its terminal before accepting a repaint.
      void tick().then(() => {
        if (!serversPage && id === activeServerId && key === activeKey) hub.sendToSession(key, { type: 'attach', session_id: key });
      });
    },
    onDrop: (_id, reason, upMs) => noteError(`connection lost after ${Math.round(upMs / 1000)} s: ${reason}`),
    onFatal: (_id, reason) => { noteError(`connection: ${reason}`); showToast(reason, 'error'); },
    onMessage: (_id, msg) => {
      const id = _id;
      if (msg.type === 'snapshot') snapshots.apply(sessionKey(_id, msg.session), msg);
      else if (msg.type === 'session_attached') preview = null;
      else if (msg.type === 'sessions') openPending(_id, msg.sessions);
      else if (msg.type === 'attention') inbox.update(l => mergeAttention(l, _id, msg.items, s => sessionKey(_id, s), s => hub.findSession(sessionKey(_id, s))?.name ?? s));
      else if (msg.type === 'push_info') pushInfos = { ...pushInfos, [_id]: msg };
      if (msg.type === 'error') showToast(msg.message, 'error');
      else if (msg.type === 'agent_event') showToast(`Agent ${msg.agent} ${msg.event} in ${msg.session_id}`);
    },
  });
  const snapshots = new SnapshotStore();
  /** The last screen seen for the session being opened, dimmed in the terminal until the live repaint replaces it. */
  let preview: string | null = null;
  const hubServers = hub.servers;
  const allWindows = hub.windows;
  const allSessions = hub.allSessions;
  const allAgents = hub.agents;
  const connectedCount = hub.connectedCount;
  const overLimit = hub.overLimit;
  $: selected = $hubServers.find(s => s.id === activeServerId);
  $: selectedServer = selected?.server ?? null;
  $: sessions = $allSessions.map(s => ({ ...s, id: s.key }));
  $: activeSessionId = $allSessions.find(s => s.key === activeKey)?.id ?? null;
  $: connection = selected ? hub.connection(selected.id) : null;
  $: connState = selected?.state ?? 'closed';
  $: serverVersion = selected?.version ?? '';
  let narrow = false;
  let iosHint = isIosBrowser() && !localStorage.getItem('termenbox_ios_hint');
  let sheetHeight: SheetHeight = 'half';
  let now = Date.now();
  let hidden = loadHidden();
  let menuKey: string | null = null;
  let actionConfirm = false;
  let showNew = false;
  let pendingOpen: { serverId: string; name: string } | null = null;
  let quality = '';
  let keyboardOpen = false;
  let sheetHeld = false;
  let menuOpen = false;
  let inboxOpen = false;
  let pushInfos: Record<string, Extract<import('./lib/protocol').ServerMessage, { type: 'push_info' }>> = {};
  let pushOn = false;
  void currentEndpoint().then(e => (pushOn = !!e && typeof Notification !== 'undefined' && Notification.permission === 'granted'));
  // The server the menu speaks about: the open one, else the first that answered.
  $: pushServerId = activeServerId && pushInfos[activeServerId] ? activeServerId : Object.keys(pushInfos)[0] ?? null;
  $: pushView = pushSupported() && pushServerId ? {
    serverName: $hubServers.find(s => s.id === pushServerId)?.server.server_name || 'this server',
    configured: pushInfos[pushServerId].configured, on: pushOn,
    denied: typeof Notification !== 'undefined' && Notification.permission === 'denied',
  } : null;
  async function togglePush(enable: boolean) {
    const id = pushServerId;
    if (!id) return;
    const send = (m: import('./lib/protocol').ClientMessage) => hub.send(id, m);
    try {
      if (enable) {
        const r = await enablePush(send, pushInfos[id].public_key);
        pushOn = r === 'ok';
        if (r === 'denied') showToast('Notifications are blocked in the browser settings', 'error');
        else if (r === 'unsupported') showToast('This browser cannot send notifications', 'error');
      } else { await disablePush(send); pushOn = false; }
    } catch (e) { showToast(e instanceof Error ? e.message : 'Notifications failed', 'error'); }
  }
  // Tell the servers which session is in front, so a push is not sent for what someone is looking at.
  let reportedFg: { serverId: string; session: string } | null = null;
  function reportForeground() {
    const s = activeKey && !serversPage && pageVisible ? hub.findSession(activeKey) : undefined;
    const next = s ? { serverId: s.serverId, session: s.id } : null;
    if (next?.serverId === reportedFg?.serverId && next?.session === reportedFg?.session) return;
    if (reportedFg && reportedFg.serverId !== next?.serverId) hub.send(reportedFg.serverId, { type: 'foreground', session: null });
    if (next) hub.send(next.serverId, { type: 'foreground', session: next.session });
    reportedFg = next;
  }
  $: activeKey, serversPage, pageVisible, reportForeground();
  let actionKey: string | null = null;
  let cardExpanded = false;
  $: actionSession = $allSessions.find(s => s.key === actionKey);
  $: menuSession = $allSessions.find(s => s.key === menuKey);
  const backendOf = (s: { backend?: string; serverId: string } | undefined) => s ? (s.backend ?? $hubServers.find(h => h.id === s.serverId)?.backends[0] ?? '') : '';
  $: tabSessions = openTabs($allSessions, $allAgents, hidden);
  $: waiting = waitingList($allSessions, $allAgents);
  $: announce(waiting.length);
  // Looking at a session clears its finished or failed item on the server; a question stays until it is answered.
  let pageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const acked = new Set<string>();
  function sendAttention(key: string, m: import('./lib/protocol').ClientMessage) {
    const s = hub.findSession(key);
    if (s) hub.send(s.serverId, m);
  }
  $: if (activeKey && !serversPage) {
    for (const id of attentionToAck($allAgents[activeKey], true, pageVisible, acked)) {
      acked.add(id);
      sendAttention(activeKey, { type: 'ack', attention_id: id });
    }
  }
  $: expiring = new Set($allSessions.filter(s => expiringSoon(cacheRemaining($allAgents[s.key], now, $settings.cacheTtlMs))).map(s => s.key));
  $: activeSession = $allSessions.find(s => s.key === activeKey);
  $: profile = backendOf(activeSession) === 'tmux' ? 'tmux' as const : 'shell' as const;
  $: link = selected ? { ok: connState === 'connected', text: connState === 'connected' ? quality || 'connected' : connState } : null;
  $: if (hidden.size) { const live = new Set($allSessions.map(s => s.key)); if ([...hidden].some(k => !live.has(k)) && $allSessions.length) { hidden = new Set([...hidden].filter(k => live.has(k))); saveHidden(hidden); } }
  let showAddServer = false;
  let addPrefill: string | null = null;
  let toast: { message: string; type: 'success' | 'error' } | null = null;

  const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast = { message, type };
    setTimeout(() => toast = null, 4000);
  }

  // Called on click, never during render: each call replaces the stored state, which would break the callback check.
  function loginWithGitHub() {
    const state = crypto.randomUUID();
    sessionStorage.setItem('termenbox_oauth_state', state);
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${location.origin}/callback`,
      scope: 'read:user',
      state,
    });
    window.location.assign(`https://github.com/login/oauth/authorize?${params}`);
  }

  function checkAuth() {
    try {
      const stored = JSON.parse(localStorage.getItem('termenbox_auth') || 'null');
      if (stored?.cert && stored?.login && certExpiry(stored.cert) * 1000 > Date.now()) {
        deviceCert = stored.cert;
        user = stored.login;
        return true;
      }
    } catch {}
    localStorage.removeItem('termenbox_auth'); // old token-era entry or an expired certificate: sign in again
    return false;
  }

  function loadServers() {
    try {
      servers = JSON.parse(localStorage.getItem('termenbox_servers') || '[]');
    } catch {
      servers = [];
    }
  }

  function saveServers(next: ServerListItem[]) {
    servers = next;
    localStorage.setItem('termenbox_servers', JSON.stringify(next));
  }

  function addServer(server: ServerListItem) {
    const same = (s: ServerListItem) => (server.server_id ? s.server_id === server.server_id : !s.server_id && s.server_url === server.server_url);
    saveServers([...servers.filter((s) => !same(s)), server]);
    hub.add(server);
    serversPage = false;
  }

  async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const expected = sessionStorage.getItem('termenbox_oauth_state');
    sessionStorage.removeItem('termenbox_oauth_state');
    window.history.replaceState({}, '', '/');
    if (!code || !expected || params.get('state') !== expected) {
      showToast('Authentication failed', 'error');
      return false;
    }
    try {
      const res = await fetch('/api/oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, device_key: await publicKeyB64(await deviceKey()) }),
      });
      if (!res.ok) throw new Error('OAuth exchange failed');
      const { cert, login } = await res.json();
      localStorage.setItem('termenbox_auth', JSON.stringify({ cert, login }));
      deviceCert = cert;
      user = login;
      showToast(`Welcome, ${login}!`);
      return true;
    } catch (e) {
      showToast('Authentication failed', 'error');
      return false;
    }
  }

  /** Re-adds a registered server by its public id: the record is signed by that key, so nothing secret is needed. */
  async function addServerById(id: string) {
    try {
      const record = await lookup(location.origin, id);
      if (!record) {
        showToast('That server is not in the directory yet. Is it running?', 'error');
        return;
      }
      const server: ServerListItem = { server_id: id, server_name: '', server_url: '', record, registered_at: Date.now() };
      addServer(server);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add the server', 'error');
    }
  }

  /** Sends the saved server to the owner's other device: the share sheet on a phone, a copied link elsewhere. */
  async function shareServer(index: number) {
    const server = servers[index];
    if (!server?.server_id) return;
    const result = await sendServerLink(serverLink(location.origin, server.server_id), server.server_name);
    if (result === 'copied') showToast('Link copied. Open it on your other device and sign in with the same GitHub account.');
    else if (result === 'failed') showToast('Could not share the link', 'error');
  }

  const LAST_KEY = 'termenbox_last_session';
  // The start screen picks up where the last visit left off, unless the user has already chosen something.
  let resumable: string | null = localStorage.getItem(LAST_KEY);
  $: if (resumable && !activeKey && !serversPage && $allSessions.some(s => s.key === resumable) && $hubServers.find(s => s.id === hub.findSession(resumable!)?.serverId)?.state === 'connected') {
    const key = resumable;
    resumable = null;
    void attach(key);
  }
  function forget(key: string) { if (localStorage.getItem(LAST_KEY) === key) localStorage.removeItem(LAST_KEY); }

  async function attach(key: string) {
    resumable = null;
    const session = hub.findSession(key);
    if (!session) return;
    if ($hubServers.find(s => s.id === session.serverId)?.state !== 'connected') {
      showToast('This server is reconnecting. You can retry it in Servers.', 'error');
      return;
    }
    crumb('open session tab');
    sheetHeight = 'closed';
    if (hidden.has(key)) { hidden.delete(key); hidden = new Set(hidden); saveHidden(hidden); }
    if (activeServerId && activeServerId !== session.serverId) hub.send(activeServerId, { type: 'detach' });
    serversPage = false;
    preview = key === activeKey ? null : snapshots.text(key);
    activeKey = key;
    activeServerId = session.serverId;
    localStorage.setItem(LAST_KEY, key);
    // Mount the receiving terminal before attach can produce a repaint on another server.
    await tick();
    if (activeKey === key) hub.sendToSession(key, { type: 'attach', session_id: key });
  }

  /** Opens a window and shows it. The session is attached first when it is not the open one: attaching lands on the
   * tab's representative window, so attaching after the new window exists (or again on the open session) would
   * switch straight back to the old one. tmux moves the attached client to the new window by itself. */
  async function newWindow(key: string) {
    if (key !== activeKey) await attach(key);
    hub.sendToSession(key, { type: 'new_window', session: key });
  }

  /** Fetches a session's screen while the finger is still going down on its tab or card (decision 0084). */
  function peek(key: string) {
    if (key === activeKey) return;
    hub.sendToSession(key, { type: 'peek', session: key, hash: snapshots.hash(key) });
  }

  /** Detach: the tab closes and the stream stops; the session keeps running and stays in the Sessions sheet. */
  function detach(key: string) {
    crumb('detach');
    forget(key);
    hidden = new Set(hidden).add(key); saveHidden(hidden);
    if (key === activeKey) {
      if (activeServerId) hub.send(activeServerId, { type: 'detach' });
      activeKey = null; activeServerId = null; preview = null;
      sheetHeight = 'half';
    }
  }

  /** Close session: it and everything in it ends (the dialog has asked first). */
  function closeSession(key: string) {
    crumb('close session');
    forget(key);
    hub.sendToSession(key, { type: 'close_session', session: key });
    if (key === activeKey) { activeKey = null; activeServerId = null; preview = null; sheetHeight = 'half'; }
  }

  function openWindowMenu(key: string) {
    crumb('window menu opened');
    menuKey = key;
    hub.sendToSession(key, { type: 'windows', session: key });
  }

  function createSession(req: { serverId: string; backend?: string; dir?: string; template?: string; name: string }) {
    pendingOpen = { serverId: req.serverId, name: req.name };
    hub.send(req.serverId, { type: 'new_session', name: req.name, backend: req.backend, dir: req.dir, template: req.template });
  }
  /** The session the user just created opens by itself once the server lists it. */
  function openPending(serverId: string, list: import('./lib/protocol').SessionInfo[]) {
    if (!pendingOpen || pendingOpen.serverId !== serverId) return;
    const made = list.find(s => s.name === pendingOpen!.name);
    if (!made) return;
    pendingOpen = null;
    void attach(sessionKey(serverId, made.id));
  }

  function keepWarm(key: string) {
    if ($settings.keepWarm) hub.sendToSession(key, { type: 'reply', session: key, text: $settings.keepWarm });
  }

  function sendSession(m: import('./lib/protocol').ClientMessage) {
    if ('session' in m) hub.sendToSession(m.session, m);
  }

  function removeServer(index: number) {
    const id = serverKey(servers[index]);
    hub.remove(id);
    saveServers(servers.filter((_, i) => i !== index));
    if (activeServerId === id) { activeKey = null; activeServerId = null; }
  }

  function newSession() {
    if (!sessionDestinations($hubServers, selected).length) { showToast('Wait for a server to connect or retry it in Servers.', 'error'); return; }
    showNew = true;
  }

  function logout() {
    localStorage.removeItem('termenbox_auth');
    hub.close();
    user = null;
    deviceCert = null;
    activeKey = null;
    activeServerId = null;
  }

  function showWorkspace() {
    const wasServersPage = serversPage;
    serversPage = false;
    if (!wasServersPage || !activeKey) return;
    const key = activeKey;
    void tick().then(() => {
      if (!serversPage && activeKey === key && connState === 'connected') hub.sendToSession(key, { type: 'attach', session_id: key });
    });
  }

  function leaveServer() {
    resumable = null;
    if (activeServerId) hub.send(activeServerId, { type: 'detach' });
    serversPage = true;
    sheetHeight = 'closed';
  }

  onMount(() => {
    const visible = () => (pageVisible = document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', visible);
    const mq = window.matchMedia('(max-width: 720px)');
    const media = () => (narrow = mq.matches);
    media();
    mq.addEventListener('change', media);
    watchForUpdates();
    const clock = setInterval(() => {
      now = Date.now();
      const c = connection;
      const kind = c?.kind;
      quality = kind ? `${kind === 'rtc' ? 'direct' : 'relay'}${c?.rtt != null ? ` · ${c.rtt} ms` : ''}` : '';
    }, 1000);
    const vv = window.visualViewport;
    const kb = () => { keyboardOpen = !!vv && window.innerHeight - vv.height > 150; };
    vv?.addEventListener('resize', kb); kb();
    const themeMedia = window.matchMedia('(prefers-color-scheme: light)');
    let currentTheme = 'dark' as 'dark' | 'light' | 'system';
    const themeChanged = () => applyTheme(currentTheme, themeMedia.matches);
    const stopTheme = settings.subscribe(value => { currentTheme = value.theme; themeChanged(); });
    themeMedia.addEventListener('change', themeChanged);
    const stopUsage = startUsageMeter(() => !!selectedServer && connState === 'connected' && !!activeSessionId);
    // Last line of defence: an error nobody caught must not leave a dead screen without a word.
    let lastReport = 0;
    const report = (e: ErrorEvent | PromiseRejectionEvent) => {
      const text = String('message' in e ? e.message : (e.reason?.message ?? e.reason ?? ''));
      console.error('uncaught', text);
      noteError(text);
      if (text.includes('ResizeObserver') || Date.now() - lastReport < 5000) return;
      lastReport = Date.now();
      showToast('Something went wrong. If the screen looks stuck, go back to Servers.', 'error');
    };
    window.addEventListener('error', report);
    window.addEventListener('unhandledrejection', report);
    return () => {
      clearInterval(clock);
      document.removeEventListener("visibilitychange", visible);
      vv?.removeEventListener('resize', kb);
      stopTheme();
      themeMedia.removeEventListener('change', themeChanged);
      stopUsage();
      hub.close();
      window.removeEventListener('error', report);
      window.removeEventListener('unhandledrejection', report);
      mq.removeEventListener('change', media);
    };
  });

  /**
   * A link pasted into a tab where the app is already open only changes the fragment (no reload), so
   * the load-time handling below never sees it.
   */
  onMount(() => {
    const onHash = () => {
      const claim = parseClaim(window.location.hash);
      const serverId = parseServerLink(window.location.hash);
      if (!claim && !serverId) return;
      window.history.replaceState({}, '', window.location.pathname);
      if (!user) {
        // Signed out: keep it across the GitHub login, as a load with the fragment does.
        if (serverId) sessionStorage.setItem('termenbox_pending_server', serverId);
        else if (claim) sessionStorage.setItem('termenbox_pending_claim', claim);
      } else if (serverId) {
        void addServerById(serverId);
      } else if (claim) {
        addPrefill = claim;
        showAddServer = true;
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  onMount(async () => {
    // A claim link (#claim=...), from a QR opened in the camera app, is kept across the GitHub login redirect.
    const claim = parseClaim(window.location.hash);
    if (claim) {
      sessionStorage.setItem('termenbox_pending_claim', claim);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // A re-add link (#server=...) from the installer or a QR, kept across the GitHub login redirect.
    const serverId = parseServerLink(window.location.hash);
    if (serverId) {
      sessionStorage.setItem('termenbox_pending_server', serverId);
      window.history.replaceState({}, '', window.location.pathname);
    }

    let authed = false;
    if (window.location.pathname === '/callback') authed = await handleOAuthCallback();
    else authed = checkAuth();
    if (!authed) return;

    loadServers();
    hub.start(servers);
    const pendingServer = sessionStorage.getItem('termenbox_pending_server');
    if (pendingServer) {
      sessionStorage.removeItem('termenbox_pending_server');
      void addServerById(pendingServer);
      return;
    }
    const pending = sessionStorage.getItem('termenbox_pending_claim');
    if (pending) {
      sessionStorage.removeItem('termenbox_pending_claim');
      addPrefill = pending;
      showAddServer = true;
    }
  });
</script>

<AppShell pinned={!!user && servers.length > 0}>
  {#if !user}
    <div class="auth-screen">
      <div class="card" style="max-width: 400px; margin: auto; margin-top: 10vh;">
        <h1 style="margin-bottom: 8px;">Termenbox</h1>
        <p style="color: var(--fg-muted); margin-bottom: 24px;">Terminal for remote AI coding agents</p>
        <a href="https://github.com/login/oauth/authorize" on:click|preventDefault={loginWithGitHub}>
          <button style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            Continue with GitHub
          </button>
        </a>
      </div>
    </div>
  {:else}
    <NavigationBar sessions={tabSessions} agents={$allAgents} servers={$hubServers} windows={$allWindows} {expiring} {link} {activeKey} held={!!actionSession || !!menuSession || cardExpanded || sheetHeld} onopen={attach} onpeek={peek} ontabmenu={openWindowMenu} onactions={(key) => { actionConfirm = false; actionKey = key; }}
      onlink={() => link && showToast(link.text, link.ok ? 'success' : 'error')} onmenu={() => { titleTapped(); menuOpen = true; }} onsessions={() => { crumb('sessions sheet toggled'); showWorkspace(); sheetHeight = sheetHeight === 'closed' ? 'half' : 'closed'; }} />
    <NeedsYouBanner {waiting} {now} collapsed={keyboardOpen} onopen={attach} ondismiss={(key, id) => sendAttention(key, { type: 'dismiss', attention_id: id })} onanswer={(key, choice, prompt) => sendSession({ type: 'answer', session: key, prompt_id: prompt.id, seq: prompt.seq, choice })} />

    {#if iosHint && !selectedServer}
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); font-size: 0.85rem;">
        <span style="flex: 1;">Install Termenbox: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It starts faster and can notify you.</span>
        <button class="secondary" style="padding: 4px 10px;" on:click={() => { iosHint = false; localStorage.setItem('termenbox_ios_hint', '1'); }}>Dismiss</button>
      </div>
    {/if}

    {#if $overLimit}
      <div class="connection-notice" role="status">{$connectedCount} servers connected. More than 6 may use extra battery. <button class="secondary" on:click={leaveServer}>Manage connections</button></div>
    {/if}
    <main style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
      <svelte:boundary onerror={(e) => { console.error('screen failed', e); noteError(String((e as Error)?.message ?? e)); }}>
      {#snippet failed(_error, reset)}
        <div class="card" style="margin: auto; max-width: 360px; text-align: center;">
          <p style="margin-bottom: 12px;">This screen failed to load.</p>
          <button on:click={() => { leaveServer(); reset(); }}>Back to servers</button>
          <button class="secondary" on:click={openReport}>Report a problem</button>
        </div>
      {/snippet}
      {#if serversPage || servers.length === 0}
        {#if servers.length > 0}<button class="secondary" on:click={showWorkspace}>← Sessions</button>{/if}
        <ServerList {servers} states={$hubServers} onpause={(id) => { hub.pause(id); }} onresume={(id) => hub.resume(id)} onretry={(id) => hub.retry(id)} onadd={() => { addPrefill = null; showAddServer = true; }} onremove={removeServer} onshare={shareServer} />
      {:else}
        <div class="workspace" class:mobile={narrow}>
          <div class="terminal-pane">
            {#if connection && connState !== 'paused'}
              {#key identityOf(connection)}<Terminal {connection} {activeSessionId} {connState} {profile} prefix={selected?.prefix || 'C-b'} {preview} />{/key}
            {:else}
              <div class="card" style="margin: auto;">{activeKey ? 'This server is paused. Resume it in Servers.' : 'Choose a session to open its terminal.'}<button class="secondary" on:click={leaveServer}>Servers</button></div>
            {/if}
          </div>
          <SessionSheet sessions={$allSessions} agents={$allAgents} servers={$hubServers} windows={$allWindows} onpeek={peek} onwarm={keepWarm} {activeKey} mobile={narrow} bind:height={sheetHeight} held={!!actionSession}
            onexpanded={(open) => cardExpanded = open} onheld={(held) => sheetHeld = held} onopen={attach} onnew={newSession} onrefresh={() => { for (const s of $hubServers) hub.send(s.id, { type: 'list_sessions' }); }} onretry={(id) => hub.retry(id)} send={sendSession} />
        </div>
      {/if}
      </svelte:boundary>
    </main>
  {/if}

  {#if menuOpen && user}<MenuSheet {user} {avatar} {serverVersion} onservers={leaveServer} onreport={openReport} onlogout={logout} onclose={() => menuOpen = false} unread={unreadCount($inbox)} oninbox={() => inboxOpen = true} push={pushView} onpush={togglePush} />{/if}
  {#if inboxOpen}<InboxSheet items={$inbox} {now} onopen={attach} onread={() => inbox.update(markAllRead)} onclear={() => inbox.set([])} onclose={() => { inboxOpen = false; inbox.update(markAllRead); }} />{/if}
  {#if actionSession}<SessionActions session={actionSession} canClose={backendOf(actionSession) === 'tmux'} confirmFirst={actionConfirm} ondetach={() => detach(actionSession.key)} onclosesession={() => closeSession(actionSession.key)} onclose={() => actionKey = null} />{/if}
  {#if menuSession && menuKey}
    <WindowMenu session={menuSession} data={$allWindows[menuSession.key]} supported={backendOf(menuSession) === 'tmux'}
      onselect={(index) => hub.sendToSession(menuSession.key, { type: 'select_window', session: menuSession.key, index })}
      canNewWindow={serverAtLeast($hubServers.find(h => h.id === menuSession.serverId)?.version ?? '', NEW_WINDOW_VERSION)}
      onnewwindow={() => newWindow(menuSession.key)}
      onclosewindow={(index) => hub.sendToSession(menuSession.key, { type: 'close_window', session: menuSession.key, index })}
      ondetach={() => detach(menuSession.key)} onclosesession={() => { actionConfirm = true; actionKey = menuSession.key; }} onclose={() => menuKey = null} />
  {/if}
  {#if showNew}
    <NewSessionSheet servers={sessionDestinations($hubServers, selected)} sessions={$allSessions} windows={$allWindows} oncreate={createSession} onclose={() => showNew = false} />
  {/if}

  {#if reportText !== null}
    <ReportDialog text={reportText} onclose={() => (reportText = null)} />
  {/if}

  {#if showAddServer}
    <AddServerModal origin={location.origin} prefillSecret={addPrefill} onserver={(id) => { showAddServer = false; void addServerById(id); }} onclose={() => showAddServer = false} onadd={(server) => { addServer(server); showAddServer = false;  }} />
  {/if}

  {#if toast}
    <Toast {toast} onclose={() => toast = null} />
  {/if}
</AppShell>

<style>
  .workspace { display: flex; flex: 1; min-height: 0; overflow: hidden; position: relative; }
  .workspace.mobile { flex-direction: column; }
  .terminal-pane { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .connection-notice { padding: 8px; font-size: 0.8rem; overflow-wrap: anywhere; }

  .auth-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
</style>
