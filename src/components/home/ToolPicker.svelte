<script lang="ts">
  import type { AppTool } from '../../types';

  interface Props {
    onselect: (tool: AppTool) => void;
  }

  let { onselect }: Props = $props();
</script>

<div class="flex-1 overflow-auto bg-surface">
  <div class="min-h-full w-full max-w-5xl mx-auto px-6 py-8 md:py-12 flex flex-col justify-center">
    <div class="mb-8">
      <p class="text-sm font-medium text-accent">InkDrop tools</p>
      <h2 class="text-3xl md:text-4xl font-semibold tracking-tight mt-2">Private file tools</h2>
      <p class="text-text-muted mt-3 max-w-2xl">
        Work with everyday files directly in your browser.
      </p>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <button
        class="text-left rounded-lg border border-border bg-surface-elevated hover:border-accent hover:bg-accent-light/30 transition-all duration-150 p-6 min-h-[13rem] flex flex-col justify-between cursor-pointer"
        onclick={() => onselect('pdf-sign')}
      >
        <span class="h-12 w-12 rounded-lg bg-accent-light text-accent flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M8 17c1.5-2 2.8-2 4 0 1-1.3 2.3-1.3 4 0"/>
          </svg>
        </span>

        <span>
          <span class="block text-xl font-semibold">Sign PDF</span>
          <span class="block text-sm text-text-muted mt-2">
            Add drawn, typed, or uploaded signatures to a PDF.
          </span>
        </span>
      </button>

      <button
        class="text-left rounded-lg border border-border bg-surface-elevated hover:border-accent hover:bg-accent-light/30 transition-all duration-150 p-6 min-h-[13rem] flex flex-col justify-between cursor-pointer"
        onclick={() => onselect('audio-convert')}
      >
        <span class="h-12 w-12 rounded-lg bg-accent-light text-accent flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </span>

        <span>
          <span class="block text-xl font-semibold">Convert Audio</span>
          <span class="block text-sm text-text-muted mt-2">
            Convert one M4A file to MP3 or WAV.
          </span>
        </span>
      </button>
    </div>
  </div>
</div>
