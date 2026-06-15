import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAss } from '../subtitles/generator.js';
import type { Resolution, TimestampsFile } from '../subtitles/types.js';
import { probeVideo } from '../ffmpeg/probe.js';
import { renderBurnedInSubtitles } from '../ffmpeg/render.js';
import { runProcess } from '../ffmpeg/process.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(moduleDir, '../..');
const workDir = resolve(engineRoot, 'work');
const outputDir = resolve(engineRoot, 'output');
const sourcePath = resolve(workDir, 'sample-source.mp4');
const assPath = resolve(outputDir, 'sample-captions.ass');
const outputPath = resolve(outputDir, 'sample-captioned.mp4');

await mkdir(workDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

await createSampleVideo(sourcePath);
const sourceMetadata = await probeVideo(sourcePath);
const resolution: Resolution = {
  width: sourceMetadata.width,
  height: sourceMetadata.height,
};

const timestamps: TimestampsFile = {
  totalDuration: 6,
  wordCount: 9,
  language: 'de',
  words: [
    { word: 'Hallo', start: 0.4, end: 0.8 },
    { word: 'und', start: 0.85, end: 1.05 },
    { word: 'sch\u00f6n,', start: 1.1, end: 1.55 },
    { word: 'dass', start: 1.7, end: 1.95 },
    { word: 'du', start: 2.0, end: 2.2 },
    { word: 'da', start: 2.25, end: 2.5 },
    { word: 'bist!', start: 2.55, end: 3.0 },
    { word: '\u00dcberpr\u00fcfe', start: 3.4, end: 4.0 },
    { word: 'Untertitel.', start: 4.05, end: 4.8 },
  ],
};

const ass = generateAss(timestamps, {
  resolution,
  preset: 'shorts',
  mode: 'karaoke',
  style: {
    fontSize: 58,
  },
});

await writeFile(assPath, ass, 'utf8');
await renderBurnedInSubtitles({
  inputPath: sourcePath,
  subtitlesPath: assPath,
  outputPath,
});

const outputMetadata = await probeVideo(outputPath);
assertSameMediaShape(sourceMetadata, outputMetadata);

console.log(`Sample render complete: ${outputPath}`);
console.log(`Resolution: ${outputMetadata.width}x${outputMetadata.height}`);
console.log(`Frame rate: ${outputMetadata.frameRate.toFixed(3)} fps`);

async function createSampleVideo(path: string): Promise<void> {
  await runProcess('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=1280x720:rate=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000',
    '-t',
    '6',
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    path,
  ]);
}

function assertSameMediaShape(
  source: { width: number; height: number; frameRate: number },
  output: { width: number; height: number; frameRate: number }
): void {
  if (source.width !== output.width || source.height !== output.height) {
    throw new Error(`Output resolution changed from ${source.width}x${source.height} to ${output.width}x${output.height}`);
  }

  if (Math.abs(source.frameRate - output.frameRate) > 0.01) {
    throw new Error(`Output frame rate changed from ${source.frameRate} to ${output.frameRate}`);
  }
}
