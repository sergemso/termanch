<script lang="ts">
  import type { HookOffer } from './lib/hooks';
  import HookPreview from './HookPreview.svelte';

  /** The one inline offer on Home (decision 0106): never a modal or a toast. Enable writes the previewed change; Not now
   *  asks again only after a prompt answered by hand or 14 days; Never stops the offers until Settings turns them on again. */
  let { offer, onenable, onlater, onnever }: { offer: HookOffer; onenable: () => void; onlater: () => void; onnever: () => void } = $props();
  const busy = $derived(offer.info.busy === 'apply');
  const btn = 'min-h-11 rounded-card px-4 text-base font-semibold disabled:opacity-60';
</script>

<section class="flex flex-col gap-3 rounded-[20px] border border-line bg-panel p-4" aria-label="Agent hooks" data-hook-offer data-hook-agent={offer.agent}>
  <h2 class="text-title leading-tight font-bold tracking-tight">Get live task and one-tap answers for {offer.label}</h2>
  <p class="text-base text-soft">On {offer.serverName}. {offer.label} then tells Termenbox what it is doing, so cards show the task and answers go to the right prompt. Without it everything still works.</p>
  <HookPreview preview={offer.info.preview} label={offer.label} />
  {#if offer.info.error}<p class="text-sm text-bad" role="alert" data-hook-error>{offer.info.error}</p>{/if}
  <div class="flex flex-col gap-2">
    <button type="button" class="{btn} bg-accent text-on-accent" disabled={busy || !offer.info.preview} onclick={onenable} onpointerdown={(e) => e.preventDefault()}>{busy ? 'Enabling…' : 'Enable'}</button>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="{btn} bg-raised text-fg" disabled={busy} onclick={onlater} onpointerdown={(e) => e.preventDefault()}>Not now</button>
      <button type="button" class="{btn} bg-raised text-fg" disabled={busy} onclick={onnever} onpointerdown={(e) => e.preventDefault()}>Never</button>
    </div>
  </div>
</section>
