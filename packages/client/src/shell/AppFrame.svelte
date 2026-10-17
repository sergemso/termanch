<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import BottomBar from './BottomBar.svelte';
  import SideNav from './SideNav.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import ShortcutHelp from './ShortcutHelp.svelte';
  import type { Destination } from '../lib/router';
  import { navGroups } from '../lib/navlist';
  import { buildEntries, isMac, matchShortcut, SHORTCUTS, shortcutsOn, type PaletteEntry } from '../lib/palette';
  import { edgeSwipeBack } from '../lib/edgeswipe';
  import type { AgentMap } from '../lib/agents';
  import type { HubServer, HubSession } from '../lib/hub';

  /**
   * The arrangement around a screen (decision 0101). Phone: content, then the bottom bar (hidden while the soft keyboard
   * is open inside a session). From 1024 px: sidebar, content, and an optional right pane. The palette and the shortcut
   * list are the same at both widths. The frame never sizes the app: AppShell does (soft-keyboard-never-hides-input).
   */
  let { current, onnavigate, servers, sessions, agents, activeKey = null, chrome = true, inSession = false, keyboardOpen = false, wide = $bindable(false), rightOpen = $bindable(false), helpOpen = $bindable(false),
    canCreate = true, onopen, onserver, onaction = () => {}, onback, children, right }: {
    current: Destination; onnavigate: (d: Destination) => void; servers: HubServer[]; sessions: HubSession[]; agents: AgentMap; activeKey?: string | null; chrome?: boolean;
    inSession?: boolean; keyboardOpen?: boolean; wide?: boolean; rightOpen?: boolean; helpOpen?: boolean; canCreate?: boolean; onopen: (key: string) => void; onserver: (id: string) => void;
    onaction?: (id: string) => void; onback?: () => void; children: Snippet; right?: Snippet;
  } = $props();

  const mac = isMac();
  const groups = $derived(navGroups(servers, sessions, agents));
  const needsYou = $derived(groups.reduce((n, g) => n + g.sessions.filter((s) => s.state === 'needs-you').length, 0));
  const entries = $derived(buildEntries({ servers, sessions, agents, wide, rightOpen, canCreate }));
  const hint = $derived(mac ? SHORTCUTS[0].mac : SHORTCUTS[0].other);
  let paletteOpen = $state(false);
  let returnTo: HTMLElement | null = $state(null);

  function openPalette() {
    const a = document.activeElement;
    returnTo = a instanceof HTMLElement && a !== document.body ? a : null;
    paletteOpen = true;
  }
  function run(e: PaletteEntry) {
    const [kind, ...rest] = e.id.split(':');
    const arg = rest.join(':');
    if (kind === 'dest') onnavigate(arg as Destination);
    else if (kind === 'session') onopen(arg);
    else if (kind === 'server') onserver(arg);
    else if (arg === 'toggle-right') rightOpen = !rightOpen;
    else if (arg === 'shortcuts') helpOpen = true;
    else onaction(arg);
  }

  onMount(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const media = () => (wide = mq.matches);
    media();
    mq.addEventListener('change', media);
    // Capture phase: the terminal's own key handler would otherwise see Ctrl+K first. Only the registered shortcut is
    // taken; every other key is left alone.
    const keydown = (e: KeyboardEvent) => {
      if (!chrome || !$shortcutsOn || matchShortcut(e, mac) !== 'palette') return;
      e.preventDefault();
      e.stopPropagation();
      if (paletteOpen) paletteOpen = false; else openPalette();
    };
    document.addEventListener('keydown', keydown, true);
    return () => { mq.removeEventListener('change', media); document.removeEventListener('keydown', keydown, true); };
  });

  let swipe: { id: number; x: number; y: number } | null = null;
  const bar = $derived(chrome && !wide && !(inSession && keyboardOpen));
</script>

<div class="flex min-h-0 min-w-0 flex-1" data-shell="frame" data-wide={wide} data-bar={bar}>
  {#if chrome && wide}
    <SideNav {current} {onnavigate} {groups} {activeKey} {onopen} {onserver} onnew={canCreate ? () => onaction('new-session') : undefined} onsearch={openPalette} searchHint={hint} {rightOpen} onright={() => (rightOpen = !rightOpen)} />
  {/if}
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div class="relative flex min-h-0 min-w-0 flex-1">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-shell="main">{@render children()}</div>
      {#if chrome && wide && rightOpen && right}
        <aside aria-label="Right pane" data-shell="right-pane" class="flex w-80 shrink-0 flex-col overflow-hidden border-l border-line bg-panel">{@render right()}</aside>
      {/if}
      {#if onback && inSession && !wide}
        <!-- Swipe-back: a drag from the left edge opens the session list. Not a control: taps here fall through to nothing. -->
        <div aria-hidden="true" data-shell="edge" class="absolute inset-y-0 left-0 z-40 w-5 touch-none"
          onpointerdown={(e) => (swipe = { id: e.pointerId, x: e.clientX, y: e.clientY })}
          onpointerup={(e) => { if (swipe?.id === e.pointerId && edgeSwipeBack(swipe, { x: e.clientX, y: e.clientY })) onback?.(); swipe = null; }}
          onpointercancel={() => (swipe = null)}></div>
      {/if}
    </div>
    {#if bar}<BottomBar {current} {onnavigate} {needsYou} />{/if}
  </div>
  {#if chrome}
    <CommandPalette bind:open={paletteOpen} {entries} onrun={run} {returnTo} />
    {#if helpOpen}<ShortcutHelp mac={mac} enabled={$shortcutsOn} onclose={() => (helpOpen = false)} />{/if}
  {/if}
</div>
