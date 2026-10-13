<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Terminal from './Terminal.svelte';
  import ServerList from './ServerList.svelte';
  import AddServerModal from './AddServerModal.svelte';
  import Toast from './Toast.svelte';
  import SessionList from './SessionList.svelte';
  import type { ServerListItem } from './lib/protocol';
  import { parseClaim, parseServerLink } from './lib/onboard';
  import { ServerHub, serverKey } from './lib/hub';
  import { lookup } from './lib/directory';
  import { deviceKey, publicKeyB64, signChallenge, certExpiry, certUserId, avatarUrl } from './lib/device';
  import AppShell from './AppShell.svelte';
  import ReportDialog from './ReportDialog.svelte';
  import { buildReport, noteError, recentErrors } from './lib/report';
  import { runningBundle } from './lib/update';
  import { startUsageMeter } from './lib/usageMeter';
  import { DEBUG_KEY, tapCounter } from './lib/viewport';
  import { updateAvailable, watchForUpdates } from './lib/update';
  import { canInstall, promptInstall, isIosBrowser } from './lib/pwa';

  const titleTap = tapCounter();
  /** Five quick taps on the title switch the viewport overlay on or off; an installed PWA has no address bar for ?debug. */
  function titleTapped() {
    if (!titleTap(Date.now())) return;
    const on = localStorage.getItem(DEBUG_KEY) !== '1';
    localStorage.setItem(DEBUG_KEY, on ? '1' : '0');
    window.dispatchEvent(new Event('termanch-debug'));
    showToast(on ? 'Debug overlay on' : 'Debug overlay off');
  }

  let reportText: string | null = null;
  /** Version of the connected server (`0.1.0+abc1234`), shown so a stale image is noticed. */
  let serverVersion = '';
  function openReport() {
    const vv = window.visualViewport;
    reportText = buildReport({
      version: runningBundle(),
      userAgent: navigator.userAgent,
      inner: `${window.innerWidth}x${window.innerHeight}`,
      visual: vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} top ${Math.round(vv.offsetTop)}` : 'none',
      connection: selectedServer ? connState : 'no server selected',
      server: serverVersion || undefined,
      errors: $recentErrors,
    });
  }

  let user: string | null = null;
  let avatarBroken = false;
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
    onReady: (id, _msg, reconnect) => {
      if (!reconnect || serversPage || id !== activeServerId || !activeKey) return;
      const key = activeKey;
      // Retry and Resume replace the connection: mount its terminal before accepting a repaint.
      void tick().then(() => {
        if (!serversPage && id === activeServerId && key === activeKey) hub.sendToSession(key, { type: 'attach', session_id: key });
      });
    },
    onDrop: (_id, reason, upMs) => noteError(`connection lost after ${Math.round(upMs / 1000)} s: ${reason}`),
    onMessage: (_id, msg) => { if (msg.type === 'error') showToast(msg.message, 'error'); },
  });
  const hubServers = hub.servers;
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
  $: connDetail = selected?.reason ?? '';
  $: backends = selected?.backends ?? [];
  $: serverVersion = selected?.version ?? '';
  let narrow = false;
  let iosHint = isIosBrowser() && !localStorage.getItem('termanch_ios_hint');
  let drawerOpen = false;
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
    sessionStorage.setItem('termanch_oauth_state', state);
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
      const stored = JSON.parse(localStorage.getItem('termanch_auth') || 'null');
      if (stored?.cert && stored?.login && certExpiry(stored.cert) * 1000 > Date.now()) {
        deviceCert = stored.cert;
        user = stored.login;
        return true;
      }
    } catch {}
    localStorage.removeItem('termanch_auth'); // old token-era entry or an expired certificate: sign in again
    return false;
  }

  function loadServers() {
    try {
      servers = JSON.parse(localStorage.getItem('termanch_servers') || '[]');
    } catch {
      servers = [];
    }
  }

  function saveServers(next: ServerListItem[]) {
    servers = next;
    localStorage.setItem('termanch_servers', JSON.stringify(next));
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
    const expected = sessionStorage.getItem('termanch_oauth_state');
    sessionStorage.removeItem('termanch_oauth_state');
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
      localStorage.setItem('termanch_auth', JSON.stringify({ cert, login }));
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

  async function attach(key: string) {
    const session = hub.findSession(key);
    if (!session) return;
    if ($hubServers.find(s => s.id === session.serverId)?.state !== 'connected') {
      showToast('This server is reconnecting. You can retry it in Servers.', 'error');
      return;
    }
    drawerOpen = false;
    if (activeServerId && activeServerId !== session.serverId) hub.send(activeServerId, { type: 'detach' });
    serversPage = false;
    activeKey = key;
    activeServerId = session.serverId;
    // Mount the receiving terminal before attach can produce a repaint on another server.
    await tick();
    if (activeKey === key) hub.sendToSession(key, { type: 'attach', session_id: key });
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
    const connected = $hubServers.filter(s => s.state === 'connected');
    let destination = selected?.state === 'connected' ? selected : connected[0];
    if (!destination) { showToast('Wait for a server to connect or retry it in Servers.', 'error'); return; }
    if (connected.length > 1 && !selected) {
      const pick = prompt('Create on which server? ' + connected.map((s, i) => `${i + 1}: ${s.server.server_name}`).join(', '), '1');
      if (!pick) return;
      destination = connected[Number(pick) - 1];
      if (!destination) return;
    }
    const backends = destination.backends;
    const name = prompt('New session name', `agent-${sessions.length + 1}`);
    if (!name) return;
    let backend: string | undefined;
    if (backends.length > 1) {
      const pick = prompt(`Create it in: ${backends.join(' or ')}?`, backends[0]);
      if (!pick) return;
      backend = backends.find((b) => b === pick.trim().toLowerCase());
      if (!backend) {
        showToast(`Pick one of: ${backends.join(', ')}`, 'error');
        return;
      }
    }
    hub.send(destination.id, { type: 'new_session', name, backend });
  }

  function logout() {
    localStorage.removeItem('termanch_auth');
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
    if (activeServerId) hub.send(activeServerId, { type: 'detach' });
    serversPage = true;
    drawerOpen = false;
  }

  onMount(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const media = () => (narrow = mq.matches);
    media();
    mq.addEventListener('change', media);
    watchForUpdates();
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
        if (serverId) sessionStorage.setItem('termanch_pending_server', serverId);
        else if (claim) sessionStorage.setItem('termanch_pending_claim', claim);
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
      sessionStorage.setItem('termanch_pending_claim', claim);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // A re-add link (#server=...) from the installer or a QR, kept across the GitHub login redirect.
    const serverId = parseServerLink(window.location.hash);
    if (serverId) {
      sessionStorage.setItem('termanch_pending_server', serverId);
      window.history.replaceState({}, '', window.location.pathname);
    }

    let authed = false;
    if (window.location.pathname === '/callback') authed = await handleOAuthCallback();
    else authed = checkAuth();
    if (!authed) return;

    loadServers();
    hub.start(servers);
    const pendingServer = sessionStorage.getItem('termanch_pending_server');
    if (pendingServer) {
      sessionStorage.removeItem('termanch_pending_server');
      void addServerById(pendingServer);
      return;
    }
    const pending = sessionStorage.getItem('termanch_pending_claim');
    if (pending) {
      sessionStorage.removeItem('termanch_pending_claim');
      addPrefill = pending;
      showAddServer = true;
    }
  });
</script>

<AppShell pinned={!!user && servers.length > 0}>
  {#if !user}
    <div class="auth-screen">
      <div class="card" style="max-width: 400px; margin: auto; margin-top: 10vh;">
        <h1 style="margin-bottom: 8px;">Termanch</h1>
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
    <header style="display: flex; justify-content: space-between; align-items: center; padding: {narrow ? '8px 12px' : '16px 24px'}; border-bottom: 1px solid var(--border); background: var(--bg-secondary);">
      <h1 style="font-size: 1.25rem; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;" on:click={titleTapped}>Termanch</h1>
      <div style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px 12px;">
        <button class="secondary" on:click={openReport} aria-label="Report a problem" title="Report a problem" style="padding: 6px {narrow ? '8px' : '12px'}; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          {#if !narrow}Report a problem{/if}
        </button>
        {#if $updateAvailable}<button on:click={() => location.reload()} style="padding: 6px 12px;">Update available</button>{/if}
        {#if $canInstall}<button on:click={promptInstall} style="padding: 6px 12px;">Install app</button>{/if}
        {#if avatar && !avatarBroken}
          <img src={avatar} alt="@{user}" title="@{user}" width="28" height="28" referrerpolicy="no-referrer" on:error={() => (avatarBroken = true)} style="border-radius: 50%; display: block;" />
        {:else}
          <span title="@{user}" aria-label="@{user}" style="width: 28px; height: 28px; border-radius: 50%; background: var(--border); display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; text-transform: uppercase;">{(user ?? '?').slice(0, 1)}</span>
        {/if}
        <button class="secondary" on:click={logout} aria-label="Log out" title="Log out" style="padding: 6px {narrow ? '8px' : '12px'}; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          {#if !narrow}Logout{/if}
        </button>
      </div>
    </header>

    {#if iosHint && !selectedServer}
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); font-size: 0.85rem;">
        <span style="flex: 1;">Install Termanch: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It starts faster and can notify you.</span>
        <button class="secondary" style="padding: 4px 10px;" on:click={() => { iosHint = false; localStorage.setItem('termanch_ios_hint', '1'); }}>Dismiss</button>
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
        <ServerList {servers} states={$hubServers} onpause={(id) => { hub.pause(id); }} onresume={(id) => hub.resume(id)} onretry={(id) => hub.retry(id)} onadd={() => { addPrefill = null; showAddServer = true; }} onremove={removeServer} />
      {:else}
        <div style="display: flex; flex: 1; min-height: 0; overflow: hidden; position: relative;">
          {#if narrow && drawerOpen}
            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 25;" on:click={() => (drawerOpen = false)}></div>
          {/if}
          <aside style="{narrow ? 'position: absolute; top: 0; bottom: 0; left: 0; z-index: 30; width: min(85vw, 320px); transform: translateX(' + (drawerOpen ? '0' : '-105%') + '); transition: transform 0.15s;' : 'width: 280px;'} border-right: 1px solid var(--border); background: var(--bg-secondary); padding: 16px; overflow-y: auto;">
            <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem; margin-bottom: 12px;" on:click={leaveServer}>← Servers</button>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 0.875rem; text-transform: uppercase; color: var(--fg-muted);">Sessions · {connState}{#if serverVersion}<span style="display:block; text-transform:none; font-size:0.65rem; font-weight:400;">server {serverVersion}</span>{/if}</h3>
              <button class="secondary icon" on:click={() => connection?.send({ type: 'list_sessions' })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"></path><polyline points="21 3 21 9 15 9"></polyline></svg>
                Refresh
              </button>
              <button class="secondary icon" on:click={newSession}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New
              </button>
            </div>
            {#if connState !== 'connected'}
              <!-- Own row, wrapped: a long diagnostic inside the flex header squeezed it into a tall narrow column. -->
              <div style="font-size: 0.75rem; margin: -8px 0 12px; padding: 8px; border-radius: 6px; background: var(--bg); overflow-wrap: anywhere;">
                <div style="color: var(--fg-muted);">{{ unreachable: 'Server unreachable', reconnecting: 'Reconnecting…', connecting: 'Connecting…', closed: 'Disconnected', paused: 'Paused' }[connState]}</div>
                {#if connDetail && connState === 'unreachable'}
                  <details style="margin-top: 4px; color: var(--danger);"><summary style="cursor: pointer;">Details</summary>{connDetail}</details>
                {/if}
              </div>
            {/if}
            {#each $hubServers as server (server.id)}
              <div class="server-status" style="padding: 8px 0; font-size: 0.8rem; overflow-wrap: anywhere;">
                {server.server.server_name || 'Server'} · {server.state}
                {#if server.version}<span style="display: block;">server {server.version}</span>{/if}
                {#if server.reason}<span style="display: block;">{server.reason}</span>{/if}
                {#if server.state !== 'connected' && server.state !== 'paused'}<button class="secondary" on:click={() => hub.retry(server.id)}>Retry</button>{/if}
              </div>
            {/each}
            <SessionList {sessions} activeSessionId={activeKey} agentMap={$allAgents} onopen={attach} send={sendSession} />
          </aside>

          <div style="flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;">
            {#if narrow}
              <div style="display: flex; gap: 6px; padding: 6px 8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
                <button class="secondary" aria-label="Sessions" style="padding: 6px 10px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;" on:click={() => (drawerOpen = !drawerOpen)}>☰ {sessions.find((x) => x.id === activeKey)?.name ?? 'Sessions'}</button>
                <button class="secondary" aria-label="Servers" style="padding: 6px 10px;" on:click={leaveServer}>Servers</button>
              </div>
            {/if}
            {#if connection && connState !== 'paused'}
              {#key connection}<Terminal {connection} {activeSessionId} {connState} />{/key}
            {:else}
              <div class="card" style="margin: auto;">{activeKey ? 'This server is paused. Resume it in Servers.' : 'Choose a session to open its terminal.'}<button class="secondary" on:click={leaveServer}>Servers</button></div>
            {/if}
          </div>
        </div>
      {/if}
      </svelte:boundary>
    </main>
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
  .auth-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
</style>
