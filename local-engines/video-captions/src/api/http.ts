import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { reviewScriptAgainstTranscript } from '../aligner/script-review.js';
import { runWhisperXAlignment } from '../aligner/whisperx.js';
import { extractAudioForAlignment } from '../ffmpeg/audio.js';
import { generateAss } from '../subtitles/generator.js';
import { probeVideo } from '../ffmpeg/probe.js';
import { renderBurnedInSubtitles } from '../ffmpeg/render.js';
import { JobStore, sanitizeFileName } from './job-store.js';
import { getRequestOrigin, isAllowedOrigin, isAuthorized } from './security.js';
import { checkPython, checkTool, checkWhisperX } from './tools.js';
import type { AlignJobRequest, CaptionJob, CreateJobRequest, HealthResponse, RenderJobRequest } from './types.js';

const ENGINE_VERSION = '0.1.0';
const JSON_LIMIT_BYTES = 2 * 1024 * 1024;

export interface VideoCaptionsServerOptions {
  rootDir: string;
  token: string;
}

export interface VideoCaptionsServer {
  server: Server;
  store: JobStore;
}

export function createVideoCaptionsServer(options: VideoCaptionsServerOptions): VideoCaptionsServer {
  const store = new JobStore(options.rootDir);
  const server = createServer((req, res) => {
    void handleRequest(req, res, store, options.token);
  });

  return { server, store };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: JobStore,
  token: string
): Promise<void> {
  const origin = getRequestOrigin(req);

  if (!isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: 'Origin is not allowed.' });
    return;
  }

  applyCors(req, res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://127.0.0.1');

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      await handleHealth(res);
      return;
    }

    if (!isAuthorized(req, token)) {
      sendJson(res, 401, { error: 'Missing or invalid InkDrop token.' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/session') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/jobs') {
      await handleCreateJob(req, res, store);
      return;
    }

    const jobInputMatch = /^\/jobs\/([^/]+)\/input$/.exec(url.pathname);
    if (req.method === 'PUT' && jobInputMatch?.[1]) {
      await handleUploadInput(req, res, store, jobInputMatch[1], url.searchParams.get('name') ?? undefined);
      return;
    }

    const jobRenderMatch = /^\/jobs\/([^/]+)\/render$/.exec(url.pathname);
    if (req.method === 'POST' && jobRenderMatch?.[1]) {
      await handleStartRender(req, res, store, jobRenderMatch[1]);
      return;
    }

    const jobAlignMatch = /^\/jobs\/([^/]+)\/align$/.exec(url.pathname);
    if (req.method === 'POST' && jobAlignMatch?.[1]) {
      await handleStartAlign(req, res, store, jobAlignMatch[1]);
      return;
    }

    const jobOutputMatch = /^\/jobs\/([^/]+)\/output$/.exec(url.pathname);
    if (req.method === 'GET' && jobOutputMatch?.[1]) {
      await handleDownloadOutput(res, store, jobOutputMatch[1]);
      return;
    }

    const jobMatch = /^\/jobs\/([^/]+)$/.exec(url.pathname);
    if (jobMatch?.[1]) {
      if (req.method === 'GET') {
        handleGetJob(res, store, jobMatch[1]);
        return;
      }

      if (req.method === 'DELETE') {
        await handleCancelJob(res, store, jobMatch[1]);
        return;
      }
    }

    sendJson(res, 404, { error: 'Route not found.' });
  } catch (err) {
    sendJson(res, 500, { error: readableError(err) });
  }
}

async function handleHealth(res: ServerResponse): Promise<void> {
  const [ffmpeg, ffprobe, python, whisperx] = await Promise.all([
    checkTool('ffmpeg'),
    checkTool('ffprobe'),
    checkPython(),
    checkWhisperX(),
  ]);
  const body: HealthResponse = {
    ok: ffmpeg.available && ffprobe.available,
    version: ENGINE_VERSION,
    authRequired: true,
    alignmentReady: python.available && whisperx.available,
    ffmpeg,
    ffprobe,
    python,
    whisperx,
  };
  sendJson(res, body.ok ? 200 : 503, body);
}

async function handleCreateJob(req: IncomingMessage, res: ServerResponse, store: JobStore): Promise<void> {
  const body = await readJson<CreateJobRequest>(req);
  if (!body.fileName || typeof body.fileName !== 'string') {
    sendJson(res, 400, { error: 'fileName is required.' });
    return;
  }

  const job = await store.createJob({
    fileName: body.fileName,
    fileSize: typeof body.fileSize === 'number' ? body.fileSize : undefined,
    mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
  });

  sendJson(res, 201, store.toPublicJob(job));
}

async function handleUploadInput(
  req: IncomingMessage,
  res: ServerResponse,
  store: JobStore,
  jobId: string,
  uploadName?: string
): Promise<void> {
  const job = store.getJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job not found.' });
    return;
  }

  const safeUploadName = uploadName ? sanitizeFileName(uploadName, job.fileName) : job.fileName;
  const inputPath = store.inputPathFor(job, safeUploadName);

  try {
    store.updateJob(job.id, {
      status: 'uploading',
      progressLabel: 'Uploading video...',
      error: undefined,
    });

    await mkdir(dirname(inputPath), { recursive: true });
    await pipeline(req, createWriteStream(inputPath));

    store.updateJob(job.id, {
      status: 'probing',
      progressLabel: 'Reading video metadata...',
      inputPath,
    });

    const metadata = await probeVideo(inputPath);
    const updated = store.updateJob(job.id, {
      status: 'created',
      progressLabel: 'Video uploaded. Ready to render.',
      metadata,
    });

    sendJson(res, 200, store.toPublicJob(updated));
  } catch (err) {
    const failed = store.updateJob(job.id, {
      status: 'failed',
      progressLabel: 'Video upload failed.',
      error: readableError(err),
    });
    sendJson(res, 500, store.toPublicJob(failed));
  }
}

async function handleStartRender(req: IncomingMessage, res: ServerResponse, store: JobStore, jobId: string): Promise<void> {
  const job = store.getJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job not found.' });
    return;
  }

  if (!job.inputPath || !job.metadata) {
    sendJson(res, 409, { error: 'Upload a video before rendering.' });
    return;
  }

  if (job.status === 'rendering' || job.status === 'generating-subtitles') {
    sendJson(res, 409, { error: 'Job is already rendering.' });
    return;
  }

  const body = await readJson<RenderJobRequest>(req);
  const updated = store.updateJob(job.id, {
    status: 'generating-subtitles',
    progressLabel: 'Generating subtitles...',
    error: undefined,
  });
  setImmediate(() => {
    void renderJob(store, job, body);
  });
  sendJson(res, 202, store.toPublicJob(updated));
}

async function handleStartAlign(req: IncomingMessage, res: ServerResponse, store: JobStore, jobId: string): Promise<void> {
  const job = store.getJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job not found.' });
    return;
  }

  if (job.status === 'extracting-audio' || job.status === 'transcribing' || job.status === 'aligning' || job.status === 'reviewing-script') {
    sendJson(res, 409, { error: 'Job is already generating timings.' });
    return;
  }

  const body = await readJson<AlignJobRequest>(req);
  if (body.script !== undefined && typeof body.script !== 'string') {
    sendJson(res, 400, { error: 'script must be a string.' });
    return;
  }

  if (!job.inputPath || !job.metadata) {
    sendJson(res, 409, { error: 'Upload a video before alignment.' });
    return;
  }

  const updated = store.updateJob(job.id, {
    status: 'extracting-audio',
    progressLabel: 'Extracting audio...',
    error: undefined,
  });
  setImmediate(() => {
    void alignJob(store, job, body);
  });
  sendJson(res, 202, store.toPublicJob(updated));
}

function handleGetJob(res: ServerResponse, store: JobStore, jobId: string): void {
  const job = store.getJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job not found.' });
    return;
  }

  sendJson(res, 200, store.toPublicJob(job));
}

async function handleDownloadOutput(res: ServerResponse, store: JobStore, jobId: string): Promise<void> {
  const job = store.getJob(jobId);
  if (!job?.outputPath || job.status !== 'complete') {
    sendJson(res, 404, { error: 'Output is not available.' });
    return;
  }

  const fileStat = await stat(job.outputPath);
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Length': String(fileStat.size),
    'Content-Disposition': `attachment; filename="${job.outputFileName ?? 'captioned.mp4'}"`,
  });
  createReadStream(job.outputPath).pipe(res);
}

async function handleCancelJob(res: ServerResponse, store: JobStore, jobId: string): Promise<void> {
  const job = store.getJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job not found.' });
    return;
  }

  const updated = store.updateJob(job.id, {
    status: 'cancelled',
    progressLabel: 'Job cancelled.',
  });
  await store.cleanupJob(job.id);
  sendJson(res, 200, store.toPublicJob(updated));
}

async function alignJob(store: JobStore, initialJob: CaptionJob, request: AlignJobRequest): Promise<void> {
  try {
    const job = store.getJob(initialJob.id);
    if (!job?.inputPath || !job.metadata) {
      throw new Error('Job is missing uploaded video metadata.');
    }

    const audioPath = store.audioPathFor(job);
    const rawTimestampsPath = store.rawTimestampsPathFor(job);
    const reviewedTimestampsPath = store.reviewedTimestampsPathFor(job);
    const language = request.language || 'de';
    const script = request.script?.trim() ?? '';
    const model = request.model || 'medium';

    store.updateJob(job.id, {
      status: 'extracting-audio',
      progressLabel: 'Extracting audio for WhisperX...',
      audioPath,
      rawTimestampsPath,
      reviewedTimestampsPath,
      error: undefined,
    });

    await extractAudioForAlignment({
      inputPath: job.inputPath,
      outputPath: audioPath,
    });

    if (store.getJob(job.id)?.status === 'cancelled') {
      return;
    }

    store.updateJob(job.id, {
      status: 'transcribing',
      progressLabel: `Transcribing ${languageLabel(language)} audio with Whisper ${model}...`,
    });

    const rawTimestamps = await runWhisperXAlignment({
      audioPath,
      outputPath: rawTimestampsPath,
      language,
      model,
      onProgress: (message) => updateAlignmentProgress(store, job.id, message),
    });

    if (store.getJob(job.id)?.status === 'cancelled') {
      return;
    }

    if (script) {
      store.updateJob(job.id, {
        status: 'reviewing-script',
        progressLabel: 'Comparing transcript with script...',
        rawTimestamps,
      });

      const review = reviewScriptAgainstTranscript(script, rawTimestamps, language);
      await writeFile(reviewedTimestampsPath, JSON.stringify(review.timestamps, null, 2), 'utf8');

      store.updateJob(job.id, {
        status: 'created',
        progressLabel: `Timings ready. Script match confidence: ${Math.round(review.summary.confidence * 100)}%.`,
        rawTimestamps,
        reviewedTimestamps: review.timestamps,
        scriptReview: review.summary,
        scriptReviewWords: review.words,
        scriptReviewExtraWords: review.extraWords,
        reviewedTimestampsPath,
      });
      return;
    }

    await writeFile(reviewedTimestampsPath, JSON.stringify(rawTimestamps, null, 2), 'utf8');

    store.updateJob(job.id, {
      status: 'created',
      progressLabel: 'Timings ready from Whisper transcript.',
      rawTimestamps,
      reviewedTimestamps: rawTimestamps,
      scriptReview: undefined,
      scriptReviewWords: undefined,
      scriptReviewExtraWords: undefined,
      reviewedTimestampsPath,
    });
  } catch (err) {
    if (store.getJob(initialJob.id)?.status === 'cancelled') {
      return;
    }

    store.updateJob(initialJob.id, {
      status: 'failed',
      progressLabel: 'Timing generation failed.',
      error: readableError(err),
    });
  }
}

async function renderJob(store: JobStore, initialJob: CaptionJob, request: RenderJobRequest): Promise<void> {
  try {
    const job = store.getJob(initialJob.id);
    if (!job?.inputPath || !job.metadata) {
      throw new Error('Job is missing uploaded video metadata.');
    }

    const timestamps = request.timestamps ?? job.reviewedTimestamps;
    if (!timestamps) {
      throw new Error('Generate timings or provide timestamp JSON before rendering.');
    }

    const assPath = store.assPathFor(job);
    const { outputPath, outputFileName } = store.outputPathFor(job);

    store.updateJob(job.id, {
      status: 'generating-subtitles',
      progressLabel: 'Generating subtitles...',
      assPath,
      outputPath,
      outputFileName,
      error: undefined,
    });

    const ass = generateAss(timestamps, {
      resolution: {
        width: job.metadata.width,
        height: job.metadata.height,
      },
      preset: request.preset ?? 'youtube',
      mode: request.mode ?? 'normal',
      style: request.style,
      keywords: request.keywords,
    });
    await mkdir(dirname(assPath), { recursive: true });
    await writeFile(assPath, ass, 'utf8');

    if (store.getJob(job.id)?.status === 'cancelled') {
      return;
    }

    store.updateJob(job.id, {
      status: 'rendering',
      progressLabel: 'Rendering captioned MP4...',
    });

    await renderBurnedInSubtitles({
      inputPath: job.inputPath,
      subtitlesPath: assPath,
      outputPath,
      quality: request.quality,
    });

    if (store.getJob(job.id)?.status === 'cancelled') {
      return;
    }

    store.updateJob(job.id, {
      status: 'complete',
      progressLabel: 'Render complete.',
      outputPath,
      outputFileName,
    });
  } catch (err) {
    if (store.getJob(initialJob.id)?.status === 'cancelled') {
      return;
    }

    store.updateJob(initialJob.id, {
      status: 'failed',
      progressLabel: 'Render failed.',
      error: readableError(err),
    });
  }
}

function updateAlignmentProgress(store: JobStore, jobId: string, message: string): void {
  const job = store.getJob(jobId);
  if (!job || job.status === 'cancelled') {
    return;
  }

  if (message.includes('[2/4]')) {
    store.updateJob(jobId, {
      status: 'transcribing',
      progressLabel: 'Transcribing audio with WhisperX...',
    });
  } else if (message.includes('[3/4]')) {
    store.updateJob(jobId, {
      status: 'aligning',
      progressLabel: 'Aligning words to audio...',
    });
  } else if (message.includes('[4/4]')) {
    store.updateJob(jobId, {
      status: 'reviewing-script',
      progressLabel: 'Preparing word timestamps...',
    });
  }
}

function languageLabel(language: string): string {
  switch (language) {
    case 'de':
      return 'German';
    case 'en':
      return 'English';
    default:
      return language;
  }
}

function applyCors(req: IncomingMessage, res: ServerResponse, origin: string | undefined): void {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-InkDrop-Token');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > JSON_LIMIT_BYTES) {
      throw new Error('JSON body is too large.');
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text) as T;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function readableError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
