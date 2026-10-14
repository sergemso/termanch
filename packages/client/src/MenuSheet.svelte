<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, changeSettings } from './lib/settings';
  import { canInstall, promptInstall, isIosBrowser } from './lib/pwa';
  import { updateAvailable } from './lib/update';
  import { APP_VERSION } from './lib/appVersion';

  export let user: string;
  export let avatar = '';
  export let serverVersion = '';
  export let onservers: () => void;
  export let onreport: () => void;
  export let onlogout: () => void;
  export let onclose: () => void;
  let dialog: HTMLDialogElement;
  let showSettings = false;
  const initialRenderer = $settings.renderer;
  let broken = false;
  onMount(() => { dialog.showModal(); });
  function choose(action: () => void) { onclose(); action(); }
</script>

<dialog bind:this={dialog} aria-label="Menu" on:cancel|preventDefault={onclose} on:click={(e) => { if (e.target === dialog) onclose(); }}>
  <div class="menu">
    <div class="row"><h2>Termanch</h2><button class="secondary" aria-label="Close menu" on:click={onclose}>×</button></div>
    <button class="secondary" on:click={() => choose(onservers)}>Servers</button>
    <button class="secondary" aria-expanded={showSettings} on:click={() => showSettings = !showSettings}>Settings</button>
    {#if showSettings}
      <label>Cache TTL <select value={$settings.cacheTtlMs} on:change={(e) => changeSettings({ cacheTtlMs: Number(e.currentTarget.value) as 300000 | 3600000 })}><option value="300000">5 minutes</option><option value="3600000">1 hour</option></select></label>
      <label>Keep warm text <input value={$settings.keepWarm} placeholder="empty hides the button" maxlength="200" autocapitalize="off" on:change={(e) => changeSettings({ keepWarm: e.currentTarget.value })} /></label>
      <label>Theme <select value={$settings.theme} on:change={(e) => changeSettings({ theme: e.currentTarget.value as 'dark' | 'light' | 'system' })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
      <label>Terminal renderer <select value={$settings.renderer} on:change={(e) => changeSettings({ renderer: e.currentTarget.value as 'webgl' | 'dom' })}><option value="webgl">WebGL (fast)</option><option value="dom">Plain (if the screen flickers or goes blank)</option></select></label>
      {#if $settings.renderer !== initialRenderer}<p>Applies the next time a session opens.</p>{/if}
    {/if}
    <button class="secondary" on:click={() => choose(onreport)}>Report a problem</button>
    {#if $canInstall}<button class="secondary" on:click={() => choose(promptInstall)}>Install app</button>
    {:else if isIosBrowser()}<p>Install: Share → Add to Home Screen.</p>
    {:else}<p>Install is available from your browser’s app menu.</p>{/if}
    <button class="secondary" disabled={!$updateAvailable} on:click={() => location.reload()}>{$updateAvailable ? 'Update available' : 'App is up to date'}</button>
    <p class="ver">Termanch {APP_VERSION}{#if serverVersion} · server {serverVersion}{/if}</p>
    <div class="account">{#if avatar && !broken}<img src={avatar} alt="" width="28" height="28" referrerpolicy="no-referrer" on:error={() => broken = true} />{/if}<span>@{user}</span></div>
    <button class="secondary" on:click={() => choose(onlogout)}>Log out</button>
  </div>
</dialog>

<style>
  dialog { margin: auto auto 0; width: min(100%, 420px); max-height: calc(var(--app-height, 100dvh) - 16px); overflow-y: auto; padding: 0; border: 1px solid var(--border); border-radius: 16px 16px 0 0; background: var(--bg-secondary); color: var(--fg); }
  dialog::backdrop { background: #0008; }
  .menu { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; justify-content: space-between; align-items: center; }
  button, select { min-height: 44px; min-width: 44px; }
  button { text-align: left; }
  label { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  p { font-size: 0.8rem; color: var(--fg-muted); }
  .account { display: flex; align-items: center; gap: 8px; padding: 8px; }
  img { border-radius: 50%; }
</style>
