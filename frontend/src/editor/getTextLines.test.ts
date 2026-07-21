// @vitest-environment jsdom
/**
 * getTextLines (v4.22) — the paginator's wrapped-line estimate must match the
 * browser's greedy word wrap, or pages over/under-fill and drift off their
 * height. These lock the real word-wrap behavior (not ceil(len/cpl)).
 */
import { describe, it, expect } from 'vitest';
import { getTextLines } from './pagination';

describe('getTextLines — greedy word wrap', () => {
  it('empty text still occupies one line', () => {
    expect(getTextLines('', 36)).toBe(1);
  });

  it('a run shorter than the line is one line', () => {
    expect(getTextLines('Don\'t get too excited.', 36)).toBe(1);
  });

  it('breaks at word boundaries, not mid-word like ceil(len/cpl)', () => {
    // 141 chars: ceil(141/36) = 4, but real word wrap lands on 5 lines — the
    // exact block from Derek's overflowing page.
    const dialogue =
      'All fighters to the hanger bay. All fighters to the hanger bay. ' +
      'This is a code red. Hostile ship approaching. All fighters to the hanger bay.';
    expect(dialogue.length).toBe(141);
    expect(Math.ceil(dialogue.length / 36)).toBe(4); // the old under-count
    expect(getTextLines(dialogue, 36)).toBe(5);       // what actually renders
  });

  it('a word longer than the line wraps within itself', () => {
    expect(getTextLines('a'.repeat(40), 36)).toBe(2);
    expect(getTextLines('a'.repeat(72), 36)).toBe(2);
    expect(getTextLines('a'.repeat(73), 36)).toBe(3);
  });

  it('never under-counts vs the naive character estimate', () => {
    const samples = [
      'The camera tilts down to reveal a mid-sized space carrier approaching the small red planet BELKADAN.',
      'Two handsome young men, SAM VEDU and CALLUN VEDU (CAL), brothers, early twenties, run toward their respective star fighters.',
      'Oh I\'m sharp. Just watch. I bet you I\'ll take out half their fleet before you\'ve even left the launch bay.',
    ];
    for (const s of samples) {
      expect(getTextLines(s, 62)).toBeGreaterThanOrEqual(Math.ceil(s.length / 62));
    }
  });
});
