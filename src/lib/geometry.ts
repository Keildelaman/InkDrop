import type { PageInfo } from '../types';

export function effectiveDimensions(page: PageInfo): [number, number] {
  if (page.rotation === 90 || page.rotation === 270) {
    return [page.height, page.width];
  }
  return [page.width, page.height];
}

/**
 * Convert PDF-space coordinates to screen-relative coordinates (for positioning HTML overlays).
 * PDF origin is bottom-left; screen origin is top-left.
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  pdfWidth: number,
  pdfHeight: number,
  canvasDisplayWidth: number,
  canvasDisplayHeight: number,
  page: PageInfo
): { screenX: number; screenY: number; scaleX: number; scaleY: number } {
  const [effW, effH] = effectiveDimensions(page);
  const scaleX = canvasDisplayWidth / effW;
  const scaleY = canvasDisplayHeight / effH;

  const screenX = pdfX * scaleX;
  const screenY = (effH - pdfY - pdfHeight) * scaleY;

  return { screenX, screenY, scaleX, scaleY };
}

/**
 * Convert a screen-space delta (pixels) to PDF-space delta (points).
 */
export function screenDeltaToPdf(
  deltaX: number,
  deltaY: number,
  canvasDisplayWidth: number,
  canvasDisplayHeight: number,
  page: PageInfo
): { pdfDX: number; pdfDY: number } {
  const [effW, effH] = effectiveDimensions(page);
  const pdfDX = (deltaX / canvasDisplayWidth) * effW;
  const pdfDY = -(deltaY / canvasDisplayHeight) * effH; // flip Y
  return { pdfDX, pdfDY };
}

/**
 * Convert a screen-space size (pixels) to PDF-space size (points).
 */
export function screenSizeToPdf(
  width: number,
  height: number,
  canvasDisplayWidth: number,
  canvasDisplayHeight: number,
  page: PageInfo
): { pdfW: number; pdfH: number } {
  const [effW, effH] = effectiveDimensions(page);
  return {
    pdfW: (width / canvasDisplayWidth) * effW,
    pdfH: (height / canvasDisplayHeight) * effH,
  };
}
