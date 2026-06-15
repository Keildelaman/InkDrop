import type { CaptionStyle, Resolution, SubtitleLine } from './types.js';

export function hexToAssColor(hex: string): string {
  const clean = normalizeHexColor(hex);
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

export function hexToAssColorWithAlpha(hex: string, alpha = 0x80): string {
  const clean = normalizeHexColor(hex);
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  const alphaHex = alpha.toString(16).padStart(2, '0');
  return `&H${alphaHex}${b}${g}${r}`.toUpperCase();
}

export function formatAssTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalCentiseconds = Math.round(safeSeconds * 100);
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const centiseconds = totalCentiseconds % 100;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${hours}:${pad2(minutes)}:${pad2(secs)}.${pad2(centiseconds)}`;
}

export function getAssAlignment(position: CaptionStyle['position']): number {
  switch (position) {
    case 'top':
      return 8;
    case 'center':
      return 5;
    case 'bottom':
      return 2;
  }
}

export function escapeAssText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[{}]/g, '')
    .replace(/\\/g, '');
}

export function buildScriptInfo(resolution: Resolution): string {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${resolution.width}
PlayResY: ${resolution.height}
WrapStyle: 0
ScaledBorderAndShadow: yes`;
}

export function buildStyles(style: CaptionStyle, resolution: Resolution): string {
  const marginH = Math.round(style.marginH);
  const marginV = style.position === 'center' ? Math.round(resolution.height / 2) : Math.round(style.marginV);

  return `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${hexToAssColor(style.primaryColor)},${hexToAssColor(style.highlightColor)},${hexToAssColor(style.outlineColor)},${hexToAssColorWithAlpha('#000000')},1,0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowDepth},${getAssAlignment(style.position)},${marginH},${marginH},${marginV},1`;
}

export function buildAnimationTags(style: CaptionStyle): string {
  switch (style.animation) {
    case 'pop':
      return '{\\fad(50,0)\\t(0,80,\\fscx105\\fscy105)\\t(80,150,\\fscx100\\fscy100)}';
    case 'fade':
      return '{\\fad(150,0)}';
    case 'none':
      return '';
  }
}

export function buildDialogue(startTime: number, endTime: number, text: string, layer = 0): string {
  return `Dialogue: ${layer},${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,${text}`;
}

export function buildEvents(dialogues: string[]): string {
  return `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogues.join('\n')}`;
}

export function buildAssFile(resolution: Resolution, style: CaptionStyle, dialogues: string[]): string {
  return `${buildScriptInfo(resolution)}

${buildStyles(style, resolution)}

${buildEvents(dialogues)}
`;
}

export function buildSimpleEvent(line: SubtitleLine, style: CaptionStyle, text = line.text): string {
  return buildDialogue(line.startTime, line.endTime, `${buildAnimationTags(style)}${text}`);
}

function normalizeHexColor(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return clean;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
