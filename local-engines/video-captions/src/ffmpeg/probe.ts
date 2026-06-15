import type { VideoMetadata } from '../subtitles/types.js';
import { runProcess } from './process.js';

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
}

export async function probeVideo(inputPath: string): Promise<VideoMetadata> {
  const { stdout } = await runProcess('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    inputPath,
  ]);

  const data = JSON.parse(stdout) as FfprobeResult;
  const video = data.streams?.find((stream) => stream.codec_type === 'video');
  if (!video?.width || !video.height) {
    throw new Error(`No video stream found in ${inputPath}`);
  }

  const audio = data.streams?.find((stream) => stream.codec_type === 'audio');

  return {
    width: video.width,
    height: video.height,
    frameRate: parseFrameRate(video.avg_frame_rate ?? video.r_frame_rate),
    duration: parseDuration(data.format?.duration),
    videoCodec: video.codec_name,
    audioCodec: audio?.codec_name,
    hasAudio: Boolean(audio),
  };
}

export function parseFrameRate(value: string | undefined): number {
  if (!value || value === '0/0') {
    return 0;
  }

  const [numerator, denominator] = value.split('/').map(Number);
  if (!denominator) {
    return Number.isFinite(numerator) ? numerator : 0;
  }

  return numerator / denominator;
}

function parseDuration(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const duration = Number(value);
  return Number.isFinite(duration) ? duration : 0;
}
