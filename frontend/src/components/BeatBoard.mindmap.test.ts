// @vitest-environment jsdom
/**
 * Freeform mind map helpers — connection toggling and the emphasis title
 * scale (v2.33), plus the whole-card color contrast pick (v2.44). The shape
 * cycler was removed with the shape feature in v2.44.
 */
import { describe, it, expect } from 'vitest';
import { toggleMindLink, mindTitleSize, readableTextOn, BEAT_COLORS } from './BeatBoard';

describe('mind map helpers', () => {
  it('toggleMindLink adds a missing link and removes an existing one', () => {
    expect(toggleMindLink(undefined, 'b')).toEqual(['b']);
    expect(toggleMindLink(['b'], 'c')).toEqual(['b', 'c']);
    expect(toggleMindLink(['b', 'c'], 'b')).toEqual(['c']);
  });

  it('title size grows with the card but stays clamped', () => {
    expect(mindTitleSize(0)).toBe(16);        // default 240px card
    expect(mindTitleSize(150)).toBe(13);      // floor
    expect(mindTitleSize(600)).toBe(24);      // ceiling
  });
});

describe('readableTextOn (v2.44 whole-card color)', () => {
  it('picks dark text on light backgrounds, white on dark ones', () => {
    expect(readableTextOn('#ffffff')).toBe('#111111');
    expect(readableTextOn('#eab308')).toBe('#111111');  // yellow
    expect(readableTextOn('#000000')).toBe('#ffffff');
    expect(readableTextOn('#2563eb')).toBe('#ffffff');  // blue
  });

  it('returns no override for the "no color" entry', () => {
    expect(readableTextOn('')).toBe('');
  });

  it('resolves every palette color to black or white text', () => {
    for (const c of BEAT_COLORS.filter(Boolean)) {
      expect(['#111111', '#ffffff']).toContain(readableTextOn(c));
    }
  });
});
