import {
  buildAnimationTags,
  buildAssFile,
  buildDialogue,
  buildSimpleEvent,
  escapeAssText,
  hexToAssColor,
} from './ass.js';
import { groupWordsIntoLines, joinWords } from './grouping.js';
import { adaptStyleToResolution, getPresetStyle } from './presets.js';
import type {
  CaptionMode,
  CaptionStyle,
  GenerateAssOptions,
  SubtitleLine,
  TimestampsFile,
  WordTimestamp,
} from './types.js';

export function generateAss(timestamps: TimestampsFile, options: GenerateAssOptions): string {
  const validated = validateTimestamps(timestamps);
  const mode = options.mode ?? 'normal';
  const style = adaptStyleToResolution(getPresetStyle(options.preset, options.style), options.resolution);
  const lines = groupWordsIntoLines(validated.words, mode, style);
  const dialogues = lines.flatMap((line) => buildDialogueEvents(line, mode, style, options.keywords ?? []));

  return buildAssFile(options.resolution, style, dialogues);
}

export function validateTimestamps(data: unknown): TimestampsFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid timestamps: expected object');
  }

  const candidate = data as Partial<TimestampsFile>;
  if (!Array.isArray(candidate.words)) {
    throw new Error('Invalid timestamps: missing words array');
  }

  const words = candidate.words.map(validateWordTimestamp);
  return {
    totalDuration: typeof candidate.totalDuration === 'number' ? candidate.totalDuration : words.at(-1)?.end ?? 0,
    wordCount: typeof candidate.wordCount === 'number' ? candidate.wordCount : words.length,
    language: typeof candidate.language === 'string' ? candidate.language : 'de',
    words,
  };
}

export function normalizeKeyword(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function buildDialogueEvents(
  line: SubtitleLine,
  mode: CaptionMode,
  style: CaptionStyle,
  keywords: string[]
): string[] {
  if (mode === 'karaoke') {
    return buildKaraokeEvents(line, style);
  }

  if (mode === 'keyword') {
    return [buildSimpleEvent(line, style, buildKeywordText(line.words, style.highlightColor, keywords))];
  }

  return [buildSimpleEvent(line, style)];
}

function buildKaraokeEvents(line: SubtitleLine, style: CaptionStyle): string[] {
  const events: string[] = [];
  const highlightColor = hexToAssColor(style.highlightColor);

  for (let index = 0; index < line.words.length; index += 1) {
    const currentWord = line.words[index];
    if (!currentWord) {
      continue;
    }

    const text = line.words
      .map((word, wordIndex) => {
        const safeWord = escapeAssText(word.word);
        return wordIndex === index ? `{\\1c${highlightColor}}${safeWord}{\\r}` : safeWord;
      })
      .join(' ');

    const nextWord = line.words[index + 1];
    const endTime = nextWord ? nextWord.start : line.endTime;
    const animatedText = index === 0 ? `${buildAnimationTags(style)}${text}` : text;
    events.push(buildDialogue(currentWord.start, Math.max(currentWord.start, endTime), animatedText));
  }

  return events;
}

function buildKeywordText(words: WordTimestamp[], highlightColor: string, keywords: string[]): string {
  const normalizedKeywords = new Set(keywords.map(normalizeKeyword).filter(Boolean));
  if (normalizedKeywords.size === 0) {
    return joinWords(words);
  }

  const assColor = hexToAssColor(highlightColor);
  return words
    .map((word) => {
      const safeWord = escapeAssText(word.word);
      return normalizedKeywords.has(normalizeKeyword(word.word)) ? `{\\1c${assColor}}${safeWord}{\\r}` : safeWord;
    })
    .join(' ');
}

function validateWordTimestamp(word: unknown): WordTimestamp {
  if (!word || typeof word !== 'object') {
    throw new Error('Invalid timestamps: word entry must be an object');
  }

  const candidate = word as Partial<WordTimestamp>;
  if (typeof candidate.word !== 'string' || typeof candidate.start !== 'number' || typeof candidate.end !== 'number') {
    throw new Error('Invalid timestamps: word entries need word, start, and end');
  }

  if (!Number.isFinite(candidate.start) || !Number.isFinite(candidate.end) || candidate.start < 0 || candidate.end < candidate.start) {
    throw new Error(`Invalid timestamps: bad timing for word "${candidate.word}"`);
  }

  return {
    word: candidate.word,
    start: candidate.start,
    end: candidate.end,
  };
}
