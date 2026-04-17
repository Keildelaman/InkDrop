const SIGNATURE_FONTS = [
  { name: 'Dancing Script', label: 'Cursive' },
  { name: 'Caveat', label: 'Handwritten' },
  { name: 'Great Vibes', label: 'Formal' },
] as const;

export { SIGNATURE_FONTS };

export function renderTextSignature(
  name: string,
  fontFamily: string,
  color: string = '#1e293b'
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const fontSize = 64;
  ctx.font = `${fontSize}px "${fontFamily}"`;
  const metrics = ctx.measureText(name);

  const padding = 20;
  canvas.width = Math.max(metrics.width + padding * 2, 100);
  canvas.height = fontSize * 1.6 + padding * 2;

  // Must re-set font after canvas resize
  ctx.font = `${fontSize}px "${fontFamily}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, padding, canvas.height / 2);

  return canvas.toDataURL('image/png');
}
