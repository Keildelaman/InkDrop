<script lang="ts">
  import { toastState } from '../../lib/toast.svelte';

  const typeClasses: Record<string, string> = {
    error: 'bg-danger text-white',
    success: 'bg-success text-white',
    info: 'bg-surface-elevated text-text border border-border shadow-lg',
  };
</script>

<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
  {#each toastState.toasts as toast (toast.id)}
    <div
      class="px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in pointer-events-auto {typeClasses[toast.type]}"
    >
      {toast.text}
    </div>
  {/each}
</div>

<style>
  @keyframes slide-in {
    from { opacity: 0; transform: translateX(100%); }
    to { opacity: 1; transform: translateX(0); }
  }
  .animate-slide-in {
    animation: slide-in 200ms ease-out;
  }
</style>
