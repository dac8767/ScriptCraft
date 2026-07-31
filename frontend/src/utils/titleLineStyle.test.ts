// @vitest-environment jsdom
/**
 * v5.74, Derek: "the title page in the title page tool, and the title page in
 * the Page > All view still do not match." titleLineStyle is now the ONE
 * definition both render from — these pin what it says, per field.
 */
import { describe, it, expect } from 'vitest';
import { titleLineStyle, titlePaperShiftPx } from './titlePageLayout';

describe('titleLineStyle', () => {
  it('aligns each field the way the page does', () => {
    expect(titleLineStyle('title').textAlign).toBe('center');
    expect(titleLineStyle('title2').textAlign).toBe('center');
    expect(titleLineStyle('author').textAlign).toBe('center');
    expect(titleLineStyle('date').textAlign).toBe('center');
    expect(titleLineStyle('draft').textAlign).toBe('left');
    expect(titleLineStyle('contact').textAlign).toBe('right');
    expect(titleLineStyle('copyright').textAlign).toBe('right');
  });

  it('titles are bold and uppercase; other lines are neither', () => {
    for (const f of ['title', 'title2']) {
      expect(titleLineStyle(f).fontWeight).toBe(700);
      expect(titleLineStyle(f).textTransform).toBe('uppercase');
    }
    for (const f of ['author', 'draft', 'contact', 'copyright', 'date', 'blank']) {
      expect(titleLineStyle(f).fontWeight).toBeUndefined();
      expect(titleLineStyle(f).textTransform).toBeUndefined();
    }
  });

  it('a custom title size snaps its line-height to whole 12pt slots', () => {
    // …so the block's rendered height equals the line budget the paginator
    // and the layout builder count for it.
    expect(titleLineStyle('title', { sizePt: 28 })).toMatchObject({ fontSize: '28pt', lineHeight: '36pt' });
    expect(titleLineStyle('title2', { sizePt: 20 })).toMatchObject({ fontSize: '20pt', lineHeight: '24pt' });
    expect(titleLineStyle('title', { sizePt: 24 })).toMatchObject({ fontSize: '24pt', lineHeight: '24pt' });
  });

  it('the default 12pt title writes no size at all — it inherits the grid', () => {
    const s = titleLineStyle('title', { sizePt: 12 });
    expect(s.fontSize).toBeUndefined();
    expect(s.lineHeight).toBeUndefined();
  });

  it('a size on a NON-title line is ignored (only titles are sized)', () => {
    expect(titleLineStyle('author', { sizePt: 28 }).fontSize).toBeUndefined();
  });

  it('the paper shift moves centered lines and never the anchored ones', () => {
    const shiftPx = -35.52;   // a US-Letter-ish (0.76in − 1.5in)/2 × 96
    for (const f of ['title', 'title2', 'author', 'date']) {
      expect(titleLineStyle(f, { shiftPx })).toMatchObject({
        marginLeft: `${shiftPx}px`, marginRight: `${-shiftPx}px`,
      });
    }
    for (const f of ['draft', 'contact', 'copyright']) {
      const s = titleLineStyle(f, { shiftPx });
      expect(s.marginLeft).toBeUndefined();
      expect(s.marginRight).toBeUndefined();
    }
  });

  it('every line keeps real newlines (credit and contact hold them)', () => {
    expect(titleLineStyle('author').whiteSpace).toBe('pre-wrap');
    expect(titleLineStyle('contact').whiteSpace).toBe('pre-wrap');
  });
});

describe('titlePaperShiftPx', () => {
  it('is half the margin difference, in px — negative when the left is wider', () => {
    expect(titlePaperShiftPx({ leftMargin: 1.5, rightMargin: 0.76 })).toBeCloseTo(-35.52, 2);
  });

  it('is 0 for a symmetric page (nothing to correct)', () => {
    expect(titlePaperShiftPx({ leftMargin: 1, rightMargin: 1 })).toBe(0);
  });
});
