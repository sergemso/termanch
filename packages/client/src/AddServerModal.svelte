<script lang="ts">
  import QRCode from 'qrcode';
  import { onMount } from 'svelte';
  import type { ServerListItem } from './lib/protocol';

  export let jwt: string | null = null;
  export let onclose: () => void;
  export let onsuccess: (server: ServerListItem) => void;

  let step: 'token' | 'polling' = 'token';
  let registrationToken = '';
  let hmacToken = '';
  let qrDataUrl = '';
  let serverName = '';
  let polling = false;
  let error = '';

  async function generateToken() {
    try {
      const res = await fetch('https://app.termanch.dev/api/register/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
        body: JSON.stringify({ server_name: serverName || 'my-vps' }),
      });
      if (!res.ok) throw new Error('Failed to generate token');
      const data = await res.json();
      registrationToken = data.token;
      hmacToken = data.hmac_token;
      qrDataUrl = await QRCode.toDataURL(hmacToken, { width: 256, margin: 2 });
      step = 'polling';
      startPolling();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to generate token';
    }
  }

  async function startPolling() {
    polling = true;
    while (polling) {
      try {
        const res = await fetch(`https://app.termanch.dev/api/register?token=${hmacToken}`);
        if (res.ok) {
          const data = await res.json();
          polling = false;
          onsuccess({ server_url: data.server_url, server_name: data.server_name, registered_at: Date.now() });
          return;
        }
        if (res.status !== 404) throw new Error('Registration failed');
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(hmacToken);
  }

  onMount(() => {
    serverName = 'my-vps';
  });
</script>

<div class="modal-overlay" on:click={onclose} style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px;">
  <div class="modal" on:click={(e) => e.stopPropagation()} style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 32px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <h2 style="font-size: 1.25rem;">Add Server</h2>
      <button on:click={onclose} style="background: none; color: var(--fg-muted); padding: 4px; line-height: 1;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    {#if step === 'token'}
      <div>
        <p style="color: var(--fg-muted); margin-bottom: 16px;">Enter a name for your server and generate a registration token.</p>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 0.875rem; margin-bottom: 6px; color: var(--fg-muted);">Server Name</label>
          <input bind:value={serverName} placeholder="my-vps" style="width: 100%;" />
        </div>
        <button on:click={generateToken} disabled={!serverName} style="width: 100%;">Generate Token</button>
        {#if error}
          <p style="color: var(--danger); margin-top: 12px; font-size: 0.875rem;">{error}</p>
        {/if}
      </div>
    {:else}
      <div style="text-align: center;">
        <p style="color: var(--fg-muted); margin-bottom: 24px;">Run this command on your VPS:</p>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 24px; font-family: monospace; font-size: 0.8rem; text-align: left; overflow-x: auto;">
          <code>docker compose exec termanch-server termanch-server --register</code>
        </div>
        <p style="color: var(--fg-muted); margin-bottom: 16px;">Or scan the QR code with the HMAC token:</p>
        {#if qrDataUrl}
          <img src={qrDataUrl} alt="Registration QR" style="max-width: 256px; border: 1px solid var(--border); border-radius: 8px; background: white; padding: 16px;" />
        {/if}
        <div style="margin-top: 24px; text-align: left;">
          <p style="font-size: 0.75rem; color: var(--fg-muted); margin-bottom: 8px;">HMAC Token (click to copy)</p>
          <div style="display: flex; gap: 8px;">
            <input readonly value={hmacToken} style="flex: 1; font-family: monospace; font-size: 0.75rem;" />
            <button class="secondary" on:click={copyToken} style="white-space: nowrap;">Copy</button>
          </div>
        </div>
        <p style="margin-top: 24px; color: var(--fg-muted); font-size: 0.875rem;">Waiting for server to register...</p>
        <button class="secondary" on:click={() => { polling = false; step = 'token'; }} style="margin-top: 16px;">Cancel</button>
      </div>
    {/if}
  </div>
</div>