import { describe, expect, it } from 'vitest';
import { generateAss, normalizeKeyword, validateTimestamps } from '../src/subtitles/generator.js';
import type { TimestampsFile } from '../src/subtitles/types.js';

const timestamps: TimestampsFile = {
  totalDuration: 3,
  wordCount: 4,
  language: 'de',
  words: [
    { word: 'Hallo', start: 0, end: 0.4 },
    { word: 'Welt!', start: 0.5, end: 1 },
    { word: '\u00dcberpr\u00fcfe', start: 1.2, end: 1.8 },
    { word: 'Keywords.', start: 1.9, end: 2.5 },
  ],
};

describe('ASS generator', () => {
  it('generates a complete ASS file', () => {
    const ass = generateAss(timestamps, {
      resolution: { width: 1920, height: 1080 },
      preset: 'youtube',
      mode: 'normal',
    });

    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('PlayResX: 1920');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('[Events]');
    expect(ass).toContain('Hallo Welt!');
  });

  it('creates per-word dialogue events for karaoke mode', () => {
    const ass = generateAss(timestamps, {
      resolution: { width: 1080, height: 1920 },
      preset: 'shorts',
      mode: 'karaoke',
    });

    const dialogueCount = ass.split('\n').filter((line) => line.startsWith('Dialogue:')).length;
    expect(dialogueCount).toBe(timestamps.words.length);
    expect(ass).toContain('{\\1c&H0066FF00}');
  });

  it('highlights exact normalized keyword matches', () => {
    const ass = generateAss(timestamps, {
      resolution: { width: 1920, height: 1080 },
      preset: 'youtube',
      mode: 'keyword',
      keywords: ['keywords'],
    });

    expect(ass).toContain('{\\1c&H0000D4FF}Keywords.{\\r}');
    expect(ass).not.toContain('{\\1c&H0000D4FF}Hallo{\\r}');
  });

  it('normalizes German keyword punctuation and casing', () => {
    expect(normalizeKeyword('\u00dcberpr\u00fcfe!')).toBe('\u00fcberpr\u00fcfe');
  });

  it('validates timestamp objects', () => {
    expect(() => validateTimestamps({ words: [{ word: 'bad', start: 2, end: 1 }] })).toThrow('bad timing');
  });
});
