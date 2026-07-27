// @vitest-environment jsdom
/**
 * naturalWidth (v4.91) — the fit test behind the header's two-stage overflow.
 *
 * The bug this pins: `.tool-chrome-right` carries `margin-left: auto` as the
 * row's spacer, and getComputedStyle resolves an auto margin to its USED
 * value — every pixel of leftover space in the row. Counting it made the
 * "does everything fit on one line?" figure grow in lockstep with the row, so
 * once the tabs collapsed they never came back at ANY window size.
 *
 * It was misdiagnosed once (v4.67 blamed a stale ResizeObserver and re-bound
 * it; the observer was firing all along), so the rule gets a test: a LEFT
 * margin is slack and must never be counted, a RIGHT margin is real spacing
 * and must be.
 *
 * jsdom does no layout, so widths and computed styles are stubbed — the test
 * is over the arithmetic, which is exactly where the defect was.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { naturalWidth } from './ToolDock';

type Style = Partial<Record<'marginLeft' | 'marginRight' | 'flexWrap' | 'columnGap' | 'paddingLeft' | 'paddingRight', string>>;

const styles = new WeakMap<Element, Style>();
const realGCS = window.getComputedStyle;

function el(width: number, style: Style, children: HTMLElement[] = []): HTMLElement {
  const node = document.createElement('div');
  Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
  children.forEach((c) => node.appendChild(c));
  styles.set(node, style);
  return node;
}

vi.spyOn(window, 'getComputedStyle').mockImplementation(((node: Element) => {
  const s = styles.get(node);
  if (!s) return realGCS(node);
  return {
    marginLeft: s.marginLeft ?? '0px',
    marginRight: s.marginRight ?? '0px',
    flexWrap: s.flexWrap ?? 'nowrap',
    columnGap: s.columnGap ?? '0px',
    paddingLeft: s.paddingLeft ?? '0px',
    paddingRight: s.paddingRight ?? '0px',
  } as CSSStyleDeclaration;
}) as typeof window.getComputedStyle);

afterEach(() => { vi.clearAllMocks(); });

describe('naturalWidth', () => {
  it('ignores the left margin — an auto spacer resolves to the row\'s leftover space', () => {
    // What the spacer looks like in a WIDE row and a NARROW one. The answer
    // must not move: the element needs 200px either way.
    expect(naturalWidth(el(200, { marginLeft: '900px' }))).toBe(200);
    expect(naturalWidth(el(200, { marginLeft: '12px' }))).toBe(200);
  });

  it('counts the right margin — that is real spacing (the title gap)', () => {
    expect(naturalWidth(el(120, { marginRight: '10px' }))).toBe(130);
  });

  it('sums a wrapping container\'s children instead of its wrapped box', () => {
    const kids = [el(60, {}), el(40, {}), el(30, {})];
    const box = el(9999, { flexWrap: 'wrap', columnGap: '4px', paddingLeft: '8px', paddingRight: '8px' }, kids);
    // 60+40+30 + 4*2 gaps + 16 padding = 154 — NOT the 9999 it reports wrapped
    expect(naturalWidth(box)).toBe(154);
  });

  it('a wrapping container\'s own auto left margin is slack too', () => {
    const box = el(0, { flexWrap: 'wrap', marginLeft: '640px', columnGap: '0px' }, [el(50, {})]);
    expect(naturalWidth(box)).toBe(50);
  });

  it('the fit test stays constant as the row grows — the actual regression', () => {
    // Same content, two row widths: the spacer's used margin balloons, the
    // answer must not. If it does, collapsed tabs can never re-expand.
    const narrow = naturalWidth(el(250, { marginLeft: '20px', marginRight: '0px' }));
    const wide = naturalWidth(el(250, { marginLeft: '820px', marginRight: '0px' }));
    expect(wide).toBe(narrow);
  });
});
