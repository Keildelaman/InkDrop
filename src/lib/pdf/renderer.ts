import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageInfo } from '../../types';

// Initialize pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

let currentDoc: PDFDocumentProxy | null = null;

export async function loadPdfDocument(bytes: Uint8Array): Promise<PageInfo[]> {
  // Destroy previous document to prevent memory leaks
  if (currentDoc) {
    await currentDoc.destroy();
    currentDoc = null;
  }

  // Copy bytes so pdf.js doesn't detach the buffer
  const data = new Uint8Array(bytes);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  currentDoc = doc;

  const pages: PageInfo[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      index: i - 1,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate,
    });
  }

  return pages;
}

let currentRenderTask: { cancel: () => void } | null = null;

export async function renderPage(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<void> {
  if (!currentDoc) throw new Error('No PDF loaded');

  // Cancel any in-progress render
  if (currentRenderTask) {
    try {
      currentRenderTask.cancel();
    } catch (_) {
      // ignore
    }
    currentRenderTask = null;
  }

  const page = await currentDoc.getPage(pageIndex + 1);
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * dpr });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width / dpr}px`;
  canvas.style.height = `${viewport.height / dpr}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  const renderTask = page.render({
    canvasContext: ctx,
    canvas: null,
    viewport,
  });
  currentRenderTask = renderTask;

  try {
    await renderTask.promise;
  } catch (err: any) {
    if (err?.name === 'RenderingCancelledException') {
      return; // Expected when switching pages quickly
    }
    throw err;
  } finally {
    currentRenderTask = null;
  }
}

export async function renderThumbnail(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  maxWidth: number = 150
): Promise<void> {
  if (!currentDoc) return;

  const page = await currentDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const thumbViewport = page.getViewport({ scale });

  canvas.width = thumbViewport.width;
  canvas.height = thumbViewport.height;
  canvas.style.width = `${thumbViewport.width}px`;
  canvas.style.height = `${thumbViewport.height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await page.render({
    canvasContext: ctx,
    canvas: null,
    viewport: thumbViewport,
  }).promise;
}

export function getDocument(): PDFDocumentProxy | null {
  return currentDoc;
}
