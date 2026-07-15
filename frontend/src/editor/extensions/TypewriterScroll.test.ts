// @vitest-environment jsdom
/**
 * TypewriterScroll (v1.68) — pins the centering math's sign convention:
 * the delta is ADDED to scrollTop, so caret below center → positive
 * (scroll down), caret above center → negative (scroll up).
 */
import { describe, it, expect } from 'vitest';
import { typewriterScrollDelta } from './TypewriterScroll';

describe('typewriterScrollDelta', () => {
  it('scrolls down when the caret is below center', () => {
    // container spans 100..700 (center 400), caret at 600
    expect(typewriterScrollDelta(600, 100, 600)).toBe(200);
  });

  it('scrolls up when the caret is above center', () => {
    expect(typewriterScrollDelta(200, 100, 600)).toBe(-200);
  });

  it('does nothing when the caret is exactly centered', () => {
    expect(typewriterScrollDelta(400, 100, 600)).toBe(0);
  });
});
