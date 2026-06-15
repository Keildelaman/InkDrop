import { describe, expect, it } from 'vitest';
import {
  normalizeGermanWord,
  reviewScriptAgainstTranscript,
  tokenizeScript,
} from '../src/aligner/script-review.js';
import type { TimestampsFile } from '../src/subtitles/types.js';

const transcript: TimestampsFile = {
  totalDuration: 3,
  wordCount: 5,
  language: 'de',
  words: [
    { word: 'Hallo', start: 0, end: 0.4 },
    { word: 'und', start: 0.5, end: 0.7 },
    { word: 'schon', start: 0.8, end: 1.1 },
    { word: 'da', start: 1.2, end: 1.4 },
    { word: 'bist', start: 1.5, end: 1.8 },
  ],
};

describe('script review', () => {
  it('normalizes German casing, punctuation, and sharp s', () => {
    expect(normalizeGermanWord(' Straße! ')).toBe('strasse');
    expect(normalizeGermanWord('SCHÖN,')).toBe('schön');
  });

  it('tokenizes script words while keeping display punctuation', () => {
    expect(tokenizeScript('Hallo, schön!').map((token) => token.word)).toEqual(['Hallo,', 'schön!']);
  });

  it('uses script text where transcript words differ', () => {
    const result = reviewScriptAgainstTranscript('Hallo und schön da bist!', transcript, 'de');

    expect(result.timestamps.words.map((word) => word.word)).toEqual(['Hallo', 'und', 'schön', 'da', 'bist!']);
    expect(result.summary.matched).toBe(4);
    expect(result.summary.changed).toBe(1);
    expect(result.summary.confidence).toBe(0.8);
  });

  it('estimates script words that are missing from the transcript', () => {
    const result = reviewScriptAgainstTranscript('Hallo lieber Mensch und schön da bist!', transcript, 'de');

    expect(result.summary.missing).toBeGreaterThan(0);
    expect(result.timestamps.words.map((word) => word.word)).toContain('lieber');
    expect(result.summary.warnings.some((warning) => warning.includes('estimated'))).toBe(true);
  });

  it('returns detailed changed, missing, and extra words', () => {
    const changed = reviewScriptAgainstTranscript('Hallo und schoen da bist', transcript, 'de');
    expect(changed.words.find((word) => word.status === 'changed')).toMatchObject({
      word: 'schoen',
      transcriptWord: 'schon',
    });

    const missing = reviewScriptAgainstTranscript('Hallo sehr wichtig und schon da bist', transcript, 'de');
    expect(missing.words.filter((word) => word.status === 'missing').map((word) => word.word)).toEqual(['sehr', 'wichtig']);

    const extra = reviewScriptAgainstTranscript('Hallo da bist', transcript, 'de');
    expect(extra.extraWords.map((word) => word.word)).toEqual(['und', 'schon']);
    expect(extra.summary.extra).toBe(2);
  });
});
