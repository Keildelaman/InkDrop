import { describe, expect, it } from 'vitest';
import { buildBurnInArgs, escapeSubtitleFilterPath } from '../src/ffmpeg/render.js';
import { parseFrameRate } from '../src/ffmpeg/probe.js';
import { buildExtractAudioArgs } from '../src/ffmpeg/audio.js';

describe('FFmpeg helpers', () => {
  it('escapes Windows subtitle paths for the subtitles filter', () => {
    expect(escapeSubtitleFilterPath('C:\\Users\\Manuel\\Video Captions\\sample.ass')).toBe(
      'C\\:/Users/Manuel/Video Captions/sample.ass'
    );
  });

  it('builds burn-in arguments with high-quality defaults', () => {
    const args = buildBurnInArgs({
      inputPath: 'input.mp4',
      subtitlesPath: 'C:\\tmp\\sample.ass',
      outputPath: 'output.mp4',
    });

    expect(args).toContain('-vf');
    expect(args).toContain("subtitles='C\\:/tmp/sample.ass'");
    expect(args).toContain('libx264');
    expect(args).toContain('18');
    expect(args).toContain('0:a?');
  });

  it('parses rational frame rates', () => {
    expect(parseFrameRate('30/1')).toBe(30);
    expect(parseFrameRate('30000/1001')).toBeCloseTo(29.97, 2);
    expect(parseFrameRate('0/0')).toBe(0);
  });

  it('builds mono 16kHz WAV extraction arguments for WhisperX', () => {
    expect(buildExtractAudioArgs({
      inputPath: 'input.mp4',
      outputPath: 'audio.wav',
    })).toEqual([
      '-y',
      '-i',
      'input.mp4',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      'audio.wav',
    ]);
  });
});
