import type { CaptionPreset, CaptionStyle, Resolution } from './types.js';

export const DEFAULT_STYLE: CaptionStyle = {
  fontName: 'Arial',
  fontSize: 54,
  primaryColor: '#FFFFFF',
  highlightColor: '#FFD400',
  outlineColor: '#000000',
  outlineWidth: 4,
  shadowDepth: 2,
  position: 'bottom',
  marginH: 96,
  marginV: 72,
  animation: 'fade',
  maxWordsPerLine: 10,
  adaptToAspect: true,
};

export const YOUTUBE_PRESET: CaptionStyle = {
  ...DEFAULT_STYLE,
  fontSize: 48,
  position: 'bottom',
  marginH: 96,
  marginV: 72,
  animation: 'fade',
  maxWordsPerLine: 9,
};

export const SHORTS_PRESET: CaptionStyle = {
  ...DEFAULT_STYLE,
  fontSize: 68,
  highlightColor: '#00FF66',
  position: 'center',
  marginH: 72,
  marginV: 50,
  animation: 'pop',
  maxWordsPerLine: 3,
};

export const MINIMAL_PRESET: CaptionStyle = {
  ...DEFAULT_STYLE,
  fontSize: 42,
  highlightColor: '#FFFFFF',
  outlineWidth: 2,
  shadowDepth: 0,
  position: 'bottom',
  marginH: 96,
  marginV: 72,
  animation: 'none',
  maxWordsPerLine: 10,
};

const PRESETS: Record<CaptionPreset, CaptionStyle> = {
  youtube: YOUTUBE_PRESET,
  shorts: SHORTS_PRESET,
  minimal: MINIMAL_PRESET,
};

export function getPresetStyle(preset: CaptionPreset = 'youtube', overrides: Partial<CaptionStyle> = {}): CaptionStyle {
  return {
    ...PRESETS[preset],
    ...overrides,
  };
}

export function adaptStyleToResolution(style: CaptionStyle, resolution: Resolution): CaptionStyle {
  if (!style.adaptToAspect) {
    return style;
  }

  const scaledStyle = scaleStyleToResolution(style, resolution);
  const isPortrait = resolution.height > resolution.width;
  if (!isPortrait) {
    return scaledStyle;
  }

  const alreadyShortsStyle = style.position === 'center' && style.maxWordsPerLine <= 3;
  return {
    ...scaledStyle,
    fontSize: alreadyShortsStyle ? scaledStyle.fontSize : Math.round(scaledStyle.fontSize * 1.15),
    maxWordsPerLine: Math.min(scaledStyle.maxWordsPerLine, 3),
    marginH: Math.max(scaledStyle.marginH, Math.round(resolution.width * 0.11)),
    position: alreadyShortsStyle ? scaledStyle.position : 'center',
  };
}

function scaleStyleToResolution(style: CaptionStyle, resolution: Resolution): CaptionStyle {
  const scale = Math.min(resolution.width, resolution.height) / 1080;
  if (!Number.isFinite(scale) || scale <= 0 || scale === 1) {
    return style;
  }

  return {
    ...style,
    fontSize: Math.max(20, Math.round(style.fontSize * scale)),
    outlineWidth: Math.max(1, Math.round(style.outlineWidth * scale)),
    shadowDepth: Math.max(0, Math.round(style.shadowDepth * scale)),
    marginH: Math.max(24, Math.round(style.marginH * scale)),
    marginV: Math.max(24, Math.round(style.marginV * scale)),
  };
}
