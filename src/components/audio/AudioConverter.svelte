<script lang="ts">
  import {
    convertAudio,
    isSupportedM4aFile,
    MP3_BITRATE_OPTIONS,
    type AudioOutputFormat,
    type Mp3Bitrate,
  } from '../../lib/audio/converter';
  import { toastState } from '../../lib/toast.svelte';
  import Button from '../ui/Button.svelte';

  interface Props {
    onback: () => void;
  }

  let { onback }: Props = $props();

  let fileInput: HTMLInputElement;
  let file = $state<File | null>(null);
  let isDragging = $state(false);
  let isConverting = $state(false);
  let outputFormat = $state<AudioOutputFormat>('mp3');
  let mp3Bitrate = $state<Mp3Bitrate>(192);
  let status = $state('');
  let error = $state('');
  let progress = $state(0);
  let downloadUrl = $state<string | null>(null);
  let downloadName = $state('');
  let downloadSize = $state(0);

  const bitrateLabels: Record<Mp3Bitrate, string> = {
    128: '128 kbps - smaller',
    192: '192 kbps - balanced',
    320: '320 kbps - larger',
  };

  $effect(() => {
    const url = downloadUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!isConverting) isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (isConverting) return;

    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    if (files.length > 1) {
      toastState.info('Batch conversion is not supported yet. Using the first file.');
    }
    selectFile(files[0]);
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (selected) selectFile(selected);
    input.value = '';
  }

  function selectFile(selected: File) {
    clearDownload();
    error = '';
    status = '';
    progress = 0;

    if (!isSupportedM4aFile(selected)) {
      file = null;
      error = 'Please select an M4A file.';
      return;
    }

    file = selected;
    status = 'Ready to convert.';
  }

  async function handleConvert() {
    if (!file || isConverting) return;

    clearDownload();
    error = '';
    isConverting = true;
    progress = 0;
    status = 'Starting conversion...';

    try {
      const result = await convertAudio(file, {
        outputFormat,
        mp3Bitrate,
        onStatus: (message) => {
          status = message;
        },
        onProgress: (update) => {
          progress = update.ratio;
          status = update.label;
        },
      });

      const blob = new Blob([result.bytes as BlobPart], { type: result.mimeType });
      downloadUrl = URL.createObjectURL(blob);
      downloadName = result.fileName;
      downloadSize = blob.size;
      progress = 1;
      status = 'Ready to download.';
      toastState.success('Audio converted successfully.');
    } catch (err) {
      console.error('Audio conversion failed:', err);
      error = getConversionErrorMessage(err);
      status = '';
      progress = 0;
      toastState.error('Audio conversion failed.');
    } finally {
      isConverting = false;
    }
  }

  function clearDownload() {
    downloadUrl = null;
    downloadName = '';
    downloadSize = 0;
  }

  function reset() {
    if (isConverting) return;
    file = null;
    error = '';
    status = '';
    progress = 0;
    clearDownload();
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getConversionErrorMessage(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('failed to import ffmpeg-core.js')) {
      return 'Conversion failed because the local converter engine could not load.';
    }
    if (message.includes('FFmpeg exited with code')) {
      return 'Conversion failed because FFmpeg could not decode or encode this file.';
    }
    if (message.includes('memory') || message.includes('Array buffer allocation failed')) {
      return 'Conversion failed because the browser ran out of memory.';
    }
    return `Conversion failed: ${message}`;
  }
</script>

<div class="flex-1 overflow-auto bg-surface">
  <div class="min-h-full w-full max-w-4xl mx-auto px-6 py-6 md:py-8 flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3">
      <Button variant="ghost" onclick={onback} disabled={isConverting}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
        All tools
      </Button>
      <p class="text-xs text-text-muted text-right">
        Files stay in this browser.
      </p>
    </div>

    <section class="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
      <div class="flex flex-col gap-4">
        <button
          class="w-full min-h-[18rem] rounded-lg border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer bg-surface-elevated
            {isDragging
              ? 'border-accent bg-accent-light scale-[1.01]'
              : 'border-border hover:border-accent hover:bg-accent-light/30'}"
          disabled={isConverting}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          onclick={() => fileInput.click()}
        >
          <span class="h-14 w-14 rounded-lg bg-accent-light text-accent flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </span>
          <span class="text-center px-4">
            <span class="block text-lg font-medium">
              {file ? file.name : 'Drop an M4A file here'}
            </span>
            <span class="block text-sm text-text-muted mt-1">
              {file ? formatBytes(file.size) : 'or click to browse'}
            </span>
          </span>
          {#if error}
            <span class="text-sm text-danger px-4 text-center">{error}</span>
          {/if}
        </button>

        {#if status || isConverting}
          <div class="rounded-lg border border-border bg-surface-elevated p-4">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium">{status || 'Working...'}</span>
              {#if isConverting}
                <span class="text-text-muted">{Math.round(progress * 100)}%</span>
              {/if}
            </div>
            <div class="mt-3 h-2 rounded-full bg-surface-alt overflow-hidden border border-border">
              <div
                class="h-full bg-accent transition-all duration-200"
                style={`width: ${Math.round(progress * 100)}%`}
              ></div>
            </div>
          </div>
        {/if}

        {#if downloadUrl}
          <div class="rounded-lg border border-border bg-surface-elevated p-4 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
            <div>
              <p class="font-medium">{downloadName}</p>
              <p class="text-sm text-text-muted mt-1">{formatBytes(downloadSize)}</p>
            </div>
            <a
              class="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer bg-accent text-white hover:bg-accent-hover active:scale-[0.97] shadow-sm px-4 py-2 text-sm"
              href={downloadUrl}
              download={downloadName}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-border bg-surface-elevated p-4 flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium mb-2" for="output-format">Output</label>
          <select
            id="output-format"
            class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            bind:value={outputFormat}
            disabled={isConverting}
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
          </select>
        </div>

        {#if outputFormat === 'mp3'}
          <div>
            <label class="block text-sm font-medium mb-2" for="mp3-quality">Quality</label>
            <select
              id="mp3-quality"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              bind:value={mp3Bitrate}
              disabled={isConverting}
            >
              {#each MP3_BITRATE_OPTIONS as bitrate}
                <option value={bitrate}>{bitrateLabels[bitrate]}</option>
              {/each}
            </select>
            <p class="text-xs text-text-muted mt-2">
              192 kbps is a good default. Higher quality makes a larger file.
            </p>
          </div>
        {:else}
          <p class="text-sm text-text-muted">
            WAV is uncompressed, so it is usually much larger than MP3.
          </p>
        {/if}

        <div class="flex flex-col gap-2 pt-2">
          <Button variant="primary" onclick={handleConvert} disabled={!file || isConverting}>
            {#if isConverting}
              Converting...
            {:else}
              Convert
            {/if}
          </Button>
          <Button variant="ghost" onclick={reset} disabled={isConverting || (!file && !downloadUrl)}>
            Reset
          </Button>
        </div>

        <p class="text-xs text-text-muted border-t border-border pt-4">
          Audio conversion uses FFmpeg through ffmpeg.wasm.
          <a class="text-accent hover:underline" href="https://ffmpeg.org/legal.html" target="_blank" rel="noreferrer">License info</a>
        </p>
      </div>
    </section>

    <input
      bind:this={fileInput}
      type="file"
      accept=".m4a,audio/mp4,audio/x-m4a"
      class="hidden"
      onchange={handleFileSelect}
    />
  </div>
</div>
