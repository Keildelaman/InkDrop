<script lang="ts">
  import { fileToDataUrl, removeBackground } from '../../lib/image-utils';
  import Button from '../ui/Button.svelte';

  interface Props {
    onconfirm: (dataUrl: string) => void;
  }

  let { onconfirm }: Props = $props();

  let preview = $state('');
  let originalDataUrl = $state('');
  let bgRemoved = $state(false);
  let isDragging = $state(false);
  let fileInput: HTMLInputElement;

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    originalDataUrl = await fileToDataUrl(file);
    preview = originalDataUrl;
    bgRemoved = false;
  }

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

  async function toggleBgRemoval() {
    if (!originalDataUrl) return;
    if (bgRemoved) {
      preview = originalDataUrl;
      bgRemoved = false;
    } else {
      preview = await removeBackground(originalDataUrl);
      bgRemoved = true;
    }
  }

  function handleConfirm() {
    if (!preview) return;
    onconfirm(preview);
  }

  function reset() {
    preview = '';
    originalDataUrl = '';
    bgRemoved = false;
  }
</script>

<div class="flex flex-col gap-4">
  {#if !preview}
    <button
      class="h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer
        {isDragging ? 'border-accent bg-accent-light' : 'border-border hover:border-accent'}"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={() => fileInput.click()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-text-muted">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <p class="text-sm text-text-muted">Drop signature image or click to browse</p>
      <p class="text-xs text-text-muted">PNG, JPG</p>
    </button>
  {:else}
    <div class="flex flex-col items-center gap-3">
      <div class="p-4 bg-white rounded-xl border border-border max-h-40 flex items-center justify-center" style="background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22><rect width=%228%22 height=%228%22 fill=%22%23f0f0f0%22/><rect x=%228%22 y=%228%22 width=%228%22 height=%228%22 fill=%22%23f0f0f0%22/></svg>'); background-size: 16px 16px;">
        <img src={preview} alt="Signature preview" class="max-h-32 max-w-full object-contain" />
      </div>

      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={bgRemoved} onchange={toggleBgRemoval} class="accent-accent" />
          Remove background
        </label>
        <Button variant="ghost" size="sm" onclick={reset}>Change image</Button>
      </div>
    </div>

    <Button variant="primary" onclick={handleConfirm}>
      Use This Signature
    </Button>
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    accept="image/png,image/jpeg,image/jpg"
    class="hidden"
    onchange={handleFileSelect}
  />
</div>
