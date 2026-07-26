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
});
