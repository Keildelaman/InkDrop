import type { CaptionMode, CaptionStyle, SubtitleLine, WordTimestamp } from './types.js';
import { escapeAssText } from './ass.js';

export function groupWordsIntoLines(words: WordTimestamp[], mode: CaptionMode, style: CaptionStyle): SubtitleLine[] {
  const validWords = words.filter(isUsableWord);

  if (mode === 'karaoke' || mode === 'phrase') {
    return groupByCount(validWords, Math.max(1, style.maxWordsPerLine));
  }

  if (mode === 'normal' || mode === 'keyword') {
    return groupBySentence(validWords, Math.max(1, style.maxWordsPerLine));
  }

  return groupByCount(validWords, 1);
}

export function joinWords(words: WordTimestamp[]): string {
  return words.map((word) => escapeAssText(word.word)).join(' ');
}

function groupByCount(words: WordTimestamp[], maxWords: number): SubtitleLine[] {
  const lines: SubtitleLine[] = [];

  for (let index = 0; index < words.length; index += maxWords) {
    const group = words.slice(index, index + maxWords);
    const first = group[0];
    const last = group.at(-1);
    if (!first || !last) {
      continue;
    }

    lines.push({
      text: joinWords(group),
      startTime: first.start,
      endTime: last.end,
      words: group,
    });
  }

  return lines;
}

function groupBySentence(words: WordTimestamp[], maxWords: number): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  let current: WordTimestamp[] = [];

  for (const word of words) {
    current.push(word);

    if (isSentenceEnd(word.word) || current.length >= maxWords) {
      lines.push(toLine(current));
      current = [];
    }
  }

  if (current.length > 0) {
    lines.push(toLine(current));
  }

  return lines;
}

function toLine(words: WordTimestamp[]): SubtitleLine {
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last) {
    throw new Error('Cannot create subtitle line from empty word group');
  }

  return {
    text: joinWords(words),
    startTime: first.start,
    endTime: last.end,
    words,
  };
}

function isUsableWord(word: WordTimestamp): boolean {
  return typeof word.word === 'string' && word.word.trim().length > 0 && isFiniteTimestamp(word.start) && isFiniteTimestamp(word.end) && word.end >= word.start;
}

function isFiniteTimestamp(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isSentenceEnd(word: string): boolean {
  return /[.!?]$/.test(word.trim());
}
