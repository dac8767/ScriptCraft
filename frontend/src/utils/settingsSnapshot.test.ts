// @vitest-environment jsdom
/**
 * v6.99 — the Settings window's Cancel snapshot. The contract: snapshot
 * captures exactly the setter-paired fields, restore goes THROUGH the
 * setters (they carry the localStorage writes), and untouched fields are
 * skipped so restoring never churns storage for nothing.
 */
import { describe, it, expect } from 'vitest';
import { snapshotSettings, restoreSettings } from './settingsSnapshot';
import { useSettingsStore } from '../stores/settingsStore';

describe('settings snapshot / restore', () => {
  it('captures setter-paired fields only, and no functions', () => {
    const snap = snapshotSettings();
    expect(Object.keys(snap).length).toBeGreaterThan(5);
    expect(Object.values(snap).every((v) => typeof v !== 'function')).toBe(true);
    expect(snap).toHaveProperty('enabledScriptFormats');
    expect(snap).toHaveProperty('autoLoadLastScript');
  });

  it('restores changed fields through the setters and skips untouched ones', () => {
    const s = () => useSettingsStore.getState();
    s().setAutoLoadLastScript(false);
    s().setEnabledScriptFormats(['one']);
    const snap = snapshotSettings();

    s().setAutoLoadLastScript(true);
    s().setEnabledScriptFormats(['one', 'two']);
    expect(restoreSettings(snap)).toBe(2);
    expect(s().autoLoadLastScript).toBe(false);
    expect(s().enabledScriptFormats).toEqual(['one']);

    // nothing changed since this snapshot — nothing moves
    expect(restoreSettings(snapshotSettings())).toBe(0);
  });
});
