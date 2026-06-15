import { describe, expect, it } from 'vitest';
import {
  buildCaptionPreviewSections,
  buildEditedTimestamps,
  type CaptionReviewIssue,
} from '../../../src/lib/video-captions/preview.js';
import type { TimestampsFile } from '../../../src/lib/video-captions/client.js';

const timestamps: TimestampsFile = {
  totalDuration: 8,
  wordCount: 9,
  language: 'de',
  words: [
    { word: 'Das', start: 0, end: 0.2 },
    { word: 'ist', start: 0.25, end: 0.45 },
    { word: 'ein', start: 0.5, end: 0.7 },
    { word: 'Test.', start: 0.75, end: 1.2 },
    { word: 'Noch', start: 1.6, end: 1.9 },
    { word: 'ein', start: 2, end: 2.2 },
    { word: 'wichtiger', start: 2.3, end: 2.8 },
    { word: 'Satz', start: 2.9, end: 3.2 },
    { word: 'hier', start: 3.3, end: 3.7 },
  ],
};

describe('caption review preview', () => {
  it('groups phrase and karaoke previews by max word count', () => {
    const sections = buildCaptionPreviewSections(timestamps, [], {
      mode: 'phrase',
      maxWordsPerLine: 3,
    });

    expect(sections.map((section) => section.words.map((word) => word.word))).toEqual([
      ['Das', 'ist', 'ein'],
      ['Test.', 'Noch', 'ein'],
      ['wichtiger', 'Satz', 'hier'],
    ]);
  });

  it('groups normal and keyword previews by sentence end or max word count', () => {
    const sections = buildCaptionPreviewSections(timestamps, [], {
      mode: 'normal',
      maxWordsPerLine: 6,
    });

    expect(sections.map((section) => section.words.map((word) => word.word))).toEqual([
      ['Das', 'ist', 'ein', 'Test.'],
      ['Noch', 'ein', 'wichtiger', 'Satz', 'hier'],
    ]);
  });

  it('attaches changed and missing issues to the matching caption section', () => {
    const issues: CaptionReviewIssue[] = [
      {
        id: 'changed-2',
        kind: 'changed',
        wordIndex: 2,
        start: 0.5,
        end: 0.7,
        scriptWord: 'ein',
        whisperWord: 'eine',
        customText: 'ein',
      },
      {
        id: 'missing-6',
        kind: 'missing',
        wordIndex: 6,
        start: 2.3,
        end: 2.8,
        scriptWord: 'wichtiger',
        whisperWord: '',
        customText: 'wichtiger',
      },
    ];

    const sections = buildCaptionPreviewSections(timestamps, issues, {
      mode: 'normal',
      maxWordsPerLine: 6,
    });

    expect(sections[0]?.issueIds).toEqual(['changed-2']);
    expect(sections[0]?.words.find((word) => word.word === 'ein')?.issueIds).toEqual(['changed-2']);
    expect(sections[1]?.issueIds).toEqual(['missing-6']);
    expect(sections[1]?.words.find((word) => word.word === 'wichtiger')?.issueIds).toEqual(['missing-6']);
  });

  it('keeps multiple issues inside one caption section', () => {
    const issues: CaptionReviewIssue[] = [
      {
        id: 'changed-1',
        kind: 'changed',
        wordIndex: 1,
        start: 0.25,
        end: 0.45,
        scriptWord: 'ist',
        whisperWord: 'isst',
        customText: 'ist',
      },
      {
        id: 'changed-2',
        kind: 'changed',
        wordIndex: 2,
        start: 0.5,
        end: 0.7,
        scriptWord: 'ein',
        whisperWord: 'eine',
        customText: 'ein',
      },
    ];

    const sections = buildCaptionPreviewSections(timestamps, issues, {
      mode: 'normal',
      maxWordsPerLine: 6,
    });

    expect(sections[0]?.issueIds).toEqual(['changed-1', 'changed-2']);
  });

  it('places unresolved extra audio near the closest caption section', () => {
    const issues: CaptionReviewIssue[] = [
      {
        id: 'extra-0',
        kind: 'extra',
        extraIndex: 0,
        start: 2.25,
        end: 2.35,
        scriptWord: '',
        whisperWord: 'ähm',
        customText: 'ähm',
      },
    ];

    const sections = buildCaptionPreviewSections(timestamps, issues, {
      mode: 'normal',
      maxWordsPerLine: 6,
    });

    expect(sections[1]?.issueIds).toEqual(['extra-0']);
    expect(sections[1]?.extraMarkers).toEqual([
      { issueId: 'extra-0', word: 'ähm', start: 2.25, end: 2.35 },
    ]);
  });

  it('updates edited timestamps for resolved decisions', () => {
    const issues: CaptionReviewIssue[] = [
      {
        id: 'changed-2',
        kind: 'changed',
        wordIndex: 2,
        start: 0.5,
        end: 0.7,
        scriptWord: 'ein',
        whisperWord: 'eine',
        customText: 'ein',
        decision: 'whisper',
      },
      {
        id: 'missing-6',
        kind: 'missing',
        wordIndex: 6,
        start: 2.3,
        end: 2.8,
        scriptWord: 'wichtiger',
        whisperWord: '',
        customText: 'wichtiger',
        decision: 'remove',
      },
      {
        id: 'extra-0',
        kind: 'extra',
        extraIndex: 0,
        start: 2.25,
        end: 2.35,
        scriptWord: '',
        whisperWord: 'ähm',
        customText: 'ähm',
        decision: 'insert',
      },
    ];

    const edited = buildEditedTimestamps(timestamps, issues);

    expect(edited.words.map((word) => word.word)).toEqual([
      'Das',
      'ist',
      'eine',
      'Test.',
      'Noch',
      'ein',
      'ähm',
      'Satz',
      'hier',
    ]);
    expect(edited.wordCount).toBe(9);
  });
});
