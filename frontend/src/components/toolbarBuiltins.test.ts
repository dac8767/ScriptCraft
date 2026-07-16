/**
 * Toolbar builtin migrations — saved layouts predate newer buttons, so each
 * ships a one-time append. v2.67: the sizing reset lands right beside the
 * lock it undoes.
 */
import { describe, it, expect } from 'vitest';
import { migrateResetSizes, DEFAULT_TOOLBAR_LEFT, BUILTIN_BY_KEY } from './toolbarBuiltins';

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

  it('new installs have it by default, registered as a builtin', () => {
    expect(DEFAULT_TOOLBAR_LEFT).toContain('b:resetSizes');
    expect(BUILTIN_BY_KEY.resetSizes?.label).toBe('Reset Sizing');
  });
});
