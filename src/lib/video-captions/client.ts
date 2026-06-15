export type CaptionMode = 'normal' | 'phrase' | 'karaoke' | 'keyword';

export type CaptionPreset = 'youtube' | 'shorts' | 'minimal';

export type CaptionPosition = 'top' | 'center' | 'bottom';

export type CaptionLanguage = 'de' | 'en';

export type JobStatus =
  | 'created'
  | 'uploading'
  | 'probing'
  | 'extracting-audio'
  | 'transcribing'
  | 'aligning'
  | 'reviewing-script'
  | 'generating-subtitles'
  | 'rendering'
  | 'complete'
  | 'failed'
  | 'cancelled';

export interface EngineConnection {
  baseUrl: string;
  token: string;
}

export interface EngineHealth {
  ok: boolean;
  version: string;
  authRequired: boolean;
  alignmentReady: boolean;
  ffmpeg: ToolHealth;
  ffprobe: ToolHealth;
  python: ToolHealth;
  whisperx: ToolHealth;
}

export interface ToolHealth {
  available: boolean;
  version?: string;
  path?: string;
  cudaAvailable?: boolean;
  device?: string;
  guidance?: string;
  error?: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export type ReviewWordStatus = 'matched' | 'changed' | 'missing';

export interface ScriptReviewWord extends WordTimestamp {
  status: ReviewWordStatus;
  transcriptWord?: string;
}

export interface TimestampsFile {
  totalDuration: number;
  wordCount: number;
  language: string;
  words: WordTimestamp[];
}

export interface CaptionStyleRequest {
  fontSize?: number;
  primaryColor?: string;
  highlightColor?: string;
  position?: CaptionPosition;
  maxWordsPerLine?: number;
}

export interface RenderJobRequest {
  timestamps?: TimestampsFile;
  preset: CaptionPreset;
  mode: CaptionMode;
  style: CaptionStyleRequest;
  keywords: string[];
}

export type WhisperModel = 'small' | 'medium' | 'large-v3';

export interface AlignJobRequest {
  script?: string;
  language: CaptionLanguage;
  model: WhisperModel;
}

export interface ScriptReviewSummary {
  confidence: number;
  matched: number;
  changed: number;
  missing: number;
  extra: number;
  scriptWordCount: number;
  transcriptWordCount: number;
  reviewedWordCount: number;
  warnings: string[];
}

export interface CaptionJob {
  id: string;
  status: JobStatus;
  progressLabel: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  outputFileName?: string;
  metadata?: {
    width: number;
    height: number;
    frameRate: number;
    duration: number;
    videoCodec?: string;
    audioCodec?: string;
    hasAudio: boolean;
  };
  rawTimestamps?: TimestampsFile;
  reviewedTimestamps?: TimestampsFile;
  scriptReview?: ScriptReviewSummary;
  scriptReviewWords?: ScriptReviewWord[];
  scriptReviewExtraWords?: WordTimestamp[];
  error?: string;
  hasInput: boolean;
  hasTimestamps: boolean;
  hasOutput: boolean;
  createdAt: number;
  updatedAt: number;
}

export const ENGINE_URL_STORAGE_KEY = 'inkdrop-video-captions-engine-url';
export const ENGINE_TOKEN_STORAGE_KEY = 'inkdrop-video-captions-engine-token';

export function parseEngineConnectionInput(input: string, tokenFallback = ''): EngineConnection {
  const trimmed = input.trim();
  const url = new URL(trimmed || 'http://127.0.0.1:4777');
  const token = url.searchParams.get('token') || tokenFallback.trim();
  url.search = '';
  url.hash = '';
  url.pathname = '';

  return {
    baseUrl: url.origin,
    token,
  };
}

export async function getHealth(connection: EngineConnection): Promise<EngineHealth> {
  return requestJson<EngineHealth>(connection, '/health', {
    method: 'GET',
    includeToken: false,
  });
}

export async function validateSession(connection: EngineConnection): Promise<void> {
  await requestJson<{ ok: boolean }>(connection, '/session', {
    method: 'GET',
  });
}

export async function createJob(connection: EngineConnection, file: File): Promise<CaptionJob> {
  return requestJson<CaptionJob>(connection, '/jobs', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });
}

export async function uploadVideo(connection: EngineConnection, jobId: string, file: File): Promise<CaptionJob> {
  const path = `/jobs/${encodeURIComponent(jobId)}/input?name=${encodeURIComponent(file.name)}`;
  return requestJson<CaptionJob>(connection, path, {
    method: 'PUT',
    body: file,
    contentType: file.type || 'application/octet-stream',
  });
}

export async function startRender(
  connection: EngineConnection,
  jobId: string,
  request: RenderJobRequest
): Promise<CaptionJob> {
  return requestJson<CaptionJob>(connection, `/jobs/${encodeURIComponent(jobId)}/render`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function startAlignment(
  connection: EngineConnection,
  jobId: string,
  request: AlignJobRequest
): Promise<CaptionJob> {
  return requestJson<CaptionJob>(connection, `/jobs/${encodeURIComponent(jobId)}/align`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getJob(connection: EngineConnection, jobId: string): Promise<CaptionJob> {
  return requestJson<CaptionJob>(connection, `/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
}

export async function downloadOutput(connection: EngineConnection, jobId: string): Promise<Blob> {
  const response = await request(connection, `/jobs/${encodeURIComponent(jobId)}/output`, {
    method: 'GET',
  });
  return response.blob();
}

async function requestJson<T>(
  connection: EngineConnection,
  path: string,
  options: RequestInit & { includeToken?: boolean; contentType?: string } = {}
): Promise<T> {
  const response = await request(connection, path, options);
  return response.json() as Promise<T>;
}

async function request(
  connection: EngineConnection,
  path: string,
  options: RequestInit & { includeToken?: boolean; contentType?: string } = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.includeToken !== false) {
    headers.set('X-InkDrop-Token', connection.token);
  }
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  } else if (options.contentType) {
    headers.set('Content-Type', options.contentType);
  }

  const response = await fetch(`${connection.baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}
