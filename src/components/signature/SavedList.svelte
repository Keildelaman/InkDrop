<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { deleteSignature } from '../../lib/signature/store';

  interface Props {
    onselect: (signatureId: string) => void;
  }

  let { onselect }: Props = $props();

  async function handleDelete(e: MouseEvent, id: string) {
    e.stopPropagation();
    await deleteSignature(id);
    appState.removeSavedSignature(id);
    // Note: placed signatures still have their own dataUrl copy,
    // so they remain visible even after the saved signature is deleted.
  }
</script>

{#if appState.savedSignatures.length > 0}
  <div class="border-t border-border pt-4 mt-2">
    <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Saved Signatures</p>
    <div class="flex gap-3 overflow-x-auto pb-2 pt-3 px-1">
      {#each appState.savedSignatures as sig (sig.id)}
        <div class="relative shrink-0 group">
          <button
            class="p-3 border border-border rounded-xl hover:border-accent transition-colors cursor-pointer bg-white"
            onclick={() => onselect(sig.id)}
            title="Use {sig.name}"
          >
            <img src={sig.dataUrl} alt={sig.name} class="h-12 max-w-[120px] object-contain" />
          </button>
          <!-- Delete on hover -->
          <button
            class="absolute -top-2.5 -right-2.5 w-6 h-6 bg-danger text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-danger-hover"
            onclick={(e) => handleDelete(e, sig.id)}
            title="Delete saved signature"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}
