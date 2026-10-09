<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import type { ServerListItem } from './lib/protocol';

  export let user: string | null = null;
  export let jwt: string | null = null;
  export let onselect: (server: ServerListItem) => void;
  export let onadd: () => void;

  let servers: ServerListItem[] = [];

  async function loadServers() {
    const stored = localStorage.getItem('termanch_servers');
    if (stored) {
      try {
        servers = JSON.parse(stored);
      } catch {}
    }
  }

  async function saveServers() {
    localStorage.setItem('termanch_servers', JSON.stringify(servers));
  }

  async function registerServer(serverUrl: string, serverName: string) {
    const newServer: ServerListItem = {
      server_url: serverUrl,
      server_name: serverName,
      registered_at: Date.now(),
    };
    servers = [...servers, newServer];
    await saveServers();
  }

  async function removeServer(index: number) {
    servers = servers.filter((_, i) => i !== index);
    await saveServers();
  }

  onMount(loadServers);
</script>

<div class="server-list" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px;">
  <div style="width: 100%; max-width: 600px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
      <h2 style="font-size: 1.5rem;">Your Servers</h2>
      <button on:click={onadd} style="display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add Server
      </button>
    </div>

    {#if servers.length === 0}
      <div class="empty-state" style="text-align: center; padding: 64px 24px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" stroke-width="1.5" style="margin-bottom: 16px;"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>
        <h3 style="margin-bottom: 8px;">No servers yet</h3>
        <p style="color: var(--fg-muted); margin-bottom: 24px;">Deploy a server on your VPS and register it here</p>
        <button on:click={onadd} style="display: inline-flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Your First Server
        </button>
      </div>
    {:else}
      <div style="display: grid; gap: 16px;">
        {#each servers as server, index}
          <div class="server-card" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; transition: border-color 0.15s;" on:mouseenter={() => {}} on:mouseleave={() => {}}>
            <div style="width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, var(--accent), #a371f7); display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>
            </div>
            <div style="flex: 1; min-width: 0;">
              <h3 style="font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{server.server_name}</h3>
              <p style="font-size: 0.75rem; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{server.server_url}</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="secondary" on:click={() => onselect(server)} style="padding: 8px 16px;">Connect</button>
              <button class="secondary" on:click={() => removeServer(index)} style="padding: 8px; color: var(--danger);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>