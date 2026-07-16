/**
 * PDF import (v2.79) — pins the indentation classifier: a PDF has no
 * elements, so screenplay types are reconstructed from each paragraph's
 * indent relative to the action margin (standard layout offsets, in pt).
 */
import { describe, it, expect } from 'vitest';
import { classifyParagraph } from './pdfClassify';

describe('classifyParagraph', () => {
  it('recognizes scene headings at the action margin', () => {
    expect(classifyParagraph(0, 'INT. FARMHOUSE - NIGHT', null)).toBe('sceneHeading');
    expect(classifyParagraph(2, 'EXT. SPACE - BELKADAN', 'action')).toBe('sceneHeading');
    expect(classifyParagraph(0, 'I/E CAR - DAY', 'action')).toBe('sceneHeading');
  });

  it('recognizes the dialogue stack by indent', () => {
    expect(classifyParagraph(158, 'PILOT (V.O.)', 'action')).toBe('character');
    expect(classifyParagraph(115, '(noticing something)', 'character')).toBe('parenthetical');
    expect(classifyParagraph(72, 'ExGal-4. Hailing ExGal-4. Do you copy?', 'character')).toBe('dialogue');
    expect(classifyParagraph(72, 'This is Crimson Squadron.', 'parenthetical')).toBe('dialogue');
  });

  it('recognizes right-side transitions', () => {
    expect(classifyParagraph(300, 'CUT TO:', 'action')).toBe('transition');
    expect(classifyParagraph(280, 'FADE OUT.', 'dialogue')).toBe('transition');
  });

  it('everything at the margin is action — even ALL CAPS lines', () => {
    expect(classifyParagraph(0, 'An eerie stillness surrounds them.', 'dialogue')).toBe('action');
    expect(classifyParagraph(0, 'OPENING SCROLL', null)).toBe('action');
  });

  it('dialogue indent without a cue above stays action', () => {
    expect(classifyParagraph(72, 'A stray centered line.', 'action')).toBe('action');
  });
});
