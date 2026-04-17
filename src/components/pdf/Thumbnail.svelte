<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { renderThumbnail } from '../../lib/pdf/renderer';

  interface Props {
    pageIndex: number;
  }

  let { pageIndex }: Props = $props();
  let canvas: HTMLCanvasElement;
  let rendered = false;

  const isActive = $derived(appState.currentPageIndex === pageIndex);

  $effect(() => {
    if (canvas && !rendered) {
      rendered = true;
      renderThumbnail(pageIndex, canvas, 140).catch(() => {});
    }
  });

  function handleClick() {
    appState.setCurrentPage(pageIndex);
  }
</script>

<button
  class="flex flex-col items-center gap-1 p-2 rounded-lg transition-all cursor-pointer hover:bg-surface-alt
    {isActive ? 'ring-2 ring-accent bg-accent-light' : ''}"
  onclick={handleClick}
  title="Page {pageIndex + 1}"
>
  <canvas
    bind:this={canvas}
    class="rounded-sm shadow-sm bg-white"
    style="max-width: 140px;"
  ></canvas>
  <span class="text-xs text-text-muted">{pageIndex + 1}</span>
</button>
