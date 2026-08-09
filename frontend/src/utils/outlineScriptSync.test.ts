/**
 * v6.64, Derek: "Send to Script" lines MIRROR their outline section — "if
 * section info changes, such as the name or the estimated page amount, the
 * change should be indicated in the annotation as well".
 *
 * These pin the pure half (the one text builder, the cross-variation section
 * lookup, and the signature that decides when the mirror wakes up). The
 * document half — stamping, rewriting, no-duplicate re-sends — is driven for
 * real in devtools/check-v664.mjs, because a store assert would happily pass
 * while the script on screen said something else (the v6.62 lesson).
 */
import { describe, it, expect } from 'vitest';
import {
  sectionLineText, collectOutlineSections, outlineSectionSignature,
} from './outlineScriptSync';

const col = (id: string, title: string, targetPages?: number) => ({ id, title, targetPages });

describe('sectionLineText', () => {
  it('writes the name AND the page estimate, so both can be seen to change', () => {
    expect(sectionLineText('Act I', 40)).toBe('# Act I — 40 pages');
    expect(sectionLineText('Act II', 1)).toBe('# Act II — 1 page');
  });

  it('never writes a nameless or zero-page line', () => {
    expect(sectionLineText('   ', 12)).toBe('# Untitled Section — 12 pages');
    expect(sectionLineText('Setup', 0)).toBe('# Setup — 1 page');
    expect(sectionLineText('Setup', -4)).toBe('# Setup — 1 page');
  });

  it('rounds a fractional budget rather than printing it', () => {
    expect(sectionLineText('Act I', 39.6)).toBe('# Act I — 40 pages');
  });

  /* The line has to stay a SECTION line — "# " is what makes the script hide
     it in Preview, suppress it in print and strip it on export (CLAUDE.md
     §4). A sent line that lost its # would ship in a draft. */
  it('is always a working-note section line', () => {
    for (const [t, p] of [['Act I', 40], ['x', 1], ['', 3]] as const) {
      expect(sectionLineText(t, p).startsWith('# ')).toBe(true);
    }
  });
});

describe('collectOutlineSections', () => {
  it('sees sections in EVERY outline variation, not just the viewed one', () => {
    const map = collectOutlineSections(
      [col('a', 'Act I', 40)],
      { 'tab-2': { columns: [col('b', 'You', 15), col('c', 'Need', 15)] } },
    );
    expect([...map.keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(map.get('b')).toEqual({ id: 'b', title: 'You', pages: 15 });
  });

  it('the viewed tab wins when the same id is in both (it is the live copy)', () => {
    const map = collectOutlineSections(
      [col('a', 'Renamed', 20)],
      { 'tab-1': { columns: [col('a', 'Stale', 40)] } },
    );
    expect(map.get('a')).toEqual({ id: 'a', title: 'Renamed', pages: 20 });
  });

  it('defaults a missing page budget to 1 instead of dropping the section', () => {
    expect(collectOutlineSections([col('a', 'Act I')], {}).get('a')!.pages).toBe(1);
  });

  it('survives an empty or half-built stash', () => {
    expect(collectOutlineSections([], {}).size).toBe(0);
    expect(collectOutlineSections([], { t: { columns: [] } }).size).toBe(0);
  });
});

describe('outlineSectionSignature', () => {
  const sig = (cols: Parameters<typeof collectOutlineSections>[0], stash = {}) =>
    outlineSectionSignature(collectOutlineSections(cols, stash));

  it('changes when a name changes', () => {
    expect(sig([col('a', 'Act I', 40)])).not.toBe(sig([col('a', 'Act One', 40)]));
  });

  it('changes when the page estimate changes', () => {
    expect(sig([col('a', 'Act I', 40)])).not.toBe(sig([col('a', 'Act I', 30)]));
  });

  /* The whole point: a column-resize drag fires a store write on every
     pointer move. If width moved the signature, each one would walk the
     document. */
  it('does NOT change for anything the line does not show', () => {
    const a = collectOutlineSections([{ id: 'a', title: 'Act I', targetPages: 40, width: 340 } as never], {});
    const b = collectOutlineSections([{ id: 'a', title: 'Act I', targetPages: 40, width: 520, position: 3 } as never], {});
    expect(outlineSectionSignature(a)).toBe(outlineSectionSignature(b));
  });

  it('does not change when sections are merely reordered', () => {
    expect(sig([col('a', 'Act I', 40), col('b', 'Act II', 40)]))
      .toBe(sig([col('b', 'Act II', 40), col('a', 'Act I', 40)]));
  });

  it('changes when a section is added or removed', () => {
    expect(sig([col('a', 'Act I', 40)])).not.toBe(sig([col('a', 'Act I', 40), col('b', 'Act II', 40)]));
  });
});
