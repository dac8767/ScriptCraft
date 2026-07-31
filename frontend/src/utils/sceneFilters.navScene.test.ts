/**
 * v5.68, Derek: the Navigator filter window's "Scene Headings" section —
 * INT. or EXT., location, Contains X. One predicate (navSceneHeadingMatch)
 * serves the chrome's chip count and the body's row test; these pin its
 * reading of real heading shapes, including the "INT./EXT." compound that
 * must pass BOTH kind filters (the Locations-window rule).
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_NAV_SCENE_FILTERS, navSceneHeadingMatch,
  countActiveNavSceneFilters, sceneHeadingLocations,
} from './sceneFilters';

const f = (over: Partial<typeof EMPTY_NAV_SCENE_FILTERS>) => ({ ...EMPTY_NAV_SCENE_FILTERS, ...over });

describe('navSceneHeadingMatch', () => {
  it('empty filters pass everything', () => {
    expect(navSceneHeadingMatch('INT. KITCHEN - DAY', EMPTY_NAV_SCENE_FILTERS)).toBe(true);
    expect(navSceneHeadingMatch('', EMPTY_NAV_SCENE_FILTERS)).toBe(true);
  });

  it('INT keeps interiors, drops exteriors — and the INT./EXT. compound passes both', () => {
    expect(navSceneHeadingMatch('INT. KITCHEN - DAY', f({ intExt: 'int' }))).toBe(true);
    expect(navSceneHeadingMatch('EXT. SPACE - BELKADAN', f({ intExt: 'int' }))).toBe(false);
    expect(navSceneHeadingMatch('EXT. SPACE - BELKADAN', f({ intExt: 'ext' }))).toBe(true);
    expect(navSceneHeadingMatch('INT./EXT. CAR - NIGHT', f({ intExt: 'int' }))).toBe(true);
    expect(navSceneHeadingMatch('INT./EXT. CAR - NIGHT', f({ intExt: 'ext' }))).toBe(true);
  });

  it('location matches the parsed location, case-blind, exactly', () => {
    // parseHeading strips only KNOWN time words after the dash — a sub-place
    // ("- BRIDGE") stays part of the location, exactly as the Locations
    // window groups it. One definition of "location" app-wide.
    expect(navSceneHeadingMatch('INT. SPACE CARRIER - BRIDGE', f({ location: 'SPACE CARRIER - BRIDGE' }))).toBe(true);
    expect(navSceneHeadingMatch('int. space carrier - bridge', f({ location: 'SPACE CARRIER - BRIDGE' }))).toBe(true);
    expect(navSceneHeadingMatch('INT. KITCHEN - DAY', f({ location: 'KITCHEN' }))).toBe(true);
    // exact, not substring — CARRIER alone is a different location
    expect(navSceneHeadingMatch('INT. SPACE CARRIER - BRIDGE', f({ location: 'CARRIER' }))).toBe(false);
  });

  it('contains is a case-blind substring over the whole heading', () => {
    expect(navSceneHeadingMatch('EXT. SPACE - BELKADAN', f({ contains: 'belka' }))).toBe(true);
    expect(navSceneHeadingMatch('EXT. SPACE - BELKADAN', f({ contains: 'bridge' }))).toBe(false);
    // whitespace-only query filters nothing
    expect(navSceneHeadingMatch('EXT. SPACE - BELKADAN', f({ contains: '   ' }))).toBe(true);
  });

  it('filters stack — every active one must pass', () => {
    const both = f({ intExt: 'int', contains: 'bridge' });
    expect(navSceneHeadingMatch('INT. SPACE CARRIER - BRIDGE', both)).toBe(true);
    expect(navSceneHeadingMatch('INT. SPACE CARRIER - HANGER BAY', both)).toBe(false);
  });
});

describe('countActiveNavSceneFilters (the chip)', () => {
  it('counts each active filter once; blank/whitespace contains is inactive', () => {
    expect(countActiveNavSceneFilters(EMPTY_NAV_SCENE_FILTERS)).toBe(0);
    expect(countActiveNavSceneFilters(f({ intExt: 'ext' }))).toBe(1);
    expect(countActiveNavSceneFilters(f({ intExt: 'ext', location: 'CAR', contains: 'x' }))).toBe(3);
    expect(countActiveNavSceneFilters(f({ contains: '  ' }))).toBe(0);
  });
});

describe('sceneHeadingLocations (the dropdown options)', () => {
  it('distinct, uppercase, A–Z; time words strip, sub-places stay; blanks contribute nothing', () => {
    expect(sceneHeadingLocations([
      'INT. Kitchen - DAY',
      'EXT. SPACE - BELKADAN',
      'INT. KITCHEN - NIGHT',
      '',
    ])).toEqual(['KITCHEN', 'SPACE - BELKADAN']);
  });
});
