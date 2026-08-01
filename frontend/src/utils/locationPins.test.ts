/**
 * v5.75: the Map tab's pin rules. Pure, so the drag/drop UI on top of them
 * can be thin — and because "a control that writes into the void" is the
 * failure mode this codebase keeps re-learning.
 */
import { describe, it, expect } from 'vitest';
import {
  upsertPin, removePin, renamePin, pinFor, visiblePins, unpinnedLocations,
  clampFraction, dropFraction, type LocationPin,
} from './locationPins';

const P = (name: string, x = 0.5, y = 0.5): LocationPin => ({ name, x, y });

describe('upsertPin', () => {
  it('adds a pin, uppercasing the name (the list groups by uppercase)', () => {
    expect(upsertPin([], "cal's a-wing", 0.25, 0.75)).toEqual([{ name: "CAL'S A-WING", x: 0.25, y: 0.75 }]);
  });

  it('MOVES an existing pin instead of stacking a second one', () => {
    const pins = upsertPin(upsertPin([], 'MAIN STREET', 0.1, 0.1), 'MAIN STREET', 0.8, 0.9);
    expect(pins).toEqual([{ name: 'MAIN STREET', x: 0.8, y: 0.9 }]);
  });

  it('keeps the moved pin in its original list position', () => {
    let pins = upsertPin(upsertPin([], 'A', 0.1, 0.1), 'B', 0.2, 0.2);
    pins = upsertPin(pins, 'A', 0.9, 0.9);
    expect(pins.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('clamps a drop that lands outside the map', () => {
    expect(upsertPin([], 'A', -0.4, 1.7)[0]).toMatchObject({ x: 0, y: 1 });
  });

  it('ignores a blank name', () => {
    expect(upsertPin([], '   ', 0.5, 0.5)).toEqual([]);
  });
});

describe('removePin / pinFor', () => {
  it('removes by name, case-insensitively', () => {
    expect(removePin([P('MAIN STREET'), P('BRIDGE')], 'main street').map((p) => p.name)).toEqual(['BRIDGE']);
  });

  it('finds a pin regardless of the caller\'s casing', () => {
    expect(pinFor([P('BRIDGE', 0.3, 0.4)], 'bridge')).toMatchObject({ x: 0.3, y: 0.4 });
    expect(pinFor([P('BRIDGE')], 'HANGAR')).toBeUndefined();
  });
});

describe('renamePin', () => {
  it('follows a location rename, keeping the position', () => {
    expect(renamePin([P('OLD NAME', 0.2, 0.8)], 'OLD NAME', 'new name'))
      .toEqual([{ name: 'NEW NAME', x: 0.2, y: 0.8 }]);
  });

  it('leaves other pins alone', () => {
    const out = renamePin([P('A', 0.1, 0.1), P('B', 0.2, 0.2)], 'A', 'C');
    expect(out.find((p) => p.name === 'B')).toMatchObject({ x: 0.2, y: 0.2 });
  });

  it('renaming ONTO an existing name leaves one pin, not two', () => {
    // The two locations have become one location; it gets one pin.
    const out = renamePin([P('A', 0.1, 0.1), P('B', 0.9, 0.9)], 'A', 'B');
    expect(out).toEqual([{ name: 'B', x: 0.1, y: 0.1 }]);
  });

  it('is a no-op for an unpinned location or a same-name rename', () => {
    const pins = [P('A')];
    expect(renamePin(pins, 'ZZZ', 'B')).toBe(pins);
    expect(renamePin(pins, 'A', 'a')).toBe(pins);
  });
});

describe('visiblePins', () => {
  it('draws only pins whose location is still in the list', () => {
    const pins = [P('GONE'), P('MAIN STREET')];
    expect(visiblePins(pins, ['MAIN STREET', 'BRIDGE']).map((p) => p.name)).toEqual(['MAIN STREET']);
  });

  it('KEEPS the orphan in the data — retyping the heading restores it', () => {
    const pins = [P('GONE', 0.4, 0.6)];
    expect(visiblePins(pins, [])).toEqual([]);
    expect(visiblePins(pins, ['GONE'])).toEqual([{ name: 'GONE', x: 0.4, y: 0.6 }]);
  });

  it('orders pins the way the list orders locations', () => {
    const pins = [P('C'), P('A'), P('B')];
    expect(visiblePins(pins, ['A', 'B', 'C']).map((p) => p.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('unpinnedLocations', () => {
  it('is what the rail offers to drag — list order, pinned ones dropped', () => {
    const locs = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(unpinnedLocations(locs, [P('b')]).map((l) => l.name)).toEqual(['A', 'C']);
  });

  it('is empty once every location is pinned', () => {
    expect(unpinnedLocations([{ name: 'A' }], [P('A')])).toEqual([]);
  });
});

describe('dropFraction', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  it('converts a drop point to fractions of the map image', () => {
    expect(dropFraction(rect, 300, 150)).toEqual({ x: 0.5, y: 0.5 });
    expect(dropFraction(rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(dropFraction(rect, 500, 250)).toEqual({ x: 1, y: 1 });
  });

  it('clamps a drop just outside the stage', () => {
    expect(dropFraction(rect, 20, 900)).toEqual({ x: 0, y: 1 });
  });

  it('survives a zero-sized rect (image not laid out yet)', () => {
    expect(dropFraction({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe('clampFraction', () => {
  it('holds 0..1 and treats nonsense as 0', () => {
    expect(clampFraction(0.5)).toBe(0.5);
    expect(clampFraction(-2)).toBe(0);
    expect(clampFraction(9)).toBe(1);
    expect(clampFraction(NaN)).toBe(0);
  });
});
