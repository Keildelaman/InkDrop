export type AudioOutputFormat = 'mp3' | 'wav';

export type Mp3Bitrate = 128 | 192 | 320;

export interface AudioConversionProgress {
  ratio: number;
  label: string;
}

export interface ConvertAudioOptions {
  outputFormat: AudioOutputFormat;
  mp3Bitrate: Mp3Bitrate;
  onStatus?: (message: string) => void;
  onProgress?: (progress: AudioConversionProgress) => void;
}

export interface ConvertedAudio {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}

type FFmpegInstance = InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg>;

let ffmpeg: FFmpegInstance | null = null;
let loadPromise: Promise<FFmpegInstance> | null = null;
let coreUrlsPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;

export const MP3_BITRATE_OPTIONS: Mp3Bitrate[] = [128, 192, 320];

export function isSupportedM4aFile(file: File): boolean {
  return /\.m4a$/i.test(file.name);
}

export function getOutputFileName(inputName: string, outputFormat: AudioOutputFormat): string {
  const baseName = inputName.replace(/\.[^/.]+$/, '').trim() || 'converted-audio';
  return `${baseName}.${outputFormat}`;
}

export async function convertAudio(
  file: File,
  options: ConvertAudioOptions
): Promise<ConvertedAudio> {
  const ffmpegInstance = await getLoadedFFmpeg(options);
  const runId = crypto.randomUUID();
  const inputPath = `input-${runId}.m4a`;
  const outputPath = `output-${runId}.${options.outputFormat}`;

  const logHandler = ({ message }: { type: string; message: string }) => {
    if (message.includes('size=') || message.includes('time=')) {
      options.onStatus?.('Converting audio...');
    }
  };

  const progressHandler = ({ progress }: { progress: number; time: number }) => {
    const ratio = Math.min(0.95, Math.max(0.2, 0.2 + progress * 0.7));
    options.onProgress?.({ ratio, label: 'Converting audio...' });
  };

  ffmpegInstance.on('log', logHandler);
  ffmpegInstance.on('progress', progressHandler);

  try {
    options.onStatus?.('Reading audio file...');
    options.onProgress?.({ ratio: 0.1, label: 'Reading audio file...' });

    const { fetchFile } = await import('@ffmpeg/util');
    await ffmpegInstance.writeFile(inputPath, await fetchFile(file));

    options.onStatus?.('Converting audio...');
    options.onProgress?.({ ratio: 0.2, label: 'Converting audio...' });

    const exitCode = await ffmpegInstance.exec(buildArgs(inputPath, outputPath, options));
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}.`);
    }

    options.onStatus?.('Preparing download...');
    options.onProgress?.({ ratio: 0.96, label: 'Preparing download...' });

    const data = await ffmpegInstance.readFile(outputPath);
    if (typeof data === 'string') {
      throw new Error('Expected binary audio output but received text.');
    }

    options.onProgress?.({ ratio: 1, label: 'Ready to download.' });

    return {
      bytes: data,
      fileName: getOutputFileName(file.name, options.outputFormat),
      mimeType: options.outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
    };
  } finally {
    ffmpegInstance.off('log', logHandler);
    ffmpegInstance.off('progress', progressHandler);
    await safeDelete(ffmpegInstance, inputPath);
    await safeDelete(ffmpegInstance, outputPath);
  }
}

function buildArgs(
  inputPath: string,
  outputPath: string,
  options: ConvertAudioOptions
): string[] {
  if (options.outputFormat === 'mp3') {
    return [
      '-i',
      inputPath,
      '-vn',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      `${options.mp3Bitrate}k`,
      outputPath,
    ];
  }

  return [
    '-i',
    inputPath,
    '-vn',
    '-acodec',
    'pcm_s16le',
    outputPath,
  ];
}

async function getLoadedFFmpeg(options: ConvertAudioOptions): Promise<FFmpegInstance> {
  if (ffmpeg?.loaded) return ffmpeg;

  if (!loadPromise) {
    loadPromise = loadFFmpeg(options).catch((error) => {
      loadPromise = null;
      ffmpeg = null;
      throw error;
    });
  }

  return loadPromise;
}

async function loadFFmpeg(options: ConvertAudioOptions): Promise<FFmpegInstance> {
  options.onStatus?.('Loading converter engine...');
  options.onProgress?.({ ratio: 0.02, label: 'Loading converter engine...' });

  const [{ FFmpeg }, coreUrls] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    getCoreUrls(options),
  ]);

  const instance = new FFmpeg();
  await instance.load(coreUrls);
  ffmpeg = instance;

  options.onStatus?.('Converter ready.');
  options.onProgress?.({ ratio: 0.08, label: 'Converter ready.' });

  return instance;
}

async function getCoreUrls(options: ConvertAudioOptions): Promise<{ coreURL: string; wasmURL: string }> {
  if (!coreUrlsPromise) {
    coreUrlsPromise = createCoreUrls(options).catch((error) => {
      coreUrlsPromise = null;
      throw error;
    });
  }
  return coreUrlsPromise;
}

async function createCoreUrls(options: ConvertAudioOptions): Promise<{ coreURL: string; wasmURL: string }> {
  const { toBlobURL } = await import('@ffmpeg/util');
  const baseUrl = `${import.meta.env.BASE_URL}ffmpeg-core`;

  options.onStatus?.('Downloading converter engine...');
  const coreURL = await toBlobURL(
    `${baseUrl}/ffmpeg-core.js`,
    'text/javascript',
    true,
    (event) => {
      if (event.total > 0) {
        options.onProgress?.({
          ratio: Math.min(0.04, event.received / event.total * 0.04),
          label: 'Downloading converter engine...',
        });
      }
    }
  );

  const wasmURL = await toBlobURL(
    `${baseUrl}/ffmpeg-core.wasm`,
    'application/wasm',
    true,
    (event) => {
      if (event.total > 0) {
        options.onProgress?.({
          ratio: 0.04 + Math.min(0.04, event.received / event.total * 0.04),
          label: 'Downloading converter engine...',
        });
      }
    }
  );

  return { coreURL, wasmURL };
}

async function safeDelete(ffmpegInstance: FFmpegInstance, path: string) {
  try {
    await ffmpegInstance.deleteFile(path);
  } catch {
    // Temp files may not exist if conversion fails before write/read completes.
  }
}
