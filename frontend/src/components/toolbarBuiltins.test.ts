/**
 * Toolbar builtin migrations — saved layouts predate newer buttons, so each
 * ships a one-time append. v2.67: the sizing reset lands right beside the
 * lock it undoes. v2.95: the ribbon — one flat sequence, 2! span flags,
 * the right zone retired, big!/customize tokens shed.
 */
import { describe, it, expect } from 'vitest';
import {
  migrateResetSizes, migrateTwoRows, migrateRibbon, normalizeToolbarZones,
  DEFAULT_TOOLBAR_LEFT, BUILTIN_BY_KEY,
  isTall, stripTall, makeTall,
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

  it('registered as a builtin; in the default ribbon sequence', () => {
    expect(DEFAULT_TOOLBAR_LEFT).toContain('b:resetSizes');
    expect(BUILTIN_BY_KEY.resetSizes?.label).toBe('Reset Sizing');
  });
});

describe('the 2! ribbon span flag (v2.95)', () => {
  it('wraps, detects and strips without touching plain tokens', () => {
    expect(makeTall('t:notes')).toBe('2!t:notes');
    expect(makeTall('2!t:notes')).toBe('2!t:notes');   // never doubles
    expect(isTall('2!b:element')).toBe(true);
    expect(isTall('b:element')).toBe(false);
    expect(stripTall('2!d:group')).toBe('d:group');
    expect(stripTall('d:group')).toBe('d:group');
  });
});

describe('migrateTwoRows (v2.94, kept for pre-2.94 upgrade chains)', () => {
  it('moves tools, commands and app-function builtins to the second list', () => {
    const { left, right } = migrateTwoRows(
      ['b:bold', 'b:togglePanelLeft', 't:notes', 'b:italic', 'c:snapshots'],
      [],
    );
    expect(left).toEqual(['b:bold', 'b:italic']);
    expect(right).toEqual(['b:togglePanelLeft', 't:notes', 'c:snapshots']);
  });
});

describe('migrateRibbon (v2.95)', () => {
  it('folds the two zones into one sequence with a full-height split divider', () => {
    expect(migrateRibbon(['b:bold', 'b:italic'], ['t:notes', 'c:snapshots']))
      .toEqual(['b:bold', 'b:italic', '2!d:ribbon-split', 't:notes', 'c:snapshots']);
  });

  it('sheds big! flags and customize tokens; dividers become full-height', () => {
    expect(migrateRibbon(['b:bold', 'd:sep-1'], ['big!b:customize', 'big!t:goals']))
      .toEqual(['b:bold', '2!d:sep-1', '2!d:ribbon-split', 't:goals']);
  });

  it('an empty right zone adds no split divider', () => {
    expect(migrateRibbon(['b:bold', 'd:x'], [])).toEqual(['b:bold', '2!d:x']);
  });
});

describe('normalizeToolbarZones under the ribbon (v2.95)', () => {
  it('folds the retired right zone into the sequence and empties it', () => {
    const z = normalizeToolbarZones(['b:bold'], ['t:notes']);
    expect(z.left).toEqual(['b:bold', 't:notes']);
    expect(z.right).toEqual([]);
  });

  it('keeps 2! flags through validation and dedupes flag-blind', () => {
    const z = normalizeToolbarZones(['2!b:element', 'b:element', '2!d:group'], []);
    expect(z.left).toEqual(['2!b:element', '2!d:group']);
  });

  it('drops stray customize and big! tokens from the v2.94 scheme', () => {
    const z = normalizeToolbarZones(['b:bold', 'big!b:customize', 'b:customize'], []);
    expect(z.left).toEqual(['b:bold']);
  });
});
