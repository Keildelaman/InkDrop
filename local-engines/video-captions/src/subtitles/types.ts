export type CaptionMode = 'normal' | 'phrase' | 'karaoke' | 'keyword';

export type CaptionPreset = 'youtube' | 'shorts' | 'minimal';

export type CaptionPosition = 'top' | 'center' | 'bottom';

export type CaptionAnimation = 'none' | 'pop' | 'fade';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TimestampsFile {
  totalDuration: number;
  wordCount: number;
  language: string;
  words: WordTimestamp[];
}

export interface Resolution {
  width: number;
  height: number;
}

export interface CaptionStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowDepth: number;
  position: CaptionPosition;
  marginH: number;
  marginV: number;
  animation: CaptionAnimation;
  maxWordsPerLine: number;
  adaptToAspect: boolean;
}

export interface SubtitleLine {
  text: string;
  startTime: number;
  endTime: number;
  words: WordTimestamp[];
}

export interface GenerateAssOptions {
  resolution: Resolution;
  preset?: CaptionPreset;
  mode?: CaptionMode;
  style?: Partial<CaptionStyle>;
  keywords?: string[];
}

export interface RenderQuality {
  crf: number;
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
}

export interface VideoMetadata {
  width: number;
  height: number;
  frameRate: number;
  duration: number;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio: boolean;
}

export interface BurnInOptions {
  inputPath: string;
  subtitlesPath: string;
  outputPath: string;
  quality?: Partial<RenderQuality>;
}
