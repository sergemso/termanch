<script lang="ts">
  import KeyRow from '../src/KeyRow.svelte';
  import KeyRowEditor from '../src/KeyRowEditor.svelte';

  const q = new URLSearchParams(location.search);
  const profile = q.get('profile') === 'tmux' ? 'tmux' : 'shell';
  const voice = q.get('voice') !== '0';
  let mods = $state({ ctrl: false, alt: false, shift: false });
  let prefixArmed = $state(false);
  let fnOpen = $state(false);
  let sent = $state<string[]>([]);
  const log = (what: string) => { sent = [...sent, what]; (window as any).__sent = sent; };
  (window as any).__sent = sent;
</script>

<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-bg text-fg">
  <div class="flex-1 overflow-y-auto p-4"><KeyRowEditor /></div>
  <output data-testid="sent" class="px-4 text-xs text-soft">{sent.length} sent</output>
  <KeyRow bind:mods bind:prefixArmed {profile} prefixLabel="^B" {fnOpen} voiceSupported={voice}
    onkey={(d) => log('key:' + JSON.stringify(d))} onfn={() => { fnOpen = !fnOpen; log('fn'); }} onnewline={() => log('newline')} onkeyboard={() => log('keyboard')}
    onvoice={() => log('voice')} onvoicelang={() => log('voicelang')} onfont={(d) => log('font:' + d)}
    onpaste={() => log('paste')} oncopy={() => log('copy')} onselect={() => log('select')} onbell={() => log('bell')} />
</main>
