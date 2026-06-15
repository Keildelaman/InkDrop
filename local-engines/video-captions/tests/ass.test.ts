import { describe, expect, it } from 'vitest';
import {
  escapeAssText,
  formatAssTime,
  getAssAlignment,
  hexToAssColor,
  hexToAssColorWithAlpha,
} from '../src/subtitles/ass.js';

describe('ASS helpers', () => {
  it('formats seconds as ASS centisecond time', () => {
    expect(formatAssTime(0)).toBe('0:00:00.00');
    expect(formatAssTime(62.345)).toBe('0:01:02.35');
    expect(formatAssTime(30.995)).toBe('0:00:31.00');
  });

  it('converts RGB hex colors to ASS BGR colors', () => {
    expect(hexToAssColor('#3366CC')).toBe('&H00CC6633');
    expect(hexToAssColorWithAlpha('#000000', 0x80)).toBe('&H80000000');
  });

  it('rejects invalid hex colors', () => {
    expect(() => hexToAssColor('blue')).toThrow('Invalid hex color');
  });

  it('escapes ASS override characters while keeping German text', () => {
    expect(escapeAssText('  Gr\u00fc\u00dfe {tag} \\ Test  ')).toBe('Gr\u00fc\u00dfe tag  Test');
  });

  it('maps caption positions to ASS alignment values', () => {
    expect(getAssAlignment('top')).toBe(8);
    expect(getAssAlignment('center')).toBe(5);
    expect(getAssAlignment('bottom')).toBe(2);
  });
});
