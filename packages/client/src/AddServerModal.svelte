<script lang="ts">
  import type { ServerListItem } from './lib/protocol';
  import { parseAddFragment, wsUrl } from './lib/servers';

  export let prefill: Pick<ServerListItem, 'server_url' | 'server_name' | 'claim'> | null = null;
  export let onclose: () => void;
  export let onadd: (server: ServerListItem) => void;

  let link = '';
  let url = prefill?.server_url ?? '';
  let name = prefill?.server_name ?? 'my-vps';
  let claim = prefill?.claim ?? '';
  let error = '';

  function onLink() {
    const hash = link.includes('#') ? link.slice(link.indexOf('#')) : link;
    const parsed = parseAddFragment(hash.trim());
    if (!parsed) return;
    url = parsed.server_url;
    name = parsed.server_name;
    claim = parsed.claim ?? '';
  }

  function submit() {
    try {
      wsUrl(url);
    } catch {
      error = 'Enter the server URL (https://...)';
      return;
    }
    onadd({ server_url: url.trim(), server_name: name || 'my-vps', registered_at: Date.now(), claim: claim || undefined });
  }
</script>

<div class="modal-overlay" on:click={onclose} style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px;">
  <div class="modal" on:click={(e) => e.stopPropagation()} style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 32px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <h2 style="font-size: 1.25rem;">Add Server</h2>
      <button on:click={onclose} style="background: none; color: var(--fg-muted); padding: 4px; line-height: 1;">✕</button>
    </div>

    <p style="color: var(--fg-muted); margin-bottom: 16px;">On your VPS run <code>termanch-server --register</code> and open the link it prints. Or paste it here:</p>
    <input bind:value={link} on:input={onLink} placeholder="Registration link" style="width: 100%; margin-bottom: 16px;" />

    <label style="display: block; font-size: 0.875rem; margin-bottom: 6px; color: var(--fg-muted);">Server URL</label>
    <input bind:value={url} placeholder="https://xxxx.trycloudflare.com" style="width: 100%; margin-bottom: 12px;" />
    <label style="display: block; font-size: 0.875rem; margin-bottom: 6px; color: var(--fg-muted);">Name</label>
    <input bind:value={name} style="width: 100%; margin-bottom: 12px;" />
    {#if claim}
      <p style="font-size: 0.8rem; color: var(--fg-muted); margin-bottom: 12px;">Registration token included. You become this server's owner when you connect.</p>
    {/if}
    <button on:click={submit} disabled={!url} style="width: 100%;">Add and connect</button>
    {#if error}
      <p style="color: var(--danger); margin-top: 12px; font-size: 0.875rem;">{error}</p>
    {/if}
  </div>
</div>
