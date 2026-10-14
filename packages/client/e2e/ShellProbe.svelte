<script lang="ts">
  import AppShell from '../src/AppShell.svelte';
  import KeyRow from '../src/KeyRow.svelte';
  import ReportDialog from '../src/ReportDialog.svelte';
  import { Toast } from '../src/lib/ui';
  let mods = { ctrl: false, alt: false };
  let dialog = false;
  const w = window as unknown as { __showDialog: () => void; __hideDialog: () => void };
  w.__showDialog = () => (dialog = true);
  w.__hideDialog = () => (dialog = false);
</script>

<AppShell pinned={true}>
  <header style="padding: 8px;">header</header>
  <div class="screen" style="flex: 1; min-height: 0;"></div>
  <KeyRow bind:mods onkey={() => {}} onpaste={() => {}} oncopy={() => {}} />
  <Toast toast={{ message: 'toast', type: 'success' }} onclose={() => {}} />
  {#if dialog}<ReportDialog text="diagnostics" onclose={() => (dialog = false)} />{/if}
</AppShell>
