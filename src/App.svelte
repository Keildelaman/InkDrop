<script lang="ts">
  import { appState } from './state/app.svelte';
  import { loadSignatures } from './lib/signature/store';
  import Header from './components/layout/Header.svelte';
  import Sidebar from './components/layout/Sidebar.svelte';
  import Toolbar from './components/layout/Toolbar.svelte';
  import Dropzone from './components/pdf/Dropzone.svelte';
  import Viewer from './components/pdf/Viewer.svelte';
  import SignatureModal from './components/signature/Modal.svelte';
  import Toast from './components/ui/Toast.svelte';

  // Load saved signatures on startup
  $effect(() => {
    loadSignatures().then((sigs) => {
      appState.setSavedSignatures(sigs);
    });
  });

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (appState.phase !== 'editing') return;
    if (appState.signatureModalOpen) return;

    // Ctrl+Z / Cmd+Z = undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      appState.undo();
    }
    // Ctrl+Shift+Z / Cmd+Shift+Z = redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      appState.redo();
    }
    // Delete / Backspace = remove selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && appState.selectedPlacementId) {
      e.preventDefault();
      appState.removePlacement(appState.selectedPlacementId);
    }
    // Arrow keys = page navigation
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (!isInputFocused()) {
        e.preventDefault();
        appState.setCurrentPage(appState.currentPageIndex - 1);
      }
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (!isInputFocused()) {
        e.preventDefault();
        appState.setCurrentPage(appState.currentPageIndex + 1);
      }
    }
  }

  function isInputFocused(): boolean {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  }

  // Warn before leaving with unsaved work
  $effect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (appState.hasUnsavedWork) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class={appState.isDark ? 'dark' : ''}>
  <div class="h-screen flex flex-col bg-surface text-text">
    <Header />
    <main class="flex-1 flex overflow-hidden">
      {#if appState.phase === 'empty'}
        <Dropzone />
      {:else}
        <Sidebar />
        <div class="flex-1 flex flex-col overflow-hidden">
          <Viewer />
          <Toolbar />
        </div>
      {/if}
    </main>
  </div>

  <SignatureModal />
  <Toast />
</div>
