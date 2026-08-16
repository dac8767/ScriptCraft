/**
 * Where the "Saved" flash lands (v7.25).
 *
 * Derek: "move the 'Saved' indicator so it is on the white page, centered and
 * about an inch down from the ruler."
 *
 * Three things can each move it, and all three are why the position is
 * measured rather than written down:
 *   · the page's centre is not the window's centre once a side panel opens;
 *   · the page carries a scale() zoom, so an inch is not 96px;
 *   · the ruler can be switched off, and then the drop counts from the
 *     scroller's top instead.
 */
import { describe, it, expect } from 'vitest';
import { savedFlashSpot, DROP_IN } from './SavedFlash';

const r = (left: number, width: number, top = 0, bottom = 0): DOMRect =>
  ({ left, width, top, bottom, right: left + width, height: bottom - top, x: left, y: top,
    toJSON: () => ({}) }) as DOMRect;

// 8.5in page at 100%: 8.5 × 96 = 816px wide.
const PAGE_100 = r(300, 816);
const RULER = r(0, 1400, 60, 80);

describe('savedFlashSpot', () => {
  it('centres on the page and drops one page-inch below the ruler', () => {
    const spot = savedFlashSpot(PAGE_100, RULER, null, 8.5, DROP_IN);
    expect(spot).toEqual({ left: 300 + 408, top: 80 + 96 });
  });

  it('follows the page when a side panel pushes it off-centre', () => {
    // same window, page shifted right by a 260px panel
    const spot = savedFlashSpot(r(560, 816), RULER, null, 8.5, DROP_IN);
    expect(spot!.left).toBe(560 + 408);
  });

  it('an inch is the PAGE\'s inch, so zoom does not walk it away from the ruler', () => {
    // 150% zoom: the same 8.5in page measures 1224px
    const spot = savedFlashSpot(r(200, 1224), RULER, null, 8.5, DROP_IN);
    expect(spot!.top).toBe(80 + 144);          // 1.5 × 96, not a flat 96
    expect(spot!.left).toBe(200 + 612);
  });

  it('a narrower page setup still gets ITS inch', () => {
    // A4-ish 8.27in at 100% — the divisor is the real page width, not 8.5
    const spot = savedFlashSpot(r(0, 794), RULER, null, 8.27, DROP_IN);
    expect(spot!.top).toBe(80 + Math.round(794 / 8.27));
  });

  it('falls back to the scroller when the rulers are switched off', () => {
    const spot = savedFlashSpot(PAGE_100, null, r(0, 1400, 40, 900), 8.5, DROP_IN);
    expect(spot!.top).toBe(900 + 96);          // counts from the scroller's top edge
  });

  it('renders nothing rather than somewhere wrong when it cannot measure', () => {
    expect(savedFlashSpot(null, RULER, null, 8.5, DROP_IN)).toBeNull();
    expect(savedFlashSpot(PAGE_100, null, null, 8.5, DROP_IN)).toBeNull();
    expect(savedFlashSpot(r(0, 0), RULER, null, 8.5, DROP_IN)).toBeNull();
  });
});
