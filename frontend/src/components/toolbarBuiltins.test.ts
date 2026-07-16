/**
 * Toolbar builtin migrations — saved layouts predate newer buttons, so each
 * ships a one-time append. v2.67: the sizing reset lands right beside the
 * lock it undoes. v2.94: the two-row split moves it (and the other app
 * functions) to Row 2.
 */
import { describe, it, expect } from 'vitest';
import {
  migrateResetSizes, migrateTwoRows, normalizeToolbarZones,
  DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT, BUILTIN_BY_KEY,
  isBigToken, stripBig, makeBig,
} from './toolbarBuiltins';

describe('migrateResetSizes (v2.67)', () => {
  it('inserts the reset right after the lock', () => {
    expect(migrateResetSizes(['b:bold', 'b:lockResize', 'b:view']))
      .toEqual(['b:bold', 'b:lockResize', 'b:resetSizes', 'b:view']);
  });

  it('appends when there is no lock; never duplicates', () => {
    expect(migrateResetSizes(['b:bold'])).toEqual(['b:bold', 'b:resetSizes']);
    const once = migrateResetSizes(['b:lockResize']);
    expect(migrateResetSizes(once)).toEqual(once);
  });

  it('registered as a builtin; lives on Row 2 by default since v2.94', () => {
    expect(DEFAULT_TOOLBAR_RIGHT).toContain('b:resetSizes');
    expect(DEFAULT_TOOLBAR_LEFT).not.toContain('b:resetSizes');
    expect(BUILTIN_BY_KEY.resetSizes?.label).toBe('Reset Sizing');
  });
});

describe('the big! token flag (v2.94)', () => {
  it('wraps, detects and strips without touching plain tokens', () => {
    expect(makeBig('t:notes')).toBe('big!t:notes');
    expect(makeBig('big!t:notes')).toBe('big!t:notes');   // never doubles
    expect(isBigToken('big!b:customize')).toBe(true);
    expect(isBigToken('b:customize')).toBe(false);
    expect(stripBig('big!c:snapshots')).toBe('c:snapshots');
    expect(stripBig('c:snapshots')).toBe('c:snapshots');
  });
});

describe('migrateTwoRows (v2.94)', () => {
  it('moves tools, commands and app-function builtins to Row 2 in order', () => {
    const { left, right } = migrateTwoRows(
      ['b:bold', 'b:togglePanelLeft', 't:notes', 'b:italic', 'c:snapshots', 'b:lockResize', 'b:resetSizes'],
      [],
    );
    expect(left).toEqual(['b:bold', 'b:italic']);
    expect(right).toEqual(['b:togglePanelLeft', 't:notes', 'c:snapshots', 'b:lockResize', 'b:resetSizes']);
  });

  it('the old Big Button zone lands on Row 2 flagged big, after the moved items', () => {
    const { right } = migrateTwoRows(['b:bold', 't:notes'], ['b:customize', 'big!t:goals']);
    expect(right).toEqual(['t:notes', 'big!b:customize', 'big!t:goals']);
  });

  it('dividers and spacers stay on Row 1', () => {
    const { left } = migrateTwoRows(['b:bold', 'd:sep-1', 's:123:40', 'b:togglePanelLeft'], []);
    expect(left).toEqual(['b:bold', 'd:sep-1', 's:123:40']);
  });
});

describe('normalizeToolbarZones is big!-aware (v2.94)', () => {
  it('keeps the flag through validation and dedups flag-blind', () => {
    const { right } = normalizeToolbarZones(['b:bold'], ['big!b:customize', 'b:customize']);
    expect(right.filter((t) => stripBig(t) === 'b:customize')).toHaveLength(1);
    expect(right).toContain('big!b:customize');
  });

  it('re-inserts the permanent Customize without duplicating a flagged one', () => {
    const { right } = normalizeToolbarZones(['b:bold'], ['big!b:customize']);
    expect(right.filter((t) => stripBig(t) === 'b:customize')).toHaveLength(1);
  });
});
