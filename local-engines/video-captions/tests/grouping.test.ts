import { describe, expect, it } from 'vitest';
import { groupWordsIntoLines } from '../src/subtitles/grouping.js';
import { getPresetStyle } from '../src/subtitles/presets.js';
import type { WordTimestamp } from '../src/subtitles/types.js';

const words: WordTimestamp[] = [
  { word: 'Hallo', start: 0, end: 0.2 },
  { word: 'Welt!', start: 0.3, end: 0.5 },
  { word: 'Das', start: 0.8, end: 1.0 },
  { word: 'ist', start: 1.1, end: 1.3 },
  { word: 'gut.', start: 1.4, end: 1.8 },
];

describe('word grouping', () => {
  it('groups normal captions by sentence boundary', () => {
    const lines = groupWordsIntoLines(words, 'normal', getPresetStyle('youtube'));

    expect(lines).toHaveLength(2);
    expect(lines[0]?.text).toBe('Hallo Welt!');
    expect(lines[1]?.text).toBe('Das ist gut.');
  });

  it('groups phrase captions by max word count', () => {
    const lines = groupWordsIntoLines(words, 'phrase', {
      ...getPresetStyle('youtube'),
      maxWordsPerLine: 2,
    });

    expect(lines.map((line) => line.text)).toEqual(['Hallo Welt!', 'Das ist', 'gut.']);
  });

  it('uses phrase grouping for karaoke mode', () => {
    const lines = groupWordsIntoLines(words, 'karaoke', {
      ...getPresetStyle('shorts'),
      maxWordsPerLine: 3,
    });

    expect(lines.map((line) => line.words.length)).toEqual([3, 2]);
  });
});
