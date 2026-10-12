<script lang="ts">
  import { onMount } from 'svelte';
  import Terminal from './Terminal.svelte';
  import ServerList from './ServerList.svelte';
  import AddServerModal from './AddServerModal.svelte';
  import Toast from './Toast.svelte';
  import type { ServerMessage, SessionInfo, ServerListItem } from './lib/protocol';
  import { parseClaim, parseServerLink } from './lib/onboard';
  import { Connection, type ConnState } from './lib/connection';
  import { lookup, type DirRecord } from './lib/directory';
  import { deviceKey, publicKeyB64, signChallenge, certExpiry } from './lib/device';
  import AppShell from './AppShell.svelte';
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

  let user: string | null = null;
  /** Device certificate from the hosted function; the GitHub token itself is never kept (DECISION-0062). */
  let deviceCert: string | null = null;
  let servers: ServerListItem[] = [];
  let selectedServer: ServerListItem | null = null;
  let sessions: SessionInfo[] = [];
  let activeSessionId: string | null = null;
  let connection: Connection | null = null;
  let connState: ConnState = 'closed';
  let connDetail = '';
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
      const server: ServerListItem = { server_id: id, server_name: 'my-vps', server_url: '', record, registered_at: Date.now() };
      addServer(server);
      connectToServer(server);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add the server', 'error');
    }
  }

  function connectToServer(server: ServerListItem) {
    connection?.close();
    selectedServer = server;
    sessions = [];
    activeSessionId = null;
    connState = 'connecting';
    // Use the stored record first; ask the directory only after a failure, to stay within its request budget.
    let record = server.record;
    let refresh = !record && !!server.server_id;
    connection = new Connection({
      target: async () => {
        if (refresh && server.server_id) {
          try {
            record = (await lookup(location.origin, server.server_id)) ?? record;
          } catch (e) {
            console.warn('directory lookup failed', e);
          }
        }
        return { record, wsUrl: server.server_url || undefined };
      },
      credentials: async () => {
        const pair = await deviceKey();
        return { cert: deviceCert!, sign: (id, nonce) => signChallenge(pair, id, nonce) };
      },
      serverId: server.server_id,
      claim: server.claim,
      onState: (s, detail) => {
        connState = s;
        connDetail = detail ?? '';
        if (s === 'connected') {
          refresh = false;
          if (record && server.server_id) addServer({ ...server, record });
        } else {
          refresh = true;
        }
      },
      onReady: (msg, isReconnect) => {
        if (server.claim) {
          // The claim token is single-use: the server now knows its owner.
          const { claim, ...rest } = server;
          server = rest;
          addServer({ ...rest, server_name: msg.server_name || rest.server_name });
        }
        showToast(isReconnect ? 'Reconnected' : `Connected to ${msg.server_name}`);
        connection?.send({ type: 'list_sessions' });
        // tmux kept the session alive; attaching again repaints it.
        if (activeSessionId) connection?.send({ type: 'attach', session_id: activeSessionId });
      },
      onFatal: (message) => {
        showToast(message, 'error');
        selectedServer = null;
      },
    });
    connection.subscribe(handleServerMessage);
    connection.start();
  }

  const lastKey = () => `termanch_last_session_${selectedServer?.server_id || selectedServer?.server_url || ''}`;

  function attach(id: string) {
    drawerOpen = false;
    activeSessionId = id;
    try {
      localStorage.setItem(lastKey(), id);
    } catch {
      /* private mode */
    }
    connection?.send({ type: 'attach', session_id: id });
  }

  /** After connecting: open the session used last on this server, else the first one, so a tap on Connect lands in a terminal. */
  function openDefaultSession(list: SessionInfo[]) {
    if (activeSessionId || list.length === 0) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(lastKey());
    } catch {
      /* private mode */
    }
    attach((list.find((x) => x.id === last) ?? list[0]).id);
  }

  function newSession() {
    const name = prompt('New tmux session name', `agent-${sessions.length + 1}`);
    if (name) connection?.send({ type: 'new_session', name });
  }

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'sessions':
        sessions = msg.sessions;
        openDefaultSession(msg.sessions);
        break;
      case 'session_attached':
        activeSessionId = msg.session_id;
        break;
      case 'agent_event':
        showToast(`Agent ${msg.agent} ${msg.event} in ${msg.session_id}`);
        break;
      case 'error':
        showToast(msg.message, 'error');
        break;
    }
  }

  function logout() {
    localStorage.removeItem('termanch_auth');
    user = null;
    deviceCert = null;
    selectedServer = null;
    sessions = [];
    activeSessionId = null;
    connection?.close();
    connection = null;
  }

  function leaveServer() {
    connection?.close();
    connection = null;
    selectedServer = null;
    sessions = [];
    activeSessionId = null;
    drawerOpen = false;
  }

  onMount(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const media = () => (narrow = mq.matches);
    media();
    mq.addEventListener('change', media);
    watchForUpdates();
    // Last line of defence: an error nobody caught must not leave a dead screen without a word.
    let lastReport = 0;
    const report = (e: ErrorEvent | PromiseRejectionEvent) => {
      const text = String('message' in e ? e.message : (e.reason?.message ?? e.reason ?? ''));
      console.error('uncaught', text);
      if (text.includes('ResizeObserver') || Date.now() - lastReport < 5000) return;
      lastReport = Date.now();
      showToast('Something went wrong. If the screen looks stuck, go back to Servers.', 'error');
    };
    window.addEventListener('error', report);
    window.addEventListener('unhandledrejection', report);
    return () => {
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

<AppShell pinned={!!selectedServer}>
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
      <h1 style="font-size: 1.25rem; user-select: none; -webkit-user-select: none;" on:click={titleTapped}>Termanch</h1>
      <div style="display: flex; align-items: center; gap: 16px;">
        {#if $updateAvailable}<button on:click={() => location.reload()} style="padding: 6px 12px;">Update available</button>{/if}
        {#if $canInstall}<button on:click={promptInstall} style="padding: 6px 12px;">Install app</button>{/if}
        <span style="color: var(--fg-muted);">@{user}</span>
        <button class="secondary" on:click={logout}>Logout</button>
      </div>
    </header>

    {#if iosHint && !selectedServer}
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); font-size: 0.85rem;">
        <span style="flex: 1;">Install Termanch: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It starts faster and can notify you.</span>
        <button class="secondary" style="padding: 4px 10px;" on:click={() => { iosHint = false; localStorage.setItem('termanch_ios_hint', '1'); }}>Dismiss</button>
      </div>
    {/if}

    <main style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
      <svelte:boundary onerror={(e) => console.error('screen failed', e)}>
      {#snippet failed(_error, reset)}
        <div class="card" style="margin: auto; max-width: 360px; text-align: center;">
          <p style="margin-bottom: 12px;">This screen failed to load.</p>
          <button on:click={() => { leaveServer(); reset(); }}>Back to servers</button>
        </div>
      {/snippet}
      {#if !selectedServer}
        <ServerList {servers} onselect={connectToServer} onadd={() => { addPrefill = null; showAddServer = true; }} onremove={(i) => saveServers(servers.filter((_, n) => n !== i))} />
      {:else}
        <div style="display: flex; flex: 1; min-height: 0; overflow: hidden; position: relative;">
          {#if narrow && drawerOpen}
            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 25;" on:click={() => (drawerOpen = false)}></div>
          {/if}
          <aside style="{narrow ? 'position: absolute; top: 0; bottom: 0; left: 0; z-index: 30; width: min(85vw, 320px); transform: translateX(' + (drawerOpen ? '0' : '-105%') + '); transition: transform 0.15s;' : 'width: 280px;'} border-right: 1px solid var(--border); background: var(--bg-secondary); padding: 16px; overflow-y: auto;">
            <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem; margin-bottom: 12px;" on:click={leaveServer}>← Servers</button>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 0.875rem; text-transform: uppercase; color: var(--fg-muted);">Sessions · {connState}</h3>
              <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" on:click={() => connection?.send({ type: 'list_sessions' })}>Refresh</button>
              <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" on:click={newSession}>+ New</button>
            </div>
            {#if connState !== 'connected'}
              <!-- Own row, wrapped: a long diagnostic inside the flex header squeezed it into a tall narrow column. -->
              <div style="font-size: 0.75rem; margin: -8px 0 12px; padding: 8px; border-radius: 6px; background: var(--bg); overflow-wrap: anywhere;">
                <div style="color: var(--fg-muted);">{{ unreachable: 'Server unreachable', reconnecting: 'Reconnecting…', connecting: 'Connecting…', closed: 'Disconnected' }[connState]}</div>
                {#if connDetail && connState === 'unreachable'}
                  <details style="margin-top: 4px; color: var(--danger);"><summary style="cursor: pointer;">Details</summary>{connDetail}</details>
                {/if}
              </div>
            {/if}
            <ul style="list-style: none;">
              {#each sessions as session}
                <li style="padding: 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; background: {activeSessionId === session.id ? 'var(--accent)' : 'transparent'}; color: {activeSessionId === session.id ? 'var(--bg)' : 'var(--fg)'};" on:click={() => attach(session.id)}>
                  <div style="font-weight: 500;">{session.name}</div>
                  <div style="font-size: 0.75rem; color: var(--fg-muted);">{session.id.slice(0, 12)}</div>
                  {#if session.agent}
                    <span style="font-size: 0.7rem; background: var(--border); padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">{session.agent}</span>
                  {/if}
                </li>
              {/each}
              {#if sessions.length === 0}
                <li style="color: var(--fg-muted); text-align: center; padding: 24px;">No tmux sessions found</li>
              {/if}
            </ul>
          </aside>

          <div style="flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;">
            {#if narrow}
              <div style="display: flex; gap: 6px; padding: 6px 8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
                <button class="secondary" aria-label="Sessions" style="padding: 6px 10px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;" on:click={() => (drawerOpen = !drawerOpen)}>☰ {sessions.find((x) => x.id === activeSessionId)?.name ?? 'Sessions'}</button>
                <button class="secondary" aria-label="Servers" style="padding: 6px 10px;" on:click={leaveServer}>Servers</button>
              </div>
            {/if}
            {#if connection}<Terminal {connection} {activeSessionId} {connState} />{/if}
          </div>
        </div>
      {/if}
      </svelte:boundary>
    </main>
  {/if}

  {#if showAddServer}
    <AddServerModal origin={location.origin} prefillSecret={addPrefill} onserver={(id) => { showAddServer = false; void addServerById(id); }} onclose={() => showAddServer = false} onadd={(server) => { addServer(server); showAddServer = false; connectToServer(server); }} />
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