<script lang="ts">
  import AppShell from '../src/AppShell.svelte';
  import KeyRow from '../src/KeyRow.svelte';
  let mods = { ctrl: false, alt: false };
</script>

<AppShell pinned={true}>
  <header style="padding: 8px;">header</header>
  <div class="screen" style="flex: 1; min-height: 0;"></div>
  <KeyRow bind:mods onkey={() => {}} onpaste={() => {}} oncopy={() => {}} />
</AppShell>
