import type {
  CaptionMode,
  CaptionPreset,
  CaptionStyle,
  RenderQuality,
  TimestampsFile,
  VideoMetadata,
  WordTimestamp,
} from '../subtitles/types.js';
import type { ScriptReviewSummary, ScriptReviewWord } from '../aligner/script-review.js';
import type { WhisperModel } from '../aligner/whisperx.js';

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

export interface CreateJobRequest {
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}

export interface RenderJobRequest {
  timestamps?: TimestampsFile;
  preset?: CaptionPreset;
  mode?: CaptionMode;
  style?: Partial<CaptionStyle>;
  keywords?: string[];
  quality?: Partial<RenderQuality>;
}

export interface AlignJobRequest {
  script?: string;
  language?: string;
  model?: WhisperModel;
}

export interface CaptionJob {
  id: string;
  status: JobStatus;
  progressLabel: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  inputPath?: string;
  audioPath?: string;
  assPath?: string;
  rawTimestampsPath?: string;
  reviewedTimestampsPath?: string;
  outputPath?: string;
  outputFileName?: string;
  metadata?: VideoMetadata;
  rawTimestamps?: TimestampsFile;
  reviewedTimestamps?: TimestampsFile;
  scriptReview?: ScriptReviewSummary;
  scriptReviewWords?: ScriptReviewWord[];
  scriptReviewExtraWords?: WordTimestamp[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicCaptionJob {
  id: string;
  status: JobStatus;
  progressLabel: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  outputFileName?: string;
  metadata?: VideoMetadata;
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

export interface HealthResponse {
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
