import { PDFDocument, degrees } from 'pdf-lib';
import type { Rotation } from 'pdf-lib';
import type { SignaturePlacement, PageInfo } from '../../types';

type QuarterTurn = 0 | 90 | 180 | 270;

type SignatureDrawOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: Rotation;
};

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

    const rotation = normalizeRotation(
      pages[p.pageIndex]?.rotation ?? pdfPage.getRotation().angle
    );

    pdfPage.drawImage(
      image,
      getSignatureDrawOptions(p, pdfPage.getWidth(), pdfPage.getHeight(), rotation)
    );
  }

  return pdfDoc.save();
}

export function getSignatureDrawOptions(
  placement: Pick<SignaturePlacement, 'x' | 'y' | 'width' | 'height'>,
  pageWidth: number,
  pageHeight: number,
  rotation: QuarterTurn
): SignatureDrawOptions {
  switch (rotation) {
    case 90:
      return {
        x: pageWidth - placement.y,
        y: placement.x,
        width: placement.width,
        height: placement.height,
        rotate: degrees(90),
      };
    case 180:
      return {
        x: pageWidth - placement.x,
        y: pageHeight - placement.y,
        width: placement.width,
        height: placement.height,
        rotate: degrees(180),
      };
    case 270:
      return {
        x: placement.y,
        y: pageHeight - placement.x,
        width: placement.width,
        height: placement.height,
        rotate: degrees(270),
      };
    case 0:
    default:
      return {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
      };
  }
}

function normalizeRotation(angle: number): QuarterTurn {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
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
