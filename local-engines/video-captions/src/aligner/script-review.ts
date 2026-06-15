import type { TimestampsFile, WordTimestamp } from '../subtitles/types.js';

export type ReviewWordStatus = 'matched' | 'changed' | 'missing';

export interface ScriptReviewWord extends WordTimestamp {
  status: ReviewWordStatus;
  transcriptWord?: string;
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

export interface ScriptReviewResult {
  timestamps: TimestampsFile;
  summary: ScriptReviewSummary;
  words: ScriptReviewWord[];
  extraWords: WordTimestamp[];
}

interface ScriptToken {
  word: string;
  normalized: string;
}

interface TranscriptToken extends ScriptToken {
  timestamp: WordTimestamp;
}

export function reviewScriptAgainstTranscript(
  script: string,
  transcript: TimestampsFile,
  language = transcript.language || 'de'
): ScriptReviewResult {
  const scriptTokens = tokenizeScript(script);
  if (scriptTokens.length === 0) {
    throw new Error('Script is empty.');
  }

  const transcriptTokens = transcript.words
    .map((timestamp) => ({
      word: timestamp.word,
      normalized: normalizeGermanWord(timestamp.word),
      timestamp,
    }))
    .filter((token) => token.normalized.length > 0);

  const matches = longestCommonSubsequence(
    scriptTokens.map((token) => token.normalized),
    transcriptTokens.map((token) => token.normalized)
  );

  const reviewedWords: ScriptReviewWord[] = [];
  const extraWords: WordTimestamp[] = [];
  let matched = 0;
  let changed = 0;
  let missing = 0;
  let extra = 0;
  let scriptCursor = 0;
  let transcriptCursor = 0;

  for (const match of matches) {
    const scriptGap = scriptTokens.slice(scriptCursor, match.scriptIndex);
    const transcriptGap = transcriptTokens.slice(transcriptCursor, match.transcriptIndex);
    const reviewedGap = mapGap(scriptGap, transcriptGap, previousEnd(reviewedWords), transcriptTokens[match.transcriptIndex]?.timestamp.start);
    reviewedWords.push(...reviewedGap.words);
    extraWords.push(...reviewedGap.extraWords);
    changed += reviewedGap.changed;
    missing += reviewedGap.missing;
    extra += reviewedGap.extra;

    const scriptToken = scriptTokens[match.scriptIndex];
    const transcriptToken = transcriptTokens[match.transcriptIndex];
    if (scriptToken && transcriptToken) {
      reviewedWords.push({
        word: scriptToken.word,
        start: transcriptToken.timestamp.start,
        end: transcriptToken.timestamp.end,
        status: 'matched',
        transcriptWord: transcriptToken.word,
      });
      matched += 1;
    }

    scriptCursor = match.scriptIndex + 1;
    transcriptCursor = match.transcriptIndex + 1;
  }

  const trailingGap = mapGap(
    scriptTokens.slice(scriptCursor),
    transcriptTokens.slice(transcriptCursor),
    previousEnd(reviewedWords),
    undefined
  );
  reviewedWords.push(...trailingGap.words);
  extraWords.push(...trailingGap.extraWords);
  changed += trailingGap.changed;
  missing += trailingGap.missing;
  extra += trailingGap.extra;

  const reviewedTimestamps: TimestampsFile = {
    totalDuration: transcript.totalDuration,
    wordCount: reviewedWords.length,
    language,
    words: reviewedWords.map(({ word, start, end }) => ({ word, start, end })),
  };

  const denominator = Math.max(scriptTokens.length, transcriptTokens.length, 1);
  const confidence = Number((matched / denominator).toFixed(3));
  const warnings: string[] = [];
  if (confidence < 0.65) {
    warnings.push('Low script match confidence. Review the transcript before rendering.');
  }
  if (missing > 0) {
    warnings.push(`${missing} script words were estimated without matching audio words.`);
  }
  if (extra > 0) {
    warnings.push(`${extra} detected audio words were not present in the script.`);
  }

  return {
    timestamps: reviewedTimestamps,
    words: reviewedWords,
    extraWords,
    summary: {
      confidence,
      matched,
      changed,
      missing,
      extra,
      scriptWordCount: scriptTokens.length,
      transcriptWordCount: transcriptTokens.length,
      reviewedWordCount: reviewedWords.length,
      warnings,
    },
  };
}

export function tokenizeScript(script: string): ScriptToken[] {
  return script
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => ({ word, normalized: normalizeGermanWord(word) }))
    .filter((token) => token.normalized.length > 0);
}

export function normalizeGermanWord(word: string): string {
  return word
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/ß/g, 'ss')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function mapGap(
  scriptGap: ScriptToken[],
  transcriptGap: TranscriptToken[],
  previousTime: number,
  nextTime: number | undefined
): { words: ScriptReviewWord[]; extraWords: WordTimestamp[]; changed: number; missing: number; extra: number } {
  if (scriptGap.length === 0) {
    return {
      words: [],
      extraWords: transcriptGap.map((token) => ({ ...token.timestamp })),
      changed: 0,
      missing: 0,
      extra: transcriptGap.length,
    };
  }

  if (transcriptGap.length === 0) {
    const words = estimateMissingWords(scriptGap, previousTime, nextTime);
    return {
      words,
      extraWords: [],
      changed: 0,
      missing: scriptGap.length,
      extra: 0,
    };
  }

  const firstStart = transcriptGap[0]?.timestamp.start ?? previousTime;
  const lastEnd = transcriptGap.at(-1)?.timestamp.end ?? nextTime ?? firstStart + scriptGap.length * 0.25;
  const span = Math.max(0.05, lastEnd - firstStart);
  const words = scriptGap.map((scriptToken, index) => {
    const matchingTranscript = transcriptGap[index]?.timestamp;
    if (matchingTranscript) {
      return {
        word: scriptToken.word,
        start: matchingTranscript.start,
        end: matchingTranscript.end,
        status: 'changed' as const,
        transcriptWord: transcriptGap[index]?.word,
      };
    }

    const start = firstStart + (span * index) / scriptGap.length;
    const end = firstStart + (span * (index + 1)) / scriptGap.length;
    return {
      word: scriptToken.word,
      start: roundTime(start),
      end: roundTime(Math.max(start + 0.05, end)),
      status: 'missing' as const,
    };
  });

  return {
    words,
    extraWords: transcriptGap.slice(scriptGap.length).map((token) => ({ ...token.timestamp })),
    changed: Math.min(scriptGap.length, transcriptGap.length),
    missing: Math.max(0, scriptGap.length - transcriptGap.length),
    extra: Math.max(0, transcriptGap.length - scriptGap.length),
  };
}

function estimateMissingWords(
  scriptGap: ScriptToken[],
  previousTime: number,
  nextTime: number | undefined
): ScriptReviewWord[] {
  const start = previousTime;
  const end = nextTime !== undefined && nextTime > start ? nextTime : start + scriptGap.length * 0.3;
  const span = Math.max(0.05 * scriptGap.length, end - start);

  return scriptGap.map((token, index) => {
    const wordStart = start + (span * index) / scriptGap.length;
    const wordEnd = start + (span * (index + 1)) / scriptGap.length;
    return {
      word: token.word,
      start: roundTime(wordStart),
      end: roundTime(Math.max(wordStart + 0.05, wordEnd)),
      status: 'missing',
    };
  });
}

function previousEnd(words: ScriptReviewWord[]): number {
  return words.at(-1)?.end ?? 0;
}

function longestCommonSubsequence(
  script: string[],
  transcript: string[]
): Array<{ scriptIndex: number; transcriptIndex: number }> {
  const cols = transcript.length + 1;
  const table = new Uint16Array((script.length + 1) * cols);

  for (let row = script.length - 1; row >= 0; row -= 1) {
    for (let col = transcript.length - 1; col >= 0; col -= 1) {
      const index = row * cols + col;
      if (script[row] === transcript[col]) {
        table[index] = table[(row + 1) * cols + col + 1] + 1;
      } else {
        table[index] = Math.max(table[(row + 1) * cols + col], table[row * cols + col + 1]);
      }
    }
  }

  const matches: Array<{ scriptIndex: number; transcriptIndex: number }> = [];
  let row = 0;
  let col = 0;
  while (row < script.length && col < transcript.length) {
    if (script[row] === transcript[col]) {
      matches.push({ scriptIndex: row, transcriptIndex: col });
      row += 1;
      col += 1;
    } else if (table[(row + 1) * cols + col] >= table[row * cols + col + 1]) {
      row += 1;
    } else {
      col += 1;
    }
  }

  return matches;
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
