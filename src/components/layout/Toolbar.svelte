<script lang="ts">
  import { appState } from '../../state/app.svelte';
  import { exportPdf } from '../../lib/pdf/exporter';
  import { toastState } from '../../lib/toast.svelte';
  import Button from '../ui/Button.svelte';

  interface Props {
    onback?: () => void;
  }

  let { onback }: Props = $props();

  function prevPage() {
    appState.setCurrentPage(appState.currentPageIndex - 1);
  }

  function nextPage() {
    appState.setCurrentPage(appState.currentPageIndex + 1);
  }

  function zoomIn() {
    appState.setZoom(appState.zoom + 0.25);
  }

  function zoomOut() {
    appState.setZoom(appState.zoom - 0.25);
  }

  async function handleExport() {
    if (!appState.pdfBytes) return;
    if (appState.placements.length === 0) {
      toastState.info('No signatures placed yet.');
      return;
    }

    appState.setPhase('exporting');
    try {
      const result = await exportPdf(appState.pdfBytes, appState.placements, appState.pages);

      // Trigger download
      const blob = new Blob([result as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = appState.pdfName.replace(/\.pdf$/i, '');
      a.href = url;
      a.download = `${baseName}_signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toastState.success('PDF exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      toastState.error('Export failed. Please try again.');
    } finally {
      appState.setPhase('editing');
    }
  }

  function handleNewPdf() {
    if (appState.hasUnsavedWork && !confirm('You have placed signatures. Discard and load a new PDF?')) {
      return;
    }
    appState.resetPdf();
  }

  function handleBackToTools() {
    if (!onback) return;
    if (appState.hasUnsavedWork && !confirm('You have placed signatures. Return to all tools and keep this PDF open?')) {
      return;
    }
    onback();
  }
</script>

<div class="h-14 shrink-0 border-t border-border bg-surface-elevated flex items-center justify-between px-4 gap-2">
  <!-- Left: Add signature + New PDF -->
  <div class="flex items-center gap-2">
    {#if onback}
      <Button variant="ghost" onclick={handleBackToTools} title="All tools">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
        <span class="max-sm:hidden">Tools</span>
      </Button>
    {/if}

    <Button variant="primary" onclick={() => appState.openSignatureModal()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="max-sm:hidden">Add Signature</span>
    </Button>

    <Button variant="ghost" onclick={handleNewPdf} title="Load new PDF">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="12" y2="12"/>
        <line x1="15" y1="15" x2="12" y2="12"/>
      </svg>
    </Button>
  </div>

  <!-- Center: Zoom + Page nav -->
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-1">
      <Button variant="ghost" size="sm" onclick={zoomOut} title="Zoom out" disabled={appState.zoom <= 0.25}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </Button>
      <span class="text-xs text-text-muted w-12 text-center">{Math.round(appState.zoom * 100)}%</span>
      <Button variant="ghost" size="sm" onclick={zoomIn} title="Zoom in" disabled={appState.zoom >= 4}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </Button>
    </div>

    <div class="h-5 w-px bg-border"></div>

    <div class="flex items-center gap-1">
      <Button variant="ghost" size="sm" onclick={prevPage} disabled={appState.currentPageIndex <= 0} title="Previous page">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </Button>
      <span class="text-xs text-text-muted min-w-[4rem] text-center">
        {appState.currentPageIndex + 1} / {appState.pages.length}
      </span>
      <Button variant="ghost" size="sm" onclick={nextPage} disabled={appState.currentPageIndex >= appState.pages.length - 1} title="Next page">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </Button>
    </div>
  </div>

  <!-- Right: Export -->
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="sm" onclick={() => appState.undo()} disabled={appState.historyIndex < 0} title="Undo (Ctrl+Z)">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
    </Button>
    <Button variant="secondary" onclick={handleExport} disabled={appState.phase === 'exporting'}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span class="max-sm:hidden">Export PDF</span>
    </Button>
  </div>
</div>
