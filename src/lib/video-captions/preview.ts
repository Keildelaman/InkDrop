import type { CaptionMode, TimestampsFile, WordTimestamp } from './client.js';

export type CaptionReviewIssueKind = 'changed' | 'missing' | 'extra';
export type CaptionReviewDecision = 'script' | 'whisper' | 'custom' | 'remove' | 'ignore' | 'insert';

export interface CaptionReviewIssue {
  id: string;
  kind: CaptionReviewIssueKind;
  start: number;
  end: number;
  wordIndex?: number;
  extraIndex?: number;
  scriptWord: string;
  whisperWord: string;
  customText: string;
  decision?: CaptionReviewDecision;
}

export interface CaptionPreviewWord extends WordTimestamp {
  issueIds: string[];
  sourceIndex?: number;
}

export interface CaptionPreviewExtraMarker {
  issueId: string;
  word: string;
  start: number;
  end: number;
}

export interface CaptionPreviewSection {
  id: string;
  start: number;
  end: number;
  words: CaptionPreviewWord[];
  issueIds: string[];
  extraMarkers: CaptionPreviewExtraMarker[];
}

interface CaptionPreviewOptions {
  mode: CaptionMode;
  maxWordsPerLine: number;
}

export function buildEditedTimestamps(base: TimestampsFile, issues: CaptionReviewIssue[]): TimestampsFile {
  const words = buildPreviewWords(base, issues).map(({ issueIds: _issueIds, sourceIndex: _sourceIndex, ...word }) => word);

  return {
    ...base,
    wordCount: words.length,
    words,
  };
}

export function buildCaptionPreviewSections(
  base: TimestampsFile,
  issues: CaptionReviewIssue[],
  options: CaptionPreviewOptions
): CaptionPreviewSection[] {
  const sections = groupPreviewWords(buildPreviewWords(base, issues), options);
  const issueOrder = new Map(issues.map((issue, index) => [issue.id, index]));

  for (const issue of issues) {
    const section = findSectionForIssue(sections, issue);
    if (!section) {
      continue;
    }

    addUnique(section.issueIds, issue.id);
    if (issue.kind === 'extra' && !section.words.some((word) => word.issueIds.includes(issue.id))) {
      section.extraMarkers.push({
        issueId: issue.id,
        word: issue.whisperWord || issue.customText,
        start: issue.start,
        end: issue.end,
      });
    }
  }

  return sections.map((section) => ({
    ...section,
    issueIds: section.issueIds.sort((a, b) => (issueOrder.get(a) ?? 0) - (issueOrder.get(b) ?? 0)),
    extraMarkers: section.extraMarkers.sort((a, b) => a.start - b.start || a.end - b.end),
  }));
}

function buildPreviewWords(base: TimestampsFile, issues: CaptionReviewIssue[]): CaptionPreviewWord[] {
  const replacements = new Map<number, string>();
  const removed = new Set<number>();
  const wordIssues = new Map<number, string[]>();
  const additions: CaptionPreviewWord[] = [];

  for (const issue of issues) {
    if (issue.wordIndex !== undefined && issue.kind !== 'extra') {
      const ids = wordIssues.get(issue.wordIndex) ?? [];
      ids.push(issue.id);
      wordIssues.set(issue.wordIndex, ids);
    }

    if (issue.kind === 'changed' && issue.wordIndex !== undefined) {
      if (issue.decision === 'whisper' && issue.whisperWord.trim()) {
        replacements.set(issue.wordIndex, issue.whisperWord.trim());
      }
      if (issue.decision === 'custom' && issue.customText.trim()) {
        replacements.set(issue.wordIndex, issue.customText.trim());
      }
    }

    if (issue.kind === 'missing' && issue.wordIndex !== undefined) {
      if (issue.decision === 'remove') {
        removed.add(issue.wordIndex);
      }
      if (issue.decision === 'custom' && issue.customText.trim()) {
        replacements.set(issue.wordIndex, issue.customText.trim());
      }
    }

    if (issue.kind === 'extra') {
      if (issue.decision === 'insert' && issue.whisperWord.trim()) {
        additions.push(previewWordFromIssue(issue, issue.whisperWord.trim()));
      }
      if (issue.decision === 'custom' && issue.customText.trim()) {
        additions.push(previewWordFromIssue(issue, issue.customText.trim()));
      }
    }
  }

  const baseWords: CaptionPreviewWord[] = base.words
    .map((word, index) => ({
      ...word,
      word: replacements.get(index) ?? word.word,
      issueIds: wordIssues.get(index) ?? [],
      sourceIndex: index,
    }))
    .filter((_, index) => !removed.has(index));

  return [...baseWords, ...additions]
    .sort((a, b) => a.start - b.start || a.end - b.end || (a.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (b.sourceIndex ?? Number.MAX_SAFE_INTEGER));
}

function previewWordFromIssue(issue: CaptionReviewIssue, word: string): CaptionPreviewWord {
  return {
    word,
    start: issue.start,
    end: issue.end,
    issueIds: [issue.id],
  };
}

function groupPreviewWords(words: CaptionPreviewWord[], options: CaptionPreviewOptions): CaptionPreviewSection[] {
  const usableWords = words.filter(isUsableWord);
  const maxWords = Math.max(1, Math.floor(options.maxWordsPerLine || 1));

  if (options.mode === 'karaoke' || options.mode === 'phrase') {
    return groupByCount(usableWords, maxWords);
  }

  return groupBySentence(usableWords, maxWords);
}

function groupByCount(words: CaptionPreviewWord[], maxWords: number): CaptionPreviewSection[] {
  const sections: CaptionPreviewSection[] = [];
  for (let index = 0; index < words.length; index += maxWords) {
    const group = words.slice(index, index + maxWords);
    const section = toSection(group, sections.length);
    if (section) sections.push(section);
  }
  return sections;
}

function groupBySentence(words: CaptionPreviewWord[], maxWords: number): CaptionPreviewSection[] {
  const sections: CaptionPreviewSection[] = [];
  let current: CaptionPreviewWord[] = [];

  for (const word of words) {
    current.push(word);
    if (isSentenceEnd(word.word) || current.length >= maxWords) {
      const section = toSection(current, sections.length);
      if (section) sections.push(section);
      current = [];
    }
  }

  const section = toSection(current, sections.length);
  if (section) sections.push(section);
  return sections;
}

function toSection(words: CaptionPreviewWord[], index: number): CaptionPreviewSection | null {
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last) {
    return null;
  }

  const issueIds: string[] = [];
  for (const word of words) {
    for (const issueId of word.issueIds) {
      addUnique(issueIds, issueId);
    }
  }

  return {
    id: `section-${index}`,
    start: first.start,
    end: last.end,
    words,
    issueIds,
    extraMarkers: [],
  };
}

function findSectionForIssue(sections: CaptionPreviewSection[], issue: CaptionReviewIssue): CaptionPreviewSection | undefined {
  if (issue.wordIndex !== undefined) {
    const sectionByWord = sections.find((section) =>
      section.words.some((word) => word.sourceIndex === issue.wordIndex || word.issueIds.includes(issue.id))
    );
    if (sectionByWord) {
      return sectionByWord;
    }
  }

  const sectionByRange = sections.find((section) => issue.start >= section.start && issue.start <= section.end);
  if (sectionByRange) {
    return sectionByRange;
  }

  return sections
    .map((section) => ({ section, distance: distanceToSection(issue.start, section) }))
    .sort((a, b) => a.distance - b.distance)[0]?.section;
}

function distanceToSection(time: number, section: CaptionPreviewSection): number {
  if (time >= section.start && time <= section.end) {
    return 0;
  }
  return Math.min(Math.abs(time - section.start), Math.abs(time - section.end));
}

function addUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
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
