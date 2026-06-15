import { describe, expect, it } from 'vitest';
import { adaptStyleToResolution, getPresetStyle } from '../src/subtitles/presets.js';

describe('caption presets', () => {
  it('uses readable YouTube defaults with a title-safe bottom margin', () => {
    const style = getPresetStyle('youtube');

    expect(style.fontName).toBe('Arial');
    expect(style.primaryColor).toBe('#FFFFFF');
    expect(style.highlightColor).toBe('#FFD400');
    expect(style.position).toBe('bottom');
    expect(style.fontSize).toBe(48);
    expect(style.maxWordsPerLine).toBe(9);
    expect(style.marginV).toBe(72);
  });

  it('uses compact karaoke defaults for Shorts', () => {
    const style = getPresetStyle('shorts');

    expect(style.fontName).toBe('Arial');
    expect(style.fontSize).toBe(68);
    expect(style.highlightColor).toBe('#00FF66');
    expect(style.position).toBe('center');
    expect(style.maxWordsPerLine).toBe(3);
  });

  it('adapts portrait videos for shorts-style captions', () => {
    const adapted = adaptStyleToResolution(getPresetStyle('youtube'), {
      width: 1080,
      height: 1920,
    });

    expect(adapted.position).toBe('center');
    expect(adapted.maxWordsPerLine).toBeLessThanOrEqual(3);
    expect(adapted.fontSize).toBeGreaterThan(getPresetStyle('youtube').fontSize);
  });

  it('does not over-scale an explicit Shorts preset on portrait videos', () => {
    const style = getPresetStyle('shorts');
    const adapted = adaptStyleToResolution(style, {
      width: 1080,
      height: 1920,
    });

    expect(adapted.position).toBe('center');
    expect(adapted.maxWordsPerLine).toBe(3);
    expect(adapted.fontSize).toBe(style.fontSize);
  });

  it('leaves landscape videos unchanged', () => {
    const style = getPresetStyle('youtube');
    const adapted = adaptStyleToResolution(style, {
      width: 1920,
      height: 1080,
    });

    expect(adapted).toEqual(style);
  });

  it('scales caption size and safe margins for non-1080p videos', () => {
    const style = getPresetStyle('youtube');
    const adapted = adaptStyleToResolution(style, {
      width: 3840,
      height: 2160,
    });

    expect(adapted.fontSize).toBe(style.fontSize * 2);
    expect(adapted.marginV).toBe(style.marginV * 2);
    expect(adapted.outlineWidth).toBe(style.outlineWidth * 2);
  });
});
