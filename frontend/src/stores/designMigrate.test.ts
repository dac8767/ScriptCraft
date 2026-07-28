import { describe, it, expect } from 'vitest';
import { migrateDesignVars } from './slices/designSlice';

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
});
