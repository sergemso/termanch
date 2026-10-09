<script lang="ts">
  export let toast: { message: string; type: 'success' | 'error' } | null = null;
  export let onclose: () => void;
</script>

{#if toast}
  <div class="toast {toast.type}" on:click={onclose}>
    {toast.message}
  </div>
{/if}