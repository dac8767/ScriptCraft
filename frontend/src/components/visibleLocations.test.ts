// @vitest-environment jsdom
/**
 * visibleLocations (v4.92) — the Locations window's Filter / Sort / Search.
 *
 * Pinned because the controls live in the window CHROME and the list in the
 * body: if this rule drifts, a control silently stops doing anything, which
 * is the failure mode this codebase keeps re-learning.
 */
import { describe, it, expect } from 'vitest';
import { visibleLocations } from './SceneNavigator';

type Loc = Parameters<typeof visibleLocations>[0][number];

const loc = (name: string, prefixes: string[], scenes: number[]): Loc => ({
  name,
  sceneIndices: scenes,
  headings: prefixes.map((p) => `${p}. ${name}`),
  prefixes,
  times: prefixes.map(() => 'DAY'),
  preambles: prefixes.map(() => ''),
});

// Script order = first appearance, which is the order groupByLocation emits.
const ALL: Loc[] = [
  loc('SPACE - BELKADAN', ['EXT', 'EXT', 'EXT'], [0, 4, 7]),
  loc("CAL'S A-WING", ['INT'], [5]),
  loc('CARRIER - HANGER BAY', ['INT', 'INT'], [3, 9]),
  loc('MAIN STREET', ['INT./EXT'], [11]),
];
const names = (r: Loc[]) => r.map((l) => l.name);
const NONE = { search: '', filter: 'all' as const, sort: 'script' as const };

describe('visibleLocations', () => {
  it('with nothing set, the list is untouched and in script order', () => {
    expect(names(visibleLocations(ALL, NONE))).toEqual(
      ['SPACE - BELKADAN', "CAL'S A-WING", 'CARRIER - HANGER BAY', 'MAIN STREET'],
    );
  });

  it('search matches anywhere in the name, case-insensitively', () => {
    expect(names(visibleLocations(ALL, { ...NONE, search: 'carrier' }))).toEqual(['CARRIER - HANGER BAY']);
    expect(names(visibleLocations(ALL, { ...NONE, search: '  SPACE ' }))).toEqual(['SPACE - BELKADAN']);
    expect(visibleLocations(ALL, { ...NONE, search: 'nowhere' })).toEqual([]);
  });

  it('Interior keeps anything ever shot inside — including INT./EXT.', () => {
    expect(names(visibleLocations(ALL, { ...NONE, filter: 'int' })))
      .toEqual(["CAL'S A-WING", 'CARRIER - HANGER BAY', 'MAIN STREET']);
  });

  it('Exterior likewise — a location can appear under both', () => {
    expect(names(visibleLocations(ALL, { ...NONE, filter: 'ext' })))
      .toEqual(['SPACE - BELKADAN', 'MAIN STREET']);
  });

  it('sorts by name and by scene count', () => {
    expect(names(visibleLocations(ALL, { ...NONE, sort: 'name' })))
      .toEqual(["CAL'S A-WING", 'CARRIER - HANGER BAY', 'MAIN STREET', 'SPACE - BELKADAN']);
    expect(names(visibleLocations(ALL, { ...NONE, sort: 'count' })))
      .toEqual(['SPACE - BELKADAN', 'CARRIER - HANGER BAY', "CAL'S A-WING", 'MAIN STREET']);
  });

  it('ties in the count sort keep script order — the list never shuffles at random', () => {
    const tied = [loc('B', ['INT'], [2]), loc('A', ['INT'], [1])];
    expect(names(visibleLocations(tied, { ...NONE, sort: 'count' }))).toEqual(['B', 'A']);
  });

  it('search, filter and sort compose', () => {
    const r = visibleLocations(ALL, { search: 'a', filter: 'int', sort: 'name' });
    expect(names(r)).toEqual(["CAL'S A-WING", 'CARRIER - HANGER BAY', 'MAIN STREET']);
  });

  it('never mutates the list it was given', () => {
    const before = names(ALL);
    visibleLocations(ALL, { ...NONE, sort: 'name' });
    visibleLocations(ALL, { ...NONE, sort: 'count' });
    expect(names(ALL)).toEqual(before);
  });
});
