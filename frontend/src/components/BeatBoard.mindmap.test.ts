// @vitest-environment jsdom
/**
 * Freeform mind map (v2.33) — pins the pure helpers: shape cycling,
 * connection toggling, and the emphasis title scale.
 */
import { describe, it, expect } from 'vitest';
import { nextMindShape, toggleMindLink, mindTitleSize, MIND_SHAPES } from './BeatBoard';

describe('mind map helpers', () => {
  it('cycles rect → rounded → ellipse → rect', () => {
    expect(nextMindShape(undefined)).toBe('rounded');   // default is rect
    expect(nextMindShape('rect')).toBe('rounded');
    expect(nextMindShape('rounded')).toBe('ellipse');
    expect(nextMindShape('ellipse')).toBe('rect');
    expect(MIND_SHAPES[0]).toBe('rect');                // the default shape
  });

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
