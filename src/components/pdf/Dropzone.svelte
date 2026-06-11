<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { loadPdfDocument } from '../../lib/pdf/renderer';
  import Button from '../ui/Button.svelte';

  interface Props {
    onback?: () => void;
  }

  let { onback }: Props = $props();

  let isDragging = $state(false);
  let fileInput: HTMLInputElement;
  let error = $state('');

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) await processFile(file);
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await processFile(file);
  }

  async function processFile(file: File) {
    error = '';
    if (file.type !== 'application/pdf') {
      error = 'Please select a PDF file.';
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageInfos = await loadPdfDocument(bytes);
      appState.setPdf(bytes, file.name, pageInfos);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      error = 'Failed to load PDF. The file may be corrupted or password-protected.';
    }
  }
</script>

<div class="flex-1 flex flex-col p-8 overflow-hidden">
  {#if onback}
    <div class="shrink-0">
      <Button variant="ghost" onclick={onback}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
        All tools
      </Button>
    </div>
  {/if}

  <div class="flex-1 flex items-center justify-center">
    <button
      class="w-full max-w-xl aspect-[4/3] rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer
        {isDragging
          ? 'border-accent bg-accent-light scale-[1.02]'
          : 'border-border hover:border-accent hover:bg-accent-light/30'}"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={() => fileInput.click()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="12" y2="12"/>
        <line x1="15" y1="15" x2="12" y2="12"/>
      </svg>
      <div class="text-center">
        <p class="text-lg font-medium">Drop a PDF here</p>
        <p class="text-sm text-text-muted mt-1">or click to browse</p>
      </div>
      {#if error}
        <p class="text-sm text-danger">{error}</p>
      {/if}
    </button>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept=".pdf,application/pdf"
    class="hidden"
    onchange={handleFileSelect}
  />
</div>
