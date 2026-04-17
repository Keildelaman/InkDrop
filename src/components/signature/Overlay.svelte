<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { pdfToScreen, screenDeltaToPdf } from '../../lib/geometry';
  import type { SignaturePlacement } from '../../types';

  interface Props {
    placement: SignaturePlacement;
    canvasDisplayWidth: number;
    canvasDisplayHeight: number;
  }

  let { placement, canvasDisplayWidth, canvasDisplayHeight }: Props = $props();

  let isDragging = $state(false);
  let isResizing = $state(false);

  const isSelected = $derived(appState.selectedPlacementId === placement.id);
  const page = $derived(appState.currentPage);

  // Use dataUrl directly from placement (independent of saved signatures)
  const sigDataUrl = $derived(placement.dataUrl);

  // Convert PDF coords to screen position
  const screenPos = $derived.by(() => {
    if (!page || canvasDisplayWidth === 0) return { screenX: 0, screenY: 0, scaleX: 1, scaleY: 1 };
    return pdfToScreen(
      placement.x,
      placement.y,
      placement.width,
      placement.height,
      canvasDisplayWidth,
      canvasDisplayHeight,
      page
    );
  });

  const screenWidth = $derived(screenPos.scaleX * placement.width);
  const screenHeight = $derived(screenPos.scaleY * placement.height);

  function handlePointerDown(e: PointerEvent) {
    // Don't start drag if clicking the delete button
    const target = e.target as HTMLElement;
    if (target.closest('[data-delete]')) return;

    e.stopPropagation();
    e.preventDefault();
    appState.selectPlacement(placement.id);

    const handle = target.dataset.handle;
    if (handle) {
      startResize(e, handle);
    } else {
      startDrag(e);
    }
  }

  function startDrag(e: PointerEvent) {
    isDragging = true;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    let lastX = e.clientX;
    let lastY = e.clientY;

    function onMove(ev: PointerEvent) {
      if (!page) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      const { pdfDX, pdfDY } = screenDeltaToPdf(dx, dy, canvasDisplayWidth, canvasDisplayHeight, page);
      appState.updatePlacement(placement.id, {
        x: placement.x + pdfDX,
        y: placement.y + pdfDY,
      });
      lastX = ev.clientX;
      lastY = ev.clientY;
    }

    function onUp() {
      isDragging = false;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  function startResize(e: PointerEvent, corner: string) {
    isResizing = true;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    // Record the starting state
    const startX = placement.x;
    const startY = placement.y;
    const startW = placement.width;
    const startH = placement.height;
    const aspectRatio = startW / startH;

    // Anchor is the corner opposite to the one being dragged (in PDF space)
    // PDF space: (x, y) is bottom-left of the rect
    // "se" handle = bottom-right visually in screen = bottom-right in PDF...
    // Actually: screen top-left = PDF top-left (after flip), so:
    //   nw (screen top-left) = top-left in PDF = (x, y + h)
    //   ne (screen top-right) = top-right in PDF = (x + w, y + h)
    //   sw (screen bottom-left) = bottom-left in PDF = (x, y)
    //   se (screen bottom-right) = bottom-right in PDF = (x + w, y)
    let anchorPdfX: number;
    let anchorPdfY: number;

    if (corner === 'se') { anchorPdfX = startX; anchorPdfY = startY + startH; }
    else if (corner === 'sw') { anchorPdfX = startX + startW; anchorPdfY = startY + startH; }
    else if (corner === 'ne') { anchorPdfX = startX; anchorPdfY = startY; }
    else /* nw */ { anchorPdfX = startX + startW; anchorPdfY = startY; }

    let accumDx = 0;
    let accumDy = 0;

    function onMove(ev: PointerEvent) {
      if (!page) return;
      accumDx += ev.movementX;
      accumDy += ev.movementY;

      const { pdfDX, pdfDY } = screenDeltaToPdf(accumDx, accumDy, canvasDisplayWidth, canvasDisplayHeight, page);

      // Compute the dragged corner's new PDF position
      let dragPdfX: number;
      let dragPdfY: number;

      if (corner === 'se') {
        dragPdfX = startX + startW + pdfDX;
        dragPdfY = startY + pdfDY; // pdfDY is negative when dragging down in screen
      } else if (corner === 'sw') {
        dragPdfX = startX + pdfDX;
        dragPdfY = startY + pdfDY;
      } else if (corner === 'ne') {
        dragPdfX = startX + startW + pdfDX;
        dragPdfY = startY + startH + pdfDY;
      } else /* nw */ {
        dragPdfX = startX + pdfDX;
        dragPdfY = startY + startH + pdfDY;
      }

      // Compute new width/height from anchor and dragged corner
      let newW = Math.abs(dragPdfX - anchorPdfX);
      let newH = Math.abs(dragPdfY - anchorPdfY);

      // Maintain aspect ratio (unless Shift held)
      if (!ev.shiftKey) {
        // Use the larger dimension change to drive the other
        const wRatio = newW / startW;
        const hRatio = newH / startH;
        if (wRatio > hRatio) {
          newH = newW / aspectRatio;
        } else {
          newW = newH * aspectRatio;
        }
      }

      // Minimum size
      if (newW < 10 || newH < 10) return;

      // Compute new x, y from anchor (anchor stays fixed, rect extends from it)
      let newX: number;
      let newY: number;

      if (corner === 'se') {
        // Anchor is top-left (PDF: x, y+h). New bottom-left x = anchor x, y = anchor y - h
        newX = anchorPdfX;
        newY = anchorPdfY - newH;
      } else if (corner === 'sw') {
        // Anchor is top-right. New x = anchor x - w, y = anchor y - h
        newX = anchorPdfX - newW;
        newY = anchorPdfY - newH;
      } else if (corner === 'ne') {
        // Anchor is bottom-left. New x = anchor x, y = anchor y
        newX = anchorPdfX;
        newY = anchorPdfY;
      } else /* nw */ {
        // Anchor is bottom-right. New x = anchor x - w, y = anchor y
        newX = anchorPdfX - newW;
        newY = anchorPdfY;
      }

      appState.updatePlacement(placement.id, {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
    }

    function onUp() {
      isResizing = false;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    appState.removePlacement(placement.id);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute select-none"
  style="
    left: {screenPos.screenX}px;
    top: {screenPos.screenY}px;
    width: {screenWidth}px;
    height: {screenHeight}px;
    touch-action: none;
    cursor: {isDragging ? 'grabbing' : 'grab'};
  "
  onpointerdown={handlePointerDown}
>
  {#if sigDataUrl}
    <img
      src={sigDataUrl}
      alt="Signature"
      class="w-full h-full object-contain pointer-events-none"
      draggable="false"
    />
  {/if}

  {#if isSelected}
    <!-- Selection border -->
    <div class="absolute inset-0 border-2 border-accent border-dashed rounded-sm pointer-events-none"></div>

    <!-- Delete button -->
    <button
      data-delete
      class="absolute -top-3 -right-3 w-6 h-6 bg-danger text-white rounded-full flex items-center justify-center shadow-md hover:bg-danger-hover transition-colors cursor-pointer z-10"
      onclick={handleDelete}
      onpointerdown={(e) => e.stopPropagation()}
      title="Remove signature"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- Resize handles -->
    <div data-handle="nw" class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-accent rounded-full cursor-nw-resize shadow-sm"></div>
    <div data-handle="ne" class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-accent rounded-full cursor-ne-resize shadow-sm"></div>
    <div data-handle="sw" class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-accent rounded-full cursor-sw-resize shadow-sm"></div>
    <div data-handle="se" class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-accent rounded-full cursor-se-resize shadow-sm"></div>
  {/if}
</div>
