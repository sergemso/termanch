<script lang="ts">
  import { cn } from '../utils';

  let {
    toast,
    onclose,
    class: className = '',
  }: { toast: { message: string; type: 'success' | 'error' } | null; onclose: () => void; class?: string } = $props();
</script>

<!-- Absolute inside the app shell, which follows the visible area; fixed would follow the layout viewport.
     On a phone it moves to the top: the bottom edge belongs to the terminal key row. -->
{#if toast}
  <div
    role="status"
    class={cn(
      'toast animate-slide-in absolute right-6 bottom-6 z-[1000] rounded-lg border border-l-4 border-border bg-bg-secondary px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
      toast.type === 'success' ? 'border-l-success' : 'border-l-danger',
      'max-[720px]:top-[calc(var(--safe-top)+8px)] max-[720px]:right-2 max-[720px]:bottom-auto max-[720px]:left-2 max-[720px]:max-h-[30vh] max-[720px]:overflow-hidden max-[720px]:px-3.5 max-[720px]:py-2.5 max-[720px]:text-[0.8rem] max-[720px]:[overflow-wrap:anywhere]',
      className,
    )}
    onclick={onclose}
  >
    {toast.message}
  </div>
{/if}
