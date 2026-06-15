import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BurnInOptions, RenderQuality } from '../subtitles/types.js';
import { runProcess } from './process.js';

const DEFAULT_QUALITY: RenderQuality = {
  crf: 18,
  preset: 'medium',
};

export function escapeSubtitleFilterPath(subtitlesPath: string): string {
  return subtitlesPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,');
}

export function buildBurnInArgs(options: BurnInOptions): string[] {
  const quality = {
    ...DEFAULT_QUALITY,
    ...options.quality,
  };

  return [
    '-y',
    '-i',
    options.inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    `subtitles='${escapeSubtitleFilterPath(options.subtitlesPath)}'`,
    '-c:v',
    'libx264',
    '-crf',
    String(quality.crf),
    '-preset',
    quality.preset,
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    options.outputPath,
  ];
}

export async function renderBurnedInSubtitles(options: BurnInOptions): Promise<void> {
  await mkdir(dirname(options.outputPath), { recursive: true });
  await runProcess('ffmpeg', buildBurnInArgs(options));
}
