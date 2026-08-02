/**
 * v5.77: the Map tab's place rules. A pin is now a PLACE that can carry
 * several script locations (Derek: BELKADAN - SPACE and BELKADAN - SURFACE
 * are one spot on the map), a display name that never touches the script,
 * a description and custom fields.
 */
import { describe, it, expect } from 'vitest';
import {
  addPlaceAt, attachLocation, detachLocation, movePlace, removePlace, unpinPlace,
  addPlaceField, setPlaceField, removePlaceField, renameScriptLocation,
  pinnedPlaces, unplacedLocations, placeForLocation, placeLabel, locationLabel,
  migratePins, readPlaces, emptyPlace, nextRotation, rotatedRatio, dropFraction, clampFraction, mergePlaces,
  locationRows, togglePlaceLock, connectTargets,
  type LocationPlace,
} from './locationPlaces';

const place = (id: string, patch: Partial<LocationPlace> = {}): LocationPlace => ({ ...emptyPlace(id, 0.5, 0.5), ...patch });

describe('addPlaceAt', () => {
  it('drops an empty pin and hands back its id', () => {
    const { places, id } = addPlaceAt([], 0.25, 0.75);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ id, x: 0.25, y: 0.75, scriptNames: [], displayName: '' });
  });

  it('gives every pin a distinct id', () => {
    const a = addPlaceAt([], 0.1, 0.1);
    const b = addPlaceAt(a.places, 0.2, 0.2);
    expect(b.id).not.toBe(a.id);
  });

  it('clamps a click that lands off the map', () => {
    expect(addPlaceAt([], -1, 4).places[0]).toMatchObject({ x: 0, y: 1 });
  });
});

describe('attachLocation', () => {
  it('attaches a script location, uppercased', () => {
    const { places, id } = addPlaceAt([], 0.5, 0.5);
    expect(attachLocation(places, id, 'main street')[0].scriptNames).toEqual(['MAIN STREET']);
  });

  it('puts TWO script locations on one pin — Derek\'s BELKADAN case', () => {
    let { places, id } = addPlaceAt([], 0.5, 0.5);
    places = attachLocation(places, id, 'BELKADAN - SPACE');
    places = attachLocation(places, id, 'BELKADAN - SURFACE');
    expect(places).toHaveLength(1);
    expect(places[0].scriptNames).toEqual(['BELKADAN - SPACE', 'BELKADAN - SURFACE']);
  });

  it('moves a location off whatever pin it was on — one spot per location', () => {
    let places = [place('p1', { scriptNames: ['BRIDGE'], displayName: 'The Bridge' }), place('p2')];
    places = attachLocation(places, 'p2', 'BRIDGE');
    expect(places.find((p) => p.id === 'p1')!.scriptNames).toEqual([]);
    expect(places.find((p) => p.id === 'p2')!.scriptNames).toEqual(['BRIDGE']);
  });

  it('drops a pin left with nothing at all, but KEEPS one the writer wrote on', () => {
    // p1 has only the location; p2 has a display name of its own.
    let places = [place('p1', { scriptNames: ['A'], x: null, y: null }), place('p3')];
    places = attachLocation(places, 'p3', 'A');
    expect(places.map((p) => p.id)).toEqual(['p3']);

    let kept = [place('k1', { scriptNames: ['A'], description: 'a note', x: null, y: null }), place('k2')];
    kept = attachLocation(kept, 'k2', 'A');
    expect(kept.map((p) => p.id).sort()).toEqual(['k1', 'k2']);
  });

  it('is idempotent — attaching twice does not duplicate', () => {
    let { places, id } = addPlaceAt([], 0.5, 0.5);
    places = attachLocation(places, id, 'A');
    places = attachLocation(places, id, 'a');
    expect(places[0].scriptNames).toEqual(['A']);
  });
});

describe('detachLocation', () => {
  it('removes the location from its pin', () => {
    const places = detachLocation([place('p1', { scriptNames: ['A', 'B'] })], 'a');
    expect(places[0].scriptNames).toEqual(['B']);
  });

  it('leaves a pin that still has fields, drops one that has nothing', () => {
    expect(detachLocation([place('p1', { scriptNames: ['A'], x: null, y: null })], 'A')).toEqual([]);
    const kept = detachLocation([place('p1', { scriptNames: ['A'], displayName: 'Home', x: null, y: null })], 'A');
    expect(kept).toHaveLength(1);
  });
});

describe('placeLabel / locationLabel', () => {
  it('the display name overrides the script name in the window', () => {
    const places = [place('p1', { scriptNames: ['BELKADAN - SPACE'], displayName: 'Belkadan' })];
    expect(locationLabel(places, 'BELKADAN - SPACE')).toBe('Belkadan');
  });

  it('falls back to the script name when no display name is set', () => {
    const places = [place('p1', { scriptNames: ['MAIN STREET'] })];
    expect(locationLabel(places, 'MAIN STREET')).toBe('MAIN STREET');
    expect(locationLabel(places, 'UNKNOWN')).toBe('UNKNOWN');
  });

  it('placeLabel prefers the display name, then the first script name', () => {
    expect(placeLabel(place('p', { displayName: ' Belkadan ' }))).toBe('Belkadan');
    expect(placeLabel(place('p', { scriptNames: ['A', 'B'] }))).toBe('A');
    expect(placeLabel(undefined, 'fallback')).toBe('fallback');
  });
});

describe('placeForLocation', () => {
  it('finds the place a script location sits on, case-insensitively', () => {
    const places = [place('p1', { scriptNames: ['A'] }), place('p2', { scriptNames: ['B'] })];
    expect(placeForLocation(places, 'b')?.id).toBe('p2');
    expect(placeForLocation(places, 'C')).toBeUndefined();
  });
});

describe('move / remove / unpin', () => {
  it('moves a pin, clamped', () => {
    expect(movePlace([place('p1')], 'p1', 1.5, 0.3)[0]).toMatchObject({ x: 1, y: 0.3 });
  });

  it('deletes a place outright', () => {
    expect(removePlace([place('p1'), place('p2')], 'p1').map((p) => p.id)).toEqual(['p2']);
  });

  it('unpinning KEEPS what the writer wrote', () => {
    const places = unpinPlace([place('p1', { scriptNames: ['A'], description: 'noted' })], 'p1');
    expect(places[0]).toMatchObject({ x: null, y: null, description: 'noted', scriptNames: ['A'] });
  });

  it('unpinning an empty pin removes it entirely', () => {
    expect(unpinPlace([place('p1')], 'p1')).toEqual([]);
  });
});

describe('custom fields', () => {
  it('adds, edits and removes a field on ONE place', () => {
    let places = [place('p1'), place('p2')];
    places = addPlaceField(places, 'p1', ' Terrain ');
    expect(places[0].fields).toEqual([{ id: 'f1', label: 'Terrain', value: '' }]);
    expect(places[1].fields).toEqual([]);

    places = setPlaceField(places, 'p1', 'f1', { value: 'Coral' });
    expect(places[0].fields[0].value).toBe('Coral');

    places = setPlaceField(places, 'p1', 'f1', { label: 'Ground' });
    expect(places[0].fields[0]).toMatchObject({ label: 'Ground', value: 'Coral' });

    places = removePlaceField(places, 'p1', 'f1');
    expect(places[0].fields).toEqual([]);
  });

  it('ignores a blank field name', () => {
    expect(addPlaceField([place('p1')], 'p1', '   ')[0].fields).toEqual([]);
  });

  it('gives each field a distinct id', () => {
    let places = addPlaceField([place('p1')], 'p1', 'One');
    places = addPlaceField(places, 'p1', 'Two');
    expect(places[0].fields.map((f) => f.id)).toEqual(['f1', 'f2']);
  });
});

describe('renameScriptLocation', () => {
  it('follows a heading rename', () => {
    const places = renameScriptLocation([place('p1', { scriptNames: ['OLD'] })], 'OLD', 'new');
    expect(places[0].scriptNames).toEqual(['NEW']);
  });

  it('does not duplicate when renaming onto a name the place already carries', () => {
    const places = renameScriptLocation([place('p1', { scriptNames: ['A', 'B'] })], 'A', 'B');
    expect(places[0].scriptNames).toEqual(['B']);
  });

  it('leaves unrelated places alone', () => {
    const places = [place('p1', { scriptNames: ['A'] }), place('p2', { scriptNames: ['B'] })];
    expect(renameScriptLocation(places, 'A', 'C')[1].scriptNames).toEqual(['B']);
  });
});

describe('pinnedPlaces', () => {
  it('draws only placed pins', () => {
    const places = [place('p1', { scriptNames: ['A'] }), place('p2', { scriptNames: ['B'], x: null, y: null })];
    expect(pinnedPlaces(places, ['A', 'B']).map((p) => p.id)).toEqual(['p1']);
  });

  it('orders pins by the list order of their locations', () => {
    const places = [place('p1', { scriptNames: ['C'] }), place('p2', { scriptNames: ['A'] })];
    expect(pinnedPlaces(places, ['A', 'B', 'C']).map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('keeps a just-dropped pin that has nothing attached yet', () => {
    expect(pinnedPlaces([place('p1')], ['A'])).toHaveLength(1);
  });

  it('keeps a named place whose script locations have left the script', () => {
    const gone = place('p1', { scriptNames: ['CUT'], displayName: 'The Old Mill' });
    expect(pinnedPlaces([gone], ['A'])).toHaveLength(1);
  });
});

describe('unplacedLocations', () => {
  it('offers the locations not already on the map', () => {
    const places = [place('p1', { scriptNames: ['B'] })];
    const locs = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(unplacedLocations(locs, places).map((l) => l.name)).toEqual(['A', 'C']);
  });

  it('a location on an UNPINNED place is still offerable', () => {
    const places = [place('p1', { scriptNames: ['B'], x: null, y: null })];
    expect(unplacedLocations([{ name: 'B' }], places).map((l) => l.name)).toEqual(['B']);
  });
});

describe('rotation', () => {
  it('steps clockwise and wraps', () => {
    expect([0, 90, 180, 270].map(nextRotation)).toEqual([90, 180, 270, 0]);
  });

  it('a quarter turn swaps the image\'s proportions', () => {
    expect(rotatedRatio(2, 0)).toBe(2);
    expect(rotatedRatio(2, 180)).toBe(2);
    expect(rotatedRatio(2, 90)).toBe(0.5);
    expect(rotatedRatio(2, 270)).toBe(0.5);
  });
});

describe('migratePins (v5.75 saves)', () => {
  it('reads old name+x+y pins as places', () => {
    const places = migratePins([{ name: 'main street', x: 0.2, y: 0.8 }]);
    expect(places[0]).toMatchObject({ scriptNames: ['MAIN STREET'], x: 0.2, y: 0.8, displayName: '' });
    expect(places[0].id).toBeTruthy();
  });

  it('skips junk without throwing', () => {
    expect(migratePins([{ x: 0.1, y: 0.1 }, null as never, { name: '  ' }])).toEqual([]);
    expect(migratePins(undefined as never)).toEqual([]);
  });
});

describe('readPlaces', () => {
  it('round-trips a saved place', () => {
    const saved = [{ id: 'p1', scriptNames: ['a'], displayName: 'Home', description: 'd', fields: [{ id: 'f1', label: 'L', value: 'V' }], x: 0.5, y: 0.25 }];
    expect(readPlaces(saved)[0]).toEqual({
      id: 'p1', scriptNames: ['A'], displayName: 'Home', description: 'd',
      fields: [{ id: 'f1', label: 'L', value: 'V' }], x: 0.5, y: 0.25, locked: false,
    });
  });

  it('survives missing and malformed entries', () => {
    expect(readPlaces(null)).toEqual([]);
    expect(readPlaces([{ noId: true }])).toEqual([]);
    expect(readPlaces([{ id: 'p1' }])[0]).toEqual({
      id: 'p1', scriptNames: [], displayName: '', description: '', fields: [], x: null, y: null, locked: false,
    });
  });
});

describe('dropFraction / clampFraction', () => {
  it('converts a click to fractions of the map', () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(dropFraction(rect, 300, 150)).toEqual({ x: 0.5, y: 0.5 });
    expect(dropFraction(rect, 20, 900)).toEqual({ x: 0, y: 1 });
  });

  it('survives a zero-sized rect', () => {
    expect(dropFraction({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it('holds 0..1', () => {
    expect([0.5, -2, 9, NaN].map(clampFraction)).toEqual([0.5, 0, 1, 0]);
  });
});

describe('mergePlaces — "assign to an existing pin"', () => {
  it('makes the two ONE place, on the target pin', () => {
    const places = [
      place('p1', { scriptNames: ['BELKADAN - SPACE'], x: 0.2, y: 0.2 }),
      place('p2', { scriptNames: ['BELKADAN - SURFACE'], x: 0.8, y: 0.8 }),
    ];
    const out = mergePlaces(places, 'p2', 'p1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'p1', x: 0.2, y: 0.2 });
    expect(out[0].scriptNames).toEqual(['BELKADAN - SPACE', 'BELKADAN - SURFACE']);
  });

  it('carries the source\'s writing over rather than dropping it', () => {
    const places = [
      place('p1', { scriptNames: ['A'] }),
      place('p2', { scriptNames: ['B'], displayName: 'Belkadan', description: 'a green world' }),
    ];
    expect(mergePlaces(places, 'p2', 'p1')[0]).toMatchObject({
      displayName: 'Belkadan', description: 'a green world',
    });
  });

  it('never overwrites what the TARGET already says', () => {
    const places = [
      place('p1', { scriptNames: ['A'], displayName: 'Keep me', description: 'mine' }),
      place('p2', { scriptNames: ['B'], displayName: 'Other', description: 'theirs' }),
    ];
    expect(mergePlaces(places, 'p2', 'p1')[0]).toMatchObject({ displayName: 'Keep me', description: 'mine' });
  });

  it('carries custom fields across, skipping labels the target already has', () => {
    const places = [
      place('p1', { fields: [{ id: 'f1', label: 'Terrain', value: 'rock' }] }),
      place('p2', { fields: [{ id: 'f1', label: 'terrain', value: 'ignored' }, { id: 'f2', label: 'Climate', value: 'wet' }] }),
    ];
    const out = mergePlaces(places, 'p2', 'p1');
    expect(out[0].fields.map((f) => f.label)).toEqual(['Terrain', 'Climate']);
    expect(out[0].fields.map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('does not duplicate a name both pins carried', () => {
    const places = [place('p1', { scriptNames: ['A', 'B'] }), place('p2', { scriptNames: ['b'] })];
    expect(mergePlaces(places, 'p2', 'p1')[0].scriptNames).toEqual(['A', 'B']);
  });

  it('is a no-op for a missing or self target', () => {
    const places = [place('p1')];
    expect(mergePlaces(places, 'p1', 'p1')).toBe(places);
    expect(mergePlaces(places, 'p1', 'nope')).toBe(places);
  });
});

describe('locationRows — one row per PLACE (v5.78)', () => {
  const loc = (name: string, scenes: number[]) => ({ name, sceneIndices: scenes });

  it('collapses several script locations on one pin into ONE row', () => {
    const places = [place('p1', { scriptNames: ['BELKADAN - SPACE', 'BELKADAN - SURFACE'], displayName: 'Belkadan' })];
    const rows = locationRows([loc('BELKADAN - SPACE', [0, 1]), loc('BELKADAN - SURFACE', [2])], places);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'Belkadan', scriptNames: ['BELKADAN - SPACE', 'BELKADAN - SURFACE'] });
  });

  it('adds up the scenes of every location on the row', () => {
    const places = [place('p1', { scriptNames: ['A', 'B'] })];
    expect(locationRows([loc('A', [0, 1]), loc('B', [2])], places)[0].scenes).toBe(3);
  });

  it('leaves unattached locations as their own rows, in script order', () => {
    const places = [place('p1', { scriptNames: ['B'] })];
    const rows = locationRows([loc('A', [0]), loc('B', [1]), loc('C', [2])], places);
    expect(rows.map((r) => r.label)).toEqual(['A', 'B', 'C']);
  });

  it('ranks a merged row where its FIRST location sits in the script', () => {
    const places = [place('p1', { scriptNames: ['C', 'A'], displayName: 'Both' })];
    const rows = locationRows([loc('A', [0]), loc('B', [1]), loc('C', [2])], places);
    expect(rows.map((r) => r.label)).toEqual(['Both', 'B']);
  });

  it('includes a place the writer created that the script has no name for', () => {
    const places = [place('p9', { displayName: 'The Old Mill' })];
    const rows = locationRows([loc('A', [0])], places);
    expect(rows.map((r) => r.label)).toEqual(['A', 'The Old Mill']);
  });

  it('does not invent a row for an empty, unpinned place', () => {
    expect(locationRows([], [place('p1', { x: null, y: null })])).toEqual([]);
  });
});

describe('lock (v5.78)', () => {
  it('a locked pin refuses to move', () => {
    const places = [place('p1', { x: 0.2, y: 0.2, locked: true })];
    expect(movePlace(places, 'p1', 0.9, 0.9)).toBe(places);
  });

  it('an unlocked pin still moves', () => {
    expect(movePlace([place('p1', { x: 0.2, y: 0.2 })], 'p1', 0.9, 0.9)[0]).toMatchObject({ x: 0.9, y: 0.9 });
  });

  it('toggles both ways, and ignores an unknown pin', () => {
    let places = [place('p1')];
    places = togglePlaceLock(places, 'p1');
    expect(places[0].locked).toBe(true);
    places = togglePlaceLock(places, 'p1');
    expect(places[0].locked).toBe(false);
    expect(togglePlaceLock(places, 'nope')).toBe(places);
  });

  it('survives a save/load round-trip', () => {
    expect(readPlaces([{ id: 'p1', x: 0.1, y: 0.1, locked: true }])[0].locked).toBe(true);
    expect(readPlaces([{ id: 'p2' }])[0].locked).toBe(false);
  });
});

describe('connectTargets — "+ Connect to location" (v5.79)', () => {
  const loc = (name: string, scenes: number[]) => ({ name, sceneIndices: scenes });

  it('offers EVERY script location, not just the unplaced ones', () => {
    const places = [place('p1', { scriptNames: ['A'] }), place('p2', { scriptNames: ['B'] })];
    const t = connectTargets([loc('A', [0]), loc('B', [1]), loc('C', [2])], places, 'p1');
    expect(t.scriptLocations.map((s) => s.name)).toEqual(['B', 'C']);
  });

  it('says where a location would be moved FROM', () => {
    const places = [place('p1', { scriptNames: ['A'] }), place('p2', { scriptNames: ['B'], displayName: 'Bridge' })];
    const t = connectTargets([loc('A', [0]), loc('B', [1])], places, 'p1');
    expect(t.scriptLocations[0]).toMatchObject({ name: 'B', from: 'Bridge' });
  });

  it('leaves out the locations this place already has', () => {
    const places = [place('p1', { scriptNames: ['A', 'B'] })];
    expect(connectTargets([loc('A', [0]), loc('B', [1])], places, 'p1').scriptLocations).toEqual([]);
  });

  it('offers location GROUPS — a display name, or several linked locations', () => {
    const places = [
      place('self'),
      place('g1', { scriptNames: ['A'], displayName: 'Belkadan' }),   // named ⇒ a group
      place('g2', { scriptNames: ['B', 'C'] }),                       // linked ⇒ a group
      place('p3', { scriptNames: ['D'] }),                            // just a location
    ];
    const t = connectTargets([loc('A', [0]), loc('B', [1]), loc('C', [2]), loc('D', [3])], places, 'self');
    expect(t.groups.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(t.groups[0]).toMatchObject({ label: 'Belkadan', scriptNames: ['A'] });
  });

  it('never offers the place itself', () => {
    const places = [place('p1', { displayName: 'Me', scriptNames: ['A', 'B'] })];
    expect(connectTargets([loc('A', [0])], places, 'p1').groups).toEqual([]);
  });

  it('copes with no place yet (a row that has never been touched)', () => {
    const t = connectTargets([loc('A', [0])], [], null);
    expect(t.scriptLocations.map((s) => s.name)).toEqual(['A']);
    expect(t.groups).toEqual([]);
  });
});
