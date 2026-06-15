import { mkdir, rm } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import type { CaptionJob, CreateJobRequest, PublicCaptionJob } from './types.js';

export class JobStore {
  private readonly jobs = new Map<string, CaptionJob>();
  private readonly uploadsRoot: string;
  private readonly workRoot: string;
  private readonly outputRoot: string;

  constructor(private readonly rootDir: string) {
    this.uploadsRoot = resolve(rootDir, 'uploads');
    this.workRoot = resolve(rootDir, 'work');
    this.outputRoot = resolve(rootDir, 'output');
  }

  async createJob(request: CreateJobRequest): Promise<CaptionJob> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const fileName = sanitizeFileName(request.fileName, 'input.mp4');
    const job: CaptionJob = {
      id,
      status: 'created',
      progressLabel: 'Job created.',
      fileName,
      fileSize: request.fileSize,
      mimeType: request.mimeType,
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      mkdir(this.jobUploadsDir(id), { recursive: true }),
      mkdir(this.jobWorkDir(id), { recursive: true }),
      mkdir(this.jobOutputDir(id), { recursive: true }),
    ]);

    this.jobs.set(id, job);
    return job;
  }

  getJob(id: string): CaptionJob | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, update: Partial<Omit<CaptionJob, 'id' | 'createdAt'>>): CaptionJob {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Unknown job: ${id}`);
    }

    const next: CaptionJob = {
      ...job,
      ...update,
      updatedAt: Date.now(),
    };
    this.jobs.set(id, next);
    return next;
  }

  inputPathFor(job: CaptionJob, fileName = job.fileName): string {
    const safeName = sanitizeFileName(fileName, job.fileName);
    const extension = extname(safeName) || '.mp4';
    return assertInside(this.jobUploadsDir(job.id), join(this.jobUploadsDir(job.id), `input${extension}`));
  }

  assPathFor(job: CaptionJob): string {
    return assertInside(this.jobWorkDir(job.id), join(this.jobWorkDir(job.id), 'captions.ass'));
  }

  audioPathFor(job: CaptionJob): string {
    return assertInside(this.jobWorkDir(job.id), join(this.jobWorkDir(job.id), 'audio.wav'));
  }

  rawTimestampsPathFor(job: CaptionJob): string {
    return assertInside(this.jobWorkDir(job.id), join(this.jobWorkDir(job.id), 'raw-timestamps.json'));
  }

  reviewedTimestampsPathFor(job: CaptionJob): string {
    return assertInside(this.jobWorkDir(job.id), join(this.jobWorkDir(job.id), 'reviewed-timestamps.json'));
  }

  outputPathFor(job: CaptionJob): { outputPath: string; outputFileName: string } {
    const baseName = removeExtension(sanitizeFileName(job.fileName, 'video.mp4'));
    const outputFileName = `${baseName}-captioned.mp4`;
    return {
      outputFileName,
      outputPath: assertInside(this.jobOutputDir(job.id), join(this.jobOutputDir(job.id), outputFileName)),
    };
  }

  async cleanupJob(id: string): Promise<void> {
    await Promise.all([
      rm(this.jobUploadsDir(id), { recursive: true, force: true }),
      rm(this.jobWorkDir(id), { recursive: true, force: true }),
      rm(this.jobOutputDir(id), { recursive: true, force: true }),
    ]);
  }

  toPublicJob(job: CaptionJob): PublicCaptionJob {
    return {
      id: job.id,
      status: job.status,
      progressLabel: job.progressLabel,
      fileName: job.fileName,
      fileSize: job.fileSize,
      mimeType: job.mimeType,
      outputFileName: job.outputFileName,
      metadata: job.metadata,
      rawTimestamps: job.rawTimestamps,
      reviewedTimestamps: job.reviewedTimestamps,
      scriptReview: job.scriptReview,
      scriptReviewWords: job.scriptReviewWords,
      scriptReviewExtraWords: job.scriptReviewExtraWords,
      error: job.error,
      hasInput: Boolean(job.inputPath),
      hasTimestamps: Boolean(job.reviewedTimestamps),
      hasOutput: Boolean(job.outputPath && job.status === 'complete'),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private jobUploadsDir(id: string): string {
    return assertInside(this.uploadsRoot, join(this.uploadsRoot, id));
  }

  private jobWorkDir(id: string): string {
    return assertInside(this.workRoot, join(this.workRoot, id));
  }

  private jobOutputDir(id: string): string {
    return assertInside(this.outputRoot, join(this.outputRoot, id));
  }
}

export function sanitizeFileName(fileName: string, fallback: string): string {
  const normalized = fileName.replace(/\\/g, '/');
  const safe = basename(normalized)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return safe || fallback;
}

function removeExtension(fileName: string): string {
  const extension = extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function assertInside(root: string, candidate: string): string {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}\\`) && !resolvedCandidate.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`Path escaped job root: ${candidate}`);
  }
  return resolvedCandidate;
}
