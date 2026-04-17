<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { renderPage } from '../../lib/pdf/renderer';
  import SignatureOverlay from '../signature/Overlay.svelte';

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let canvasDisplayWidth = $state(0);
  let canvasDisplayHeight = $state(0);

  // Queue-based rendering to avoid skipping renders
  let renderQueued = false;
  let renderInProgress = false;
  let renderGeneration = 0;

  async function doRender() {
    if (!canvas) return;

    // If already rendering, queue another render for when it finishes
    if (renderInProgress) {
      renderQueued = true;
      return;
    }

    renderInProgress = true;
    renderQueued = false;
    const gen = ++renderGeneration;

    try {
      await renderPage(appState.currentPageIndex, canvas, appState.zoom);
      if (gen === renderGeneration) {
        canvasDisplayWidth = parseFloat(canvas.style.width);
        canvasDisplayHeight = parseFloat(canvas.style.height);
      }
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      renderInProgress = false;
      // If a render was queued while we were busy, run it now
      if (renderQueued) {
        doRender();
      }
    }
  }

  // Re-render when page or zoom changes
  $effect(() => {
    // Touch reactive deps
    const _page = appState.currentPageIndex;
    const _zoom = appState.zoom;
    const _pages = appState.pages;
    const _canvas = canvas;

    if (_canvas && _pages.length > 0) {
      // Use tick to ensure DOM is ready
      doRender();
    }
  });

  function handleCanvasClick(e: MouseEvent) {
    if (e.target === canvas) {
      appState.selectPlacement(null);
    }
  }
</script>

<div
  bind:this={container}
  class="flex-1 flex items-center justify-center overflow-auto bg-surface-alt p-4"
  onclick={handleCanvasClick}
  role="presentation"
>
  <div class="relative inline-block shadow-xl rounded-sm">
    <canvas bind:this={canvas} class="block"></canvas>
    {#each appState.currentPagePlacements as placement (placement.id)}
      <SignatureOverlay
        {placement}
        {canvasDisplayWidth}
        {canvasDisplayHeight}
      />
    {/each}
  </div>
</div>
