import { PDFDocument, degrees } from 'pdf-lib';
import type { SignaturePlacement, PageInfo } from '../../types';

export async function exportPdf(
  originalBytes: Uint8Array,
  placements: SignaturePlacement[],
  pages: PageInfo[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
  });

  // Pre-embed all unique signature images (deduplicate by dataUrl)
  const embeddedImages = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();
  for (const p of placements) {
    if (embeddedImages.has(p.dataUrl)) continue;
    const bytes = dataUrlToUint8Array(p.dataUrl);
    const isPng = p.dataUrl.includes('image/png');
    const image = isPng
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    embeddedImages.set(p.dataUrl, image);
  }

  // Place each signature
  for (const p of placements) {
    const pdfPage = pdfDoc.getPage(p.pageIndex);
    const image = embeddedImages.get(p.dataUrl);
    if (!image) continue;

    const rotation = pdfPage.getRotation().angle;

    if (rotation === 0) {
      pdfPage.drawImage(image, {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
      });
    } else if (rotation === 90) {
      pdfPage.drawImage(image, {
        x: p.y,
        y: pdfPage.getWidth() - p.x - p.width,
        width: p.height,
        height: p.width,
        rotate: degrees(-90),
      });
    } else if (rotation === 180) {
      pdfPage.drawImage(image, {
        x: pdfPage.getWidth() - p.x - p.width,
        y: pdfPage.getHeight() - p.y - p.height,
        width: p.width,
        height: p.height,
        rotate: degrees(180),
      });
    } else if (rotation === 270) {
      pdfPage.drawImage(image, {
        x: pdfPage.getHeight() - p.y - p.height,
        y: p.x,
        width: p.height,
        height: p.width,
        rotate: degrees(90),
      });
    }
  }

  return pdfDoc.save();
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
