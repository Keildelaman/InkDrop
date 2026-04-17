interface Point {
  x: number;
  y: number;
  pressure: number;
}

type Stroke = Point[];

export function setupDrawCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  let strokes: Stroke[] = [];
  let currentStroke: Stroke | null = null;
  let color = '#1e293b';
  let lineWidth = 2.5;

  // Setup canvas size
  function resize(width: number, height: number) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    redraw();
  }

  function setColor(c: string) {
    color = c;
    redraw();
  }

  function setLineWidth(w: number) {
    lineWidth = w;
  }

  function handlePointerDown(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    currentStroke = [{
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    }];
    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!currentStroke) return;
    const rect = canvas.getBoundingClientRect();
    currentStroke.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    });
    redraw();
    drawStroke(currentStroke);
  }

  function handlePointerUp() {
    if (currentStroke && currentStroke.length > 1) {
      strokes.push(currentStroke);
    }
    currentStroke = null;
    redraw();
  }

  function drawStroke(stroke: Stroke) {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke[0].x, stroke[0].y);

    for (let i = 1; i < stroke.length - 1; i++) {
      const midX = (stroke[i].x + stroke[i + 1].x) / 2;
      const midY = (stroke[i].y + stroke[i + 1].y) / 2;
      ctx.lineWidth = lineWidth + stroke[i].pressure * 2;
      ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY);
    }

    const last = stroke[stroke.length - 1];
    ctx.lineWidth = lineWidth + last.pressure * 2;
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const stroke of strokes) {
      drawStroke(stroke);
    }
  }

  function clear() {
    strokes = [];
    currentStroke = null;
    redraw();
  }

  function undo() {
    strokes.pop();
    redraw();
  }

  function isEmpty(): boolean {
    return strokes.length === 0;
  }

  function toDataUrl(): string {
    // Create a temp canvas with trimmed content
    const trimmed = trimCanvas(canvas, dpr);
    return trimmed.toDataURL('image/png');
  }

  // Attach events
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerUp);
  canvas.style.touchAction = 'none';

  return {
    resize,
    setColor,
    setLineWidth,
    clear,
    undo,
    isEmpty,
    toDataUrl,
    destroy() {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
    },
  };
}

function trimCanvas(canvas: HTMLCanvasElement, dpr: number): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    // Empty canvas
    const empty = document.createElement('canvas');
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  const padding = 10 * dpr;
  const trimW = maxX - minX + 1 + padding * 2;
  const trimH = maxY - minY + 1 + padding * 2;

  const trimmed = document.createElement('canvas');
  trimmed.width = trimW;
  trimmed.height = trimH;
  const tCtx = trimmed.getContext('2d')!;
  tCtx.drawImage(canvas, minX - padding, minY - padding, trimW, trimH, 0, 0, trimW, trimH);

  return trimmed;
}
