// @vitest-environment jsdom
/**
 * v6.53, Derek: freeform connections meet the cards where YOU put them —
 * "a circle that you place anywhere on the edge of the first beat", then
 * one on the second. The geometry is pure: nearestEdgeAnchor projects a
 * pointer onto a card's perimeter, anchorPoint turns a stored anchor back
 * into a canvas point, and a link saved before anchors existed still runs
 * center to center.
 */
import { describe, it, expect } from 'vitest';
import { nearestEdgeAnchor, anchorPoint, type CardBox } from './BeatBoard';

const BOX: CardBox = { left: 100, top: 100, w: 200, h: 100 };

describe('nearestEdgeAnchor', () => {
  it('snaps to the closest edge and keeps the position along it', () => {
    // just inside the left edge, a third of the way down
    expect(nearestEdgeAnchor(BOX, 110, 133)).toEqual({ ax: 0, ay: 0.33 });
    // near the right edge
    expect(nearestEdgeAnchor(BOX, 290, 150)).toEqual({ ax: 1, ay: 0.5 });
    // near the top
    expect(nearestEdgeAnchor(BOX, 200, 105)).toEqual({ ax: 0.5, ay: 0 });
    // near the bottom
    expect(nearestEdgeAnchor(BOX, 150, 195)).toEqual({ ax: 0.25, ay: 1 });
  });

  it('projects a pointer OUTSIDE the card onto the nearest edge', () => {
    expect(nearestEdgeAnchor(BOX, 40, 150)).toEqual({ ax: 0, ay: 0.5 });      // left of it
    expect(nearestEdgeAnchor(BOX, 400, 120)).toEqual({ ax: 1, ay: 0.2 });     // right of it
    expect(nearestEdgeAnchor(BOX, 200, 0)).toEqual({ ax: 0.5, ay: 0 });       // above it
    expect(nearestEdgeAnchor(BOX, 260, 400)).toEqual({ ax: 0.8, ay: 1 });     // below it
  });

  it('always lands ON the perimeter, whatever the pointer', () => {
    for (const [px, py] of [[0, 0], [1000, 1000], [150, 150], [100, 100], [300, 200]]) {
      const a = nearestEdgeAnchor(BOX, px, py);
      const onEdge = a.ax === 0 || a.ax === 1 || a.ay === 0 || a.ay === 1;
      expect(onEdge, `(${px},${py}) → ${JSON.stringify(a)}`).toBe(true);
      expect(a.ax).toBeGreaterThanOrEqual(0);
      expect(a.ax).toBeLessThanOrEqual(1);
      expect(a.ay).toBeGreaterThanOrEqual(0);
      expect(a.ay).toBeLessThanOrEqual(1);
    }
  });

  it('a zero-size card cannot divide by zero', () => {
    const a = nearestEdgeAnchor({ left: 0, top: 0, w: 0, h: 0 }, 50, 50);
    expect(Number.isFinite(a.ax) && Number.isFinite(a.ay)).toBe(true);
  });
});

describe('anchorPoint', () => {
  it('places the point where the anchor says', () => {
    expect(anchorPoint(BOX, { ax: 0, ay: 0.5 })).toEqual({ x: 100, y: 150 });
    expect(anchorPoint(BOX, { ax: 1, ay: 0 })).toEqual({ x: 300, y: 100 });
    expect(anchorPoint(BOX, { ax: 0.5, ay: 1 })).toEqual({ x: 200, y: 200 });
  });

  it('an anchorless (pre-v6.53) link draws from the center, as it always did', () => {
    expect(anchorPoint(BOX)).toEqual({ x: 200, y: 150 });
  });

  it('normalized anchors ride a resize — the connection keeps its spot', () => {
    const a = nearestEdgeAnchor(BOX, 290, 150);                   // right edge, middle
    const grown: CardBox = { ...BOX, w: 400, h: 300 };
    expect(anchorPoint(grown, a)).toEqual({ x: 500, y: 250 });    // still right edge, middle
  });
});
