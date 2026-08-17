// @vitest-environment jsdom
//   — not for the DOM: importing designTokens pulls in editorStore, which
//   reads localStorage at creation. The migration itself is pure.
import { describe, it, expect } from 'vitest';
import { migrateDesignVars } from './slices/designSlice';
import { clampDesignVars, designToken } from '../design/designTokens';

/** v4.46: the single toolWinHeaderPad knob became four per-side knobs — a
 *  user's saved override must keep their tuned header height. */
describe('migrateDesignVars', () => {
  it('seeds top+bottom from a saved toolWinHeaderPad and drops the old key', () => {
    expect(migrateDesignVars({ toolWinHeaderPad: 11, menuSpacing: 3 })).toEqual({
      toolWinPadTop: 11, toolWinPadBottom: 11, menuSpacing: 3,
    });
  });

  it('is a no-op without the legacy key', () => {
    const vars = { toolWinPadTop: 2 };
    expect(migrateDesignVars(vars)).toBe(vars);
  });

  it('explicit per-side values beat the seed', () => {
    expect(migrateDesignVars({ toolWinHeaderPad: 11, toolWinPadTop: 3 })).toEqual({
      toolWinPadTop: 3, toolWinPadBottom: 11,
    });
  });

  /** v5.18: the per-kind ribbon button gap became per-ROW (top/bottom) knobs —
   *  a user's saved spacing must apply to both rows, per kind, independently. */
  it('seeds both rows from a saved per-kind button gap and drops the old key', () => {
    expect(migrateDesignVars({ ribBtnGapTitled: 4, ribBtnGapUntitled: 7, menuSpacing: 3 })).toEqual({
      ribBtnGapTopTitled: 4, ribBtnGapBottomTitled: 4,
      ribBtnGapTopUntitled: 7, ribBtnGapBottomUntitled: 7,
      menuSpacing: 3,
    });
  });

  it('migrates one kind without inventing values for the other', () => {
    expect(migrateDesignVars({ ribBtnGapTitled: 2 })).toEqual({
      ribBtnGapTopTitled: 2, ribBtnGapBottomTitled: 2,
    });
  });

  it('explicit per-row values beat the button-gap seed', () => {
    expect(migrateDesignVars({ ribBtnGapUntitled: 9, ribBtnGapBottomUntitled: 0 })).toEqual({
      ribBtnGapTopUntitled: 9, ribBtnGapBottomUntitled: 0,
    });
  });

  it('runs the header-pad and button-gap migrations together', () => {
    expect(migrateDesignVars({ toolWinHeaderPad: 11, ribBtnGapTitled: 4 })).toEqual({
      toolWinPadTop: 11, toolWinPadBottom: 11,
      ribBtnGapTopTitled: 4, ribBtnGapBottomTitled: 4,
    });
  });

  /** v7.32: the clamp runs AFTER the migration, so a legacy key is split first
   *  and the values it seeds are bounded like any other. Order matters — clamp
   *  first and `toolWinHeaderPad` (unknown to the token list) would pass
   *  through unbounded and seed two out-of-range knobs. */
  it('composes with the clamp: migrate splits, clamp bounds the results', () => {
    const t = designToken('toolWinPadTop')!;
    const out = clampDesignVars(migrateDesignVars({ toolWinHeaderPad: 9999 }));
    expect(out.toolWinPadTop).toBe(t.max);
    expect(out.toolWinPadBottom).toBe(designToken('toolWinPadBottom')!.max);
  });
});

/** v7.32: designSlice must NOT import designTokens. designTokens imports
 *  editorStore (store-bound tokens' setters) and editorStore imports this
 *  slice, so the import closes a runtime cycle: `createDesignSlice is not a
 *  function` on the first line of the store's creator. That is why the clamp
 *  lives at the READ sites instead, and this test is what stops the next
 *  person re-adding it here. */
describe('designSlice import graph', () => {
  it('does not import the design tokens module', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    // __dirname, not import.meta.url — under jsdom that is not a file: URL.
    const src = readFileSync(join(__dirname, 'slices', 'designSlice.ts'), 'utf8');
    const imports = [...src.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    // A "forbid X" assertion is worthless if the scan finds nothing at all —
    // prove it sees the imports that ARE there before trusting the absence.
    expect(imports).toContain('../viewState');
    expect(imports).not.toContain('../../design/designTokens');
  });
});
