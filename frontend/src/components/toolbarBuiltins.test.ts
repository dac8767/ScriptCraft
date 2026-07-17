/**
 * Toolbar builtin migrations — saved layouts predate newer buttons, so each
 * ships a one-time append. v2.67: the sizing reset lands right beside the
 * lock it undoes. v2.95: the ribbon — one flat sequence, 2! span flags,
 * the right zone retired, big!/customize tokens shed.
 */
import { describe, it, expect } from 'vitest';
import {
  migrateResetSizes, migrateTwoRows, migrateRibbon, migrateRibbonSections,
  normalizeToolbarZones, parseRibbon, serializeRibbon,
  DEFAULT_TOOLBAR_LEFT, BUILTIN_BY_KEY,
  isTall, stripTall, makeTall,
} from './toolbarBuiltins';

describe('parseRibbon / serializeRibbon (v2.96)', () => {
  it('splits on tall dividers; an r: break separates a section\'s rows', () => {
    const secs = parseRibbon(['b:undo', 'b:redo', 'r:x', 'b:find', '2!d:a', 'b:element']);
    expect(secs).toEqual([
      { top: ['b:undo', 'b:redo'], bottom: ['b:find'], hasBreak: true, breakLine: false },
      { top: ['b:element'], bottom: [], hasBreak: false, breakLine: false },
    ]);
  });

  it('round-trips through serialize (canonical ids)', () => {
    const seq = ['b:undo', 'r:row-0', 'b:redo', '2!d:sec-1', 'b:element'];
    expect(serializeRibbon(parseRibbon(seq))).toEqual(seq);
  });

  it('extra breaks in one section merge into the first', () => {
    const secs = parseRibbon(['b:a', 'r:1', 'b:b', 'r:2', 'b:c']);
    expect(secs).toEqual([{ top: ['b:a'], bottom: ['b:b', 'b:c'], hasBreak: true, breakLine: false }]);
  });

  it('v2.97: an rl: break means the split line SHOWS, and it round-trips', () => {
    const secs = parseRibbon(['b:a', 'rl:1', 'b:b']);
    expect(secs).toEqual([{ top: ['b:a'], bottom: ['b:b'], hasBreak: true, breakLine: true }]);
    expect(serializeRibbon(secs)).toEqual(['b:a', 'rl:row-0', 'b:b']);
  });

  it('the default ribbon parses into sections without loss', () => {
    const secs = parseRibbon(DEFAULT_TOOLBAR_LEFT);
    expect(secs.length).toBeGreaterThan(3);
    expect(serializeRibbon(secs).filter((t) => t.startsWith('b:')))
      .toEqual(DEFAULT_TOOLBAR_LEFT.filter((t) => t.startsWith('b:')));
  });
});

describe('migrateRibbonSections (v2.96)', () => {
  it('column-major pairs become explicit rows: evens on top, odds below', () => {
    expect(migrateRibbonSections(['b:undo', 'b:redo', 'b:bold', 'b:italic']))
      .toEqual(['b:undo', 'b:bold', 'r:mig-0', 'b:redo', 'b:italic']);
  });

  it('lone or all-tall sections become single-row; item 2! flags shed', () => {
    expect(migrateRibbonSections(['2!b:element', '2!d:a', 'b:undo']))
      .toEqual(['b:element', '2!d:a', 'b:undo']);
  });
});

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

  it('keeps 2! on dividers only (v2.96: sections set item height) and dedupes flag-blind', () => {
    const z = normalizeToolbarZones(['2!b:element', 'b:element', '2!d:group', 'r:split'], []);
    expect(z.left).toEqual(['b:element', '2!d:group', 'r:split']);
  });

  it('drops stray customize and big! tokens from the v2.94 scheme', () => {
    const z = normalizeToolbarZones(['b:bold', 'big!b:customize', 'b:customize'], []);
    expect(z.left).toEqual(['b:bold']);
  });
});
