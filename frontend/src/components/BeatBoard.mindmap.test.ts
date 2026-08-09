// @vitest-environment jsdom
/**
 * Freeform mind map helpers — connection toggling and the emphasis title
 * scale (v2.33), plus the whole-card color contrast pick (v2.44). The shape
 * cycler was removed with the shape feature in v2.44.
 */
import { describe, it, expect } from 'vitest';
import { toggleMindLink, mindTitleSize, BEAT_COLORS, freeformAutoLayout } from './BeatBoard';
import { readableTextOn } from '../utils/palettes';
import type { BeatInfo } from '../stores/editorStore';

describe('mind map helpers', () => {
  it('toggleMindLink adds a missing link and removes an existing one', () => {
    expect(toggleMindLink(undefined, 'b')).toEqual(['b']);
    expect(toggleMindLink(['b'], 'c')).toEqual(['b', 'c']);
    expect(toggleMindLink(['b', 'c'], 'b')).toEqual(['c']);
  });

  /* v6.55, Derek: smaller titles = more title bar left to grab. A default
     card reads at 13px — the same size as a sections-mode card's title. */
  it('title size grows with the card but stays clamped', () => {
    expect(mindTitleSize(0)).toBe(13);        // default 240px card
    expect(mindTitleSize(150)).toBe(12);      // floor
    expect(mindTitleSize(600)).toBe(16);      // ceiling
    // never bigger than the card's own body text is small — and monotonic
    expect(mindTitleSize(240)).toBeLessThanOrEqual(mindTitleSize(400));
  });
});

describe('freeformAutoLayout (v3.25, task #138)', () => {
  const beat = (id: string, extra: Partial<BeatInfo> = {}) =>
    ({ id, title: id, description: '', position: 0, ...extra }) as BeatInfo;

  it('unplaced beats never stack — each gets a distinct spot', () => {
    const out = freeformAutoLayout([beat('a'), beat('b'), beat('c'), beat('d')]);
    const spots = out.map((b) => `${b.x},${b.y}`);
    expect(new Set(spots).size).toBe(4);
    // 3 across, then wrap to the next row
    expect(out[3].y).toBeGreaterThan(out[0].y!);
  });

  it('beats stamped x:0/y:0 by addBeat count as unplaced (the actual bug)', () => {
    const out = freeformAutoLayout([beat('a', { x: 0, y: 0 }), beat('b', { x: 0, y: 0 })]);
    expect(`${out[0].x},${out[0].y}`).not.toBe(`${out[1].x},${out[1].y}`);
  });

  it('a hand-placed beat keeps its stored spot, including x=0', () => {
    const out = freeformAutoLayout([beat('a', { x: 0, y: 300 }), beat('b')]);
    expect(out[0].x).toBe(0);
    expect(out[0].y).toBe(300);
    // and the unplaced one does not collide with the cascade origin of a
    expect(`${out[1].x},${out[1].y}`).not.toBe('0,300');
  });

  it('is stable: same input order, same derived spots', () => {
    const a = freeformAutoLayout([beat('a'), beat('b')]);
    const b = freeformAutoLayout([beat('a'), beat('b')]);
    expect(a.map((x) => [x.x, x.y])).toEqual(b.map((x) => [x.x, x.y]));
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
