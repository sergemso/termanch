<script lang="ts">
  import { Switch } from 'bits-ui';
  import { setShortcuts, shortcutsOn, SHORTCUTS, isMac } from '../lib/palette';
  /** The Settings destination: where the account, the servers and the app's own switches live. Preferences that exist
   *  today (theme, skin, cache, renderer) stay in the menu until they move here. */
  let { user, serverVersion = '', onservers, onmenu, onshortcuts, onreport, onlogout }: {
    user: string; serverVersion?: string; onservers: () => void; onmenu: () => void; onshortcuts: () => void; onreport: () => void; onlogout: () => void;
  } = $props();
  const row = 'flex h-14 w-full items-center justify-between gap-3 rounded-card border border-line bg-panel px-4 text-left text-base text-fg';
  const key = isMac() ? SHORTCUTS[0].mac : SHORTCUTS[0].other;
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" data-shell="settings">
  <h1 class="text-title font-bold">Settings</h1>
  <p class="text-base text-soft">Signed in as {user}{serverVersion ? ` · server ${serverVersion}` : ''}</p>
  <button type="button" class={row} onclick={onservers}><span>Servers</span><span aria-hidden="true" class="text-soft">›</span></button>
  <button type="button" class={row} onclick={onmenu}><span>Appearance, notifications and more</span><span aria-hidden="true" class="text-soft">›</span></button>
  <div class={row}>
    <label id="shortcuts-label" for="shortcuts-switch"><span class="block">Keyboard shortcuts</span><span class="block text-sm text-soft">{key} opens the command palette. Off gives every key to the terminal.</span></label>
    <Switch.Root id="shortcuts-switch" aria-labelledby="shortcuts-label" checked={$shortcutsOn} onCheckedChange={setShortcuts}
      class="relative inline-flex h-11 w-16 shrink-0 items-center rounded-full bg-raised p-1.5 data-[state=checked]:bg-accent">
      <Switch.Thumb class="block size-8 rounded-full bg-soft transition-transform duration-(--duration-base) data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-accent" />
    </Switch.Root>
  </div>
  <button type="button" class={row} onclick={onshortcuts}><span>Show the shortcut list</span><span aria-hidden="true" class="text-soft">›</span></button>
  <button type="button" class={row} onclick={onreport}><span>Report a problem</span><span aria-hidden="true" class="text-soft">›</span></button>
  <button type="button" class={row} onclick={onlogout}><span>Sign out</span></button>
</div>
