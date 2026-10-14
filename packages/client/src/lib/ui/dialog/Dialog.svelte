<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { cn } from '../utils';

  let {
    open = $bindable(true),
    title,
    onclose,
    class: className = '',
    children,
  }: { open?: boolean; title: string; onclose?: () => void; class?: string; children: Snippet } = $props();
</script>

<!-- No portal: the dialog stays inside the app shell, which follows the visible area on iOS. -->
<Dialog.Root
  bind:open
  onOpenChange={(o) => {
    if (!o) onclose?.();
  }}
>
  <Dialog.Overlay class="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 p-6">
    <Dialog.Content
      class={cn('max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-border bg-bg-secondary p-7', className)}
    >
      <div class="mb-4 flex items-center justify-between">
        <Dialog.Title class="text-xl font-bold">{title}</Dialog.Title>
        <Dialog.Close aria-label="Close" class="p-1 leading-none text-fg-muted">✕</Dialog.Close>
      </div>
      {@render children()}
    </Dialog.Content>
  </Dialog.Overlay>
</Dialog.Root>
