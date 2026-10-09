<script lang="ts">
  import { onMount } from 'svelte';
  import Terminal from './Terminal.svelte';
  import ServerList from './ServerList.svelte';
  import AddServerModal from './AddServerModal.svelte';
  import Toast from './Toast.svelte';
  import type { ServerMessage, SessionInfo, ServerListItem } from './lib/protocol';

  let user: string | null = null;
  let jwt: string | null = null;
  let selectedServer: ServerListItem | null = null;
  let sessions: SessionInfo[] = [];
  let activeSessionId: string | null = null;
  let showAddServer = false;
  let toast: { message: string; type: 'success' | 'error' } | null = null;

  const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
  const OAUTH_REDIRECT = 'https://app.termanch.dev/callback';

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast = { message, type };
    setTimeout(() => toast = null, 4000);
  }

  async function checkAuth() {
    const stored = localStorage.getItem('termanch_jwt');
    if (stored) {
      try {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          jwt = stored;
          user = payload.username;
          return true;
        }
      } catch {}
    }
    return false;
  }

  async function loadServers() {
    const stored = localStorage.getItem('termanch_servers');
    if (stored) {
      try {
        return JSON.parse(stored) as ServerListItem[];
      } catch {}
    }
    return [];
  }

  function saveServers(servers: ServerListItem[]) {
    localStorage.setItem('termanch_servers', JSON.stringify(servers));
  }

  async function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (!code) return false;

    try {
      const res = await fetch('/api/oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error('OAuth exchange failed');
      const { token } = await res.json();
      localStorage.setItem('termanch_jwt', token);
      const payload = JSON.parse(atob(token.split('.')[1]));
      jwt = token;
      user = payload.username;
      window.history.replaceState({}, '', '/');
      showToast(`Welcome, ${user}!`);
      return true;
    } catch (e) {
      showToast('Authentication failed', 'error');
      return false;
    }
  }

  async function connectToServer(server: ServerListItem) {
    selectedServer = server;
    try {
      const ws = new WebSocket(server.server_url);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: jwt!, server_token: server.server_url }));
      };

      ws.onmessage = (event) => {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      };

      ws.onerror = () => showToast('Connection error', 'error');
      ws.onclose = () => showToast('Disconnected', 'error');

      // Store WS globally for terminal
      (window as any).__termanch_ws = ws;
    } catch (e) {
      showToast('Failed to connect', 'error');
    }
  }

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'auth_ok':
        showToast(`Connected to ${msg.server_name}`);
        (window as any).__termanch_ws?.send(JSON.stringify({ type: 'list_sessions' }));
        break;
      case 'sessions':
        sessions = msg.sessions;
        break;
      case 'session_attached':
        activeSessionId = msg.session_id;
        break;
      case 'output':
        // Handled by terminal component
        break;
      case 'agent_event':
        showToast(`Agent ${msg.agent} ${msg.event} in ${msg.session_id}`);
        break;
      case 'error':
        showToast(msg.message, 'error');
        break;
    }
  }

  async function logout() {
    localStorage.removeItem('termanch_jwt');
    localStorage.removeItem('termanch_servers');
    user = null;
    jwt = null;
    selectedServer = null;
    sessions = [];
    activeSessionId = null;
    (window as any).__termanch_ws?.close();
  }

  onMount(async () => {
    const authed = await checkAuth();
    if (!authed) return;

    // Check for OAuth callback
    if (window.location.pathname === '/callback') {
      await handleOAuthCallback();
    }

    const servers = await loadServers();
    // Servers loaded reactively via ServerList
  });
</script>

<div class="app">
  {#if !user}
    <div class="auth-screen">
      <div class="card" style="max-width: 400px; margin: auto; margin-top: 10vh;">
        <h1 style="margin-bottom: 8px;">Termanch</h1>
        <p style="color: var(--fg-muted); margin-bottom: 24px;">Terminal for remote AI coding agents</p>
        <a href={`https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT)}&scope=read:user user:email`}>
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
        <ServerList {user} {jwt} onselect={connectToServer} onadd={() => showAddServer = true} />
      {:else}
        <div style="display: flex; flex: 1; overflow: hidden;">
          <aside style="width: 280px; border-right: 1px solid var(--border); background: var(--bg-secondary); padding: 16px; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 0.875rem; text-transform: uppercase; color: var(--fg-muted);">Sessions</h3>
              <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" on:click={() => { (window as any).__termanch_ws?.send(JSON.stringify({ type: 'list_sessions' })); }}>Refresh</button>
            </div>
            <ul style="list-style: none;">
              {#each sessions as session}
                <li style="padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; background: {activeSessionId === session.id ? 'var(--accent)' : 'transparent'}; color: {activeSessionId === session.id ? 'var(--bg)' : 'var(--fg)'};" on:click={() => { activeSessionId = session.id; (window as any).__termanch_ws?.send(JSON.stringify({ type: 'attach', session_id: session.id })); }}>
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

          <Terminal {activeSessionId} />
        </div>
      {/if}
    </main>
  {/if}

  {#if showAddServer}
    <AddServerModal {jwt} onclose={() => showAddServer = false} onsuccess={(server) => { showAddServer = false; showToast(`Server "${server.server_name}" added`); }} />
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