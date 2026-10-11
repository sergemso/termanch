<script lang="ts">
  import { onMount } from 'svelte';
  import Terminal from './Terminal.svelte';
  import ServerList from './ServerList.svelte';
  import AddServerModal from './AddServerModal.svelte';
  import Toast from './Toast.svelte';
  import type { ServerMessage, SessionInfo, ServerListItem } from './lib/protocol';
  import { parseClaim } from './lib/onboard';
  import { Connection, type ConnState } from './lib/connection';
  import { lookup, type DirRecord } from './lib/directory';

  let user: string | null = null;
  let githubToken: string | null = null;
  let servers: ServerListItem[] = [];
  let selectedServer: ServerListItem | null = null;
  let sessions: SessionInfo[] = [];
  let activeSessionId: string | null = null;
  let connection: Connection | null = null;
  let connState: ConnState = 'closed';
  let connDetail = '';
  let showAddServer = false;
  let addPrefill: string | null = null;
  let toast: { message: string; type: 'success' | 'error' } | null = null;

  const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast = { message, type };
    setTimeout(() => toast = null, 4000);
  }

  function githubLoginUrl() {
    const state = crypto.randomUUID();
    sessionStorage.setItem('termanch_oauth_state', state);
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${location.origin}/callback`,
      scope: 'read:user',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  function checkAuth() {
    try {
      const stored = JSON.parse(localStorage.getItem('termanch_auth') || 'null');
      if (stored?.token && stored?.login) {
        githubToken = stored.token;
        user = stored.login;
        return true;
      }
    } catch {}
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
    saveServers([...servers.filter((s) => s.server_url !== server.server_url), server]);
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
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error('OAuth exchange failed');
      const { token, login } = await res.json();
      localStorage.setItem('termanch_auth', JSON.stringify({ token, login }));
      githubToken = token;
      user = login;
      showToast(`Welcome, ${login}!`);
      return true;
    } catch (e) {
      showToast('Authentication failed', 'error');
      return false;
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
      token: () => githubToken!,
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

  function attach(id: string) {
    activeSessionId = id;
    connection?.send({ type: 'attach', session_id: id });
  }

  function newSession() {
    const name = prompt('New tmux session name', `agent-${sessions.length + 1}`);
    if (name) connection?.send({ type: 'new_session', name });
  }

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'sessions':
        sessions = msg.sessions;
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
    githubToken = null;
    selectedServer = null;
    sessions = [];
    activeSessionId = null;
    connection?.close();
    connection = null;
  }

  onMount(async () => {
    // A claim link (#claim=...), from a QR opened in the camera app, is kept across the GitHub login redirect.
    const claim = parseClaim(window.location.hash);
    if (claim) {
      sessionStorage.setItem('termanch_pending_claim', claim);
      window.history.replaceState({}, '', window.location.pathname);
    }

    let authed = false;
    if (window.location.pathname === '/callback') authed = await handleOAuthCallback();
    else authed = checkAuth();
    if (!authed) return;

    loadServers();
    const pending = sessionStorage.getItem('termanch_pending_claim');
    if (pending) {
      sessionStorage.removeItem('termanch_pending_claim');
      addPrefill = pending;
      showAddServer = true;
    }
  });
</script>

<div class="app">
  {#if !user}
    <div class="auth-screen">
      <div class="card" style="max-width: 400px; margin: auto; margin-top: 10vh;">
        <h1 style="margin-bottom: 8px;">Termanch</h1>
        <p style="color: var(--fg-muted); margin-bottom: 24px;">Terminal for remote AI coding agents</p>
        <a href={githubLoginUrl()}>
          <button style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            Continue with GitHub
          </button>
        </a>
      </div>
    </div>
  {:else}
    <header style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-secondary);">
      <h1 style="font-size: 1.25rem;">Termanch</h1>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="color: var(--fg-muted);">@{user}</span>
        <button class="secondary" on:click={logout}>Logout</button>
      </div>
    </header>

    <main style="flex: 1; display: flex; flex-direction: column;">
      {#if !selectedServer}
        <ServerList {servers} onselect={connectToServer} onadd={() => { addPrefill = null; showAddServer = true; }} onremove={(i) => saveServers(servers.filter((_, n) => n !== i))} />
      {:else}
        <div style="display: flex; flex: 1; overflow: hidden;">
          <aside style="width: 280px; border-right: 1px solid var(--border); background: var(--bg-secondary); padding: 16px; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 0.875rem; text-transform: uppercase; color: var(--fg-muted);">Sessions · {connState}</h3>
              {#if connDetail}<p style="font-size: 0.75rem; color: var(--danger); margin: 4px 0 8px;">{connDetail}</p>{/if}
              <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" on:click={() => connection?.send({ type: 'list_sessions' })}>Refresh</button>
              <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" on:click={newSession}>+ New</button>
            </div>
            <ul style="list-style: none;">
              {#each sessions as session}
                <li style="padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; background: {activeSessionId === session.id ? 'var(--accent)' : 'transparent'}; color: {activeSessionId === session.id ? 'var(--bg)' : 'var(--fg)'};" on:click={() => attach(session.id)}>
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

          {#if connection}<Terminal {connection} {activeSessionId} />{/if}
        </div>
      {/if}
    </main>
  {/if}

  {#if showAddServer}
    <AddServerModal origin={location.origin} prefillSecret={addPrefill} onclose={() => showAddServer = false} onadd={(server) => { addServer(server); showAddServer = false; connectToServer(server); }} />
  {/if}

  {#if toast}
    <Toast {toast} onclose={() => toast = null} />
  {/if}
</div>

<style>
  .auth-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
</style>