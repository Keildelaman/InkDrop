import type { AppPhase, AppTool, PageInfo, SignaturePlacement, SavedSignature } from '../types';
import { effectiveDimensions } from '../lib/geometry';

function createAppState() {
  let selectedTool = $state<AppTool>('home');
  let phase = $state<AppPhase>('empty');
  let pdfBytes = $state<Uint8Array | null>(null);
  let pdfName = $state('');
  let pages = $state<PageInfo[]>([]);
  let currentPageIndex = $state(0);
  let placements = $state<SignaturePlacement[]>([]);
  let savedSignatures = $state<SavedSignature[]>([]);
  let selectedPlacementId = $state<string | null>(null);
  let zoom = $state(1.0);
  let isDark = $state(localStorage.getItem('inkdrop-theme') === 'dark');
  let signatureModalOpen = $state(false);

  // Undo/redo
  let history = $state<string[]>([]);
  let historyIndex = $state(-1);

  const currentPage = $derived(pages[currentPageIndex]);
  const currentPagePlacements = $derived(
    placements.filter((p) => p.pageIndex === currentPageIndex)
  );
  const hasUnsavedWork = $derived(placements.length > 0);

  function snapshot() {
    const snap = JSON.stringify(placements);
    history = [...history.slice(0, historyIndex + 1), snap];
    historyIndex = history.length - 1;
  }

  function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem('inkdrop-theme', isDark ? 'dark' : 'light');
  }

  function setPhase(p: AppPhase) {
    phase = p;
  }

  function setSelectedTool(tool: AppTool) {
    selectedTool = tool;
  }

  function setPdf(bytes: Uint8Array, name: string, pageInfos: PageInfo[]) {
    pdfBytes = bytes;
    pdfName = name;
    pages = pageInfos;
    currentPageIndex = 0;
    placements = [];
    selectedPlacementId = null;
    history = [];
    historyIndex = -1;
    phase = 'editing';
  }

  function setCurrentPage(index: number) {
    if (index >= 0 && index < pages.length) {
      currentPageIndex = index;
      selectedPlacementId = null;
    }
  }

  function setZoom(z: number) {
    zoom = Math.max(0.25, Math.min(4, z));
  }

  function addPlacement(signatureId: string, dataUrl: string, imgWidth: number, imgHeight: number) {
    const page = pages[currentPageIndex];
    if (!page) return;

    const [effW, effH] = effectiveDimensions(page);
    const sigWidth = effW * 0.25;
    const sigHeight = sigWidth * (imgHeight / imgWidth);

    snapshot();
    placements = [
      ...placements,
      {
        id: crypto.randomUUID(),
        signatureId,
        dataUrl,
        pageIndex: currentPageIndex,
        x: (effW - sigWidth) / 2,
        y: (effH - sigHeight) / 2,
        width: sigWidth,
        height: sigHeight,
      },
    ];
    selectedPlacementId = placements[placements.length - 1].id;
  }

  function updatePlacement(id: string, update: Partial<SignaturePlacement>) {
    const idx = placements.findIndex((p) => p.id === id);
    if (idx !== -1) {
      placements = placements.map((p, i) =>
        i === idx ? { ...p, ...update } : p
      );
    }
  }

  function removePlacement(id: string) {
    snapshot();
    placements = placements.filter((p) => p.id !== id);
    if (selectedPlacementId === id) selectedPlacementId = null;
  }

  function selectPlacement(id: string | null) {
    selectedPlacementId = id;
  }

  function undo() {
    if (historyIndex < 0) return;
    placements = JSON.parse(history[historyIndex]);
    historyIndex--;
    selectedPlacementId = null;
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    placements = JSON.parse(history[historyIndex]);
    selectedPlacementId = null;
  }

  function openSignatureModal() {
    signatureModalOpen = true;
  }

  function closeSignatureModal() {
    signatureModalOpen = false;
  }

  function setSavedSignatures(sigs: SavedSignature[]) {
    savedSignatures = sigs;
  }

  function addSavedSignature(sig: SavedSignature) {
    savedSignatures = [...savedSignatures, sig];
  }

  function removeSavedSignature(id: string) {
    savedSignatures = savedSignatures.filter((s) => s.id !== id);
  }

  function resetPdf() {
    phase = 'empty';
    pdfBytes = null;
    pdfName = '';
    pages = [];
    currentPageIndex = 0;
    placements = [];
    selectedPlacementId = null;
    history = [];
    historyIndex = -1;
  }

  return {
    get selectedTool() { return selectedTool; },
    get phase() { return phase; },
    get pdfBytes() { return pdfBytes; },
    get pdfName() { return pdfName; },
    get pages() { return pages; },
    get currentPageIndex() { return currentPageIndex; },
    get placements() { return placements; },
    get savedSignatures() { return savedSignatures; },
    get selectedPlacementId() { return selectedPlacementId; },
    get zoom() { return zoom; },
    get isDark() { return isDark; },
    get signatureModalOpen() { return signatureModalOpen; },
    get currentPage() { return currentPage; },
    get currentPagePlacements() { return currentPagePlacements; },
    get hasUnsavedWork() { return hasUnsavedWork; },
    get historyIndex() { return historyIndex; },
    get historyLength() { return history.length; },
    toggleTheme,
    setPhase,
    setSelectedTool,
    setPdf,
    setCurrentPage,
    setZoom,
    addPlacement,
    updatePlacement,
    removePlacement,
    selectPlacement,
    undo,
    redo,
    openSignatureModal,
    closeSignatureModal,
    setSavedSignatures,
    addSavedSignature,
    removeSavedSignature,
    resetPdf,
  };
}

export { effectiveDimensions };
export const appState = createAppState();
