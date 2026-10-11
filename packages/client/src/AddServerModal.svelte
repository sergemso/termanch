<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { ServerListItem } from './lib/protocol';
  import { randomClaimSecret } from './lib/directory';
  import { installCommand, parseClaim, waitForServer, ClaimTimeout } from './lib/onboard';
  import { decodeQrFile, startCameraScan } from './lib/scan';
  import { wsUrl } from './lib/servers';

  export let origin: string;
  /** A secret that arrived by link or earlier scan: start waiting for that server right away. */
  export let prefillSecret: string | null = null;
  export let onclose: () => void;
  export let onadd: (server: ServerListItem) => void;

  type Tab = 'paste' | 'scan' | 'url';
  let tab: Tab = prefillSecret ? 'paste' : 'paste';
  let name = 'my-vps';
  let secret = prefillSecret ?? randomClaimSecret();
  let command = installCommand(origin, secret);
  let waiting = false;
  let error = '';
  let copied = false;
  let manualUrl = '';
  let manualClaim = '';
  let video: HTMLVideoElement;
  let stopCamera: (() => void) | null = null;
  let scanning = false;
  let abort: AbortController | null = null;

  async function begin(s: string) {
    abort?.abort();
    abort = new AbortController();
    secret = s;
    command = installCommand(origin, s);
    waiting = true;
    error = '';
    try {
      const record = await waitForServer(origin, s, abort.signal);
      onadd({ server_id: record.server_id, server_name: name || 'my-vps', server_url: '', record, registered_at: Date.now(), claim: s });
    } catch (e) {
      waiting = false;
      if (e instanceof DOMException && e.name === 'AbortError') return;
      error = e instanceof ClaimTimeout ? 'Nothing arrived within 15 minutes. Start again to get a new command.' : e instanceof Error ? e.message : 'Failed';
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(command);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function gotText(text: string) {
    const s = parseClaim(text);
    if (!s) {
      error = 'That QR is not a Termanch registration code.';
      return;
    }
    stopScan();
    void begin(s);
  }

  async function startScan() {
    error = '';
    scanning = true;
    stopCamera = await startCameraScan(video, gotText, (m) => {
      error = m;
      scanning = false;
    });
  }

  function stopScan() {
    stopCamera?.();
    stopCamera = null;
    scanning = false;
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    error = '';
    try {
      const text = await decodeQrFile(file);
      if (text) gotText(text);
      else error = 'No QR code found in that image. Make sure the whole QR is visible, then try again.';
    } catch {
      error = 'Could not read that image.';
    }
  }

  function addByUrl() {
    try {
      wsUrl(manualUrl);
    } catch {
      error = 'Enter the server URL (https://...)';
      return;
    }
    onadd({ server_url: manualUrl.trim(), server_name: name || 'my-vps', registered_at: Date.now(), claim: manualClaim.trim() || undefined });
  }

  function choose(t: Tab) {
    stopScan();
    error = '';
    tab = t;
  }

  onMount(() => {
    // Flow A starts waiting immediately: the secret is already in the command the user is about to paste.
    void begin(secret);
  });
  onDestroy(() => {
    abort?.abort();
    stopScan();
  });
</script>

<div class="modal-overlay" on:click={onclose} style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px;">
  <div class="modal" on:click={(e) => e.stopPropagation()} style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="font-size: 1.25rem;">Add Server</h2>
      <button on:click={onclose} style="background: none; color: var(--fg-muted); padding: 4px; line-height: 1;">✕</button>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      <button class={tab === 'paste' ? '' : 'secondary'} on:click={() => choose('paste')} style="flex: 1; padding: 8px;">Paste a command</button>
      <button class={tab === 'scan' ? '' : 'secondary'} on:click={() => choose('scan')} style="flex: 1; padding: 8px;">Scan a QR</button>
    </div>

    <label style="display: block; font-size: 0.875rem; margin-bottom: 6px; color: var(--fg-muted);">Name</label>
    <input bind:value={name} style="width: 100%; margin-bottom: 16px;" />

    {#if tab === 'paste'}
      <p style="color: var(--fg-muted); margin-bottom: 8px;">Run this once on your VPS (any Linux with root access). It installs and starts everything, and the server appears here by itself.</p>
      <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 0.75rem; word-break: break-all; margin-bottom: 8px;">{command}</div>
      <button on:click={copy} style="width: 100%; margin-bottom: 12px;">{copied ? 'Copied' : 'Copy command'}</button>
    {:else if tab === 'scan'}
      <p style="color: var(--fg-muted); margin-bottom: 8px;">On the VPS run <code>curl -fsSL {origin}/install.sh | sh</code>. It shows a QR code. Scan it here, or take a screenshot of it and choose the screenshot. Delete the screenshot afterwards.</p>
      <video bind:this={video} muted playsinline style="width: 100%; border-radius: 8px; background: #000; margin-bottom: 8px; display: {scanning ? 'block' : 'none'};"></video>
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        {#if scanning}
          <button class="secondary" on:click={stopScan} style="flex: 1;">Stop camera</button>
        {:else}
          <button on:click={startScan} style="flex: 1;">Scan with camera</button>
        {/if}
        <label class="secondary" style="flex: 1; text-align: center; cursor: pointer; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
          Choose screenshot
          <input type="file" accept="image/*" on:change={onFile} style="display: none;" />
        </label>
      </div>
    {/if}

    {#if waiting}
      <p style="color: var(--fg-muted); font-size: 0.875rem;">Waiting for your server to appear… this can take a minute.</p>
    {/if}
    {#if error}
      <p style="color: var(--danger); margin: 8px 0; font-size: 0.875rem;">{error}</p>
    {/if}

    <details style="margin-top: 16px;">
      <summary style="cursor: pointer; color: var(--fg-muted); font-size: 0.875rem;">Advanced: connect by URL (tunnel or reverse proxy)</summary>
      <input bind:value={manualUrl} placeholder="https://xxxx.trycloudflare.com" style="width: 100%; margin: 8px 0;" />
      <input bind:value={manualClaim} placeholder="Registration token (first connection only)" style="width: 100%; margin-bottom: 8px;" />
      <button class="secondary" on:click={addByUrl} disabled={!manualUrl} style="width: 100%;">Add and connect</button>
    </details>
  </div>
</div>
