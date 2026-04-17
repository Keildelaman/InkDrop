<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    title: string;
    children: Snippet;
    maxWidth?: string;
  }

  let {
    open,
    onclose,
    title,
    children,
    maxWidth = 'max-w-xl',
  }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div
      class="w-full {maxWidth} bg-surface-elevated rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div class="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 class="text-lg font-semibold">{title}</h2>
        <button
          onclick={onclose}
          class="p-1.5 rounded-lg hover:bg-surface-alt transition-colors text-text-muted hover:text-text cursor-pointer"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="p-6">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in {
    animation: fade-in 150ms ease-out;
  }
  .animate-scale-in {
    animation: scale-in 150ms ease-out;
  }
</style>
