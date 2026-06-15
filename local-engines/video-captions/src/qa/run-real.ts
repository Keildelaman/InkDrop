import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractAudioForAlignment,
  generateAss,
  probeVideo,
  renderBurnedInSubtitles,
  reviewScriptAgainstTranscript,
  runWhisperXAlignment,
  type CaptionMode,
  type CaptionPreset,
  type TimestampsFile,
  type VideoMetadata,
  type WhisperModel,
} from '../index.js';

interface CliOptions {
  videoPath: string;
  scriptPath: string;
  language: string;
  model: WhisperModel;
  preset: CaptionPreset;
  mode: CaptionMode;
  keywords: string[];
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(moduleDir, '../..');

await main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = resolve(engineRoot, 'qa-output', timestamp);
  const videoBaseName = basename(options.videoPath, extname(options.videoPath));
  const audioPath = resolve(outputDir, 'audio.wav');
  const rawTimestampsPath = resolve(outputDir, 'raw-timestamps.json');
  const reviewedTimestampsPath = resolve(outputDir, 'reviewed-timestamps.json');
  const assPath = resolve(outputDir, 'captions.ass');
  const outputPath = resolve(outputDir, `${videoBaseName}-captioned.mp4`);

  await mkdir(outputDir, { recursive: true });

  console.log(`QA output: ${outputDir}`);
  console.log('Probing source video...');
  const sourceMetadata = await probeVideo(options.videoPath);
  logMetadata('Source', sourceMetadata);

  console.log('Extracting 16 kHz mono audio for alignment...');
  await extractAudioForAlignment({
    inputPath: options.videoPath,
    outputPath: audioPath,
  });

  console.log(`Running WhisperX (${options.language}, ${options.model})...`);
  const rawTimestamps = await runWhisperXAlignment({
    audioPath,
    outputPath: rawTimestampsPath,
    language: options.language,
    model: options.model,
    onProgress: (message) => {
      const trimmed = message.trim();
      if (trimmed) {
        console.log(trimmed);
      }
    },
  });

  console.log('Reviewing transcript against provided script...');
  const script = await readFile(options.scriptPath, 'utf8');
  const review = reviewScriptAgainstTranscript(script, rawTimestamps, options.language);
  await writeJson(review.timestamps, reviewedTimestampsPath);

  console.log(`Script confidence: ${(review.summary.confidence * 100).toFixed(1)}%`);
  console.log(
    `Words: ${review.summary.matched} matched, ${review.summary.changed} changed, ${review.summary.missing} estimated, ${review.summary.extra} extra audio words`
  );
  for (const warning of review.summary.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  console.log(`Generating ${options.mode} ASS captions (${options.preset} preset)...`);
  const ass = generateAss(review.timestamps, {
    resolution: {
      width: sourceMetadata.width,
      height: sourceMetadata.height,
    },
    preset: options.preset,
    mode: options.mode,
    keywords: options.keywords,
  });
  await writeFile(assPath, ass, 'utf8');

  console.log('Rendering burned-in captions...');
  await renderBurnedInSubtitles({
    inputPath: options.videoPath,
    subtitlesPath: assPath,
    outputPath,
  });

  console.log('Probing output video...');
  const outputMetadata = await probeVideo(outputPath);
  assertSameMediaShape(sourceMetadata, outputMetadata);
  logMetadata('Output', outputMetadata);

  console.log(`Captioned video: ${outputPath}`);
  console.log(`Reviewed timestamps: ${reviewedTimestampsPath}`);
  console.log(`ASS subtitles: ${assPath}`);
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    values.set(key, value);
    index += 1;
  }

  const videoPath = values.get('video');
  const scriptPath = values.get('script');
  if (!videoPath || !scriptPath) {
    throw new Error(
      [
        'Usage:',
        '  npm run qa:real -- --video C:\\path\\video.mp4 --script C:\\path\\script.txt',
        '',
        'Optional:',
        '  --language de --model medium --preset youtube --mode normal --keywords wort1,wort2',
      ].join('\n')
    );
  }

  const model = parseChoice(values.get('model') ?? 'medium', ['tiny', 'base', 'small', 'medium', 'large-v3'], 'model');
  const preset = parseChoice(values.get('preset') ?? 'youtube', ['youtube', 'shorts', 'minimal'], 'preset');
  const mode = parseChoice(values.get('mode') ?? 'normal', ['normal', 'phrase', 'karaoke', 'keyword'], 'mode');

  return {
    videoPath: resolve(videoPath),
    scriptPath: resolve(scriptPath),
    language: values.get('language') ?? 'de',
    model,
    preset,
    mode,
    keywords: (values.get('keywords') ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  };
}

function parseChoice<T extends string>(value: string, allowed: readonly T[], name: string): T {
  if (allowed.includes(value as T)) {
    return value as T;
  }

  throw new Error(`Invalid ${name} "${value}". Expected one of: ${allowed.join(', ')}`);
}

async function writeJson(data: TimestampsFile, path: string): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function assertSameMediaShape(source: VideoMetadata, output: VideoMetadata): void {
  if (source.width !== output.width || source.height !== output.height) {
    throw new Error(`Output resolution changed from ${source.width}x${source.height} to ${output.width}x${output.height}`);
  }

  if (Math.abs(source.frameRate - output.frameRate) > 0.01) {
    throw new Error(`Output frame rate changed from ${source.frameRate.toFixed(3)} to ${output.frameRate.toFixed(3)}`);
  }
}

function logMetadata(label: string, metadata: VideoMetadata): void {
  console.log(
    `${label}: ${metadata.width}x${metadata.height}, ${metadata.frameRate.toFixed(3)} fps, ${metadata.duration.toFixed(2)}s`
  );
}
