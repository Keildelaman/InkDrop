import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { runProcess } from './process.js';

export interface ExtractAudioOptions {
  inputPath: string;
  outputPath: string;
}

export function buildExtractAudioArgs(options: ExtractAudioOptions): string[] {
  return [
    '-y',
    '-i',
    options.inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    options.outputPath,
  ];
}

export async function extractAudioForAlignment(options: ExtractAudioOptions): Promise<void> {
  await mkdir(dirname(options.outputPath), { recursive: true });
  await runProcess('ffmpeg', buildExtractAudioArgs(options));
}
