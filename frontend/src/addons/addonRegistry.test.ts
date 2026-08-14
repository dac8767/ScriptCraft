/**
 * @vitest-environment jsdom
 *
 * jsdom because the persistence assert needs a real localStorage. (The registry
 * itself survives without one — every access is guarded, which is why the other
 * cases pass in a bare node environment.)
 *
 * The add-on install contract (v7.05).
 *
 * The behaviour that matters: an uninstalled add-on's tools are GATED (so every
 * surface hides them together), installing is remembered, and a corrupt or
 * unknown value can't take the app down.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ADDON_CATALOG, installAddon, removeAddon, isAddonInstalled,
  installedAddons, gatedToolIds, subscribeAddons, __resetAddonsForTest,
} from './addonRegistry';

beforeEach(() => __resetAddonsForTest([]));

describe('add-on catalog', () => {
  it('every entry has the fields the Add-ons list renders', () => {
    for (const a of ADDON_CATALOG) {
      expect(a.id, 'id').toBeTruthy();
      expect(a.name, `${a.id} name`).toBeTruthy();
      expect(a.summary, `${a.id} summary`).toBeTruthy();
      expect(a.version, `${a.id} version`).toBeTruthy();
    }
  });

  it('ids are unique — they are the persisted key', () => {
    const ids = ADDON_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships Action Rewrite as an add-on', () => {
    const rw = ADDON_CATALOG.find((a) => a.id === 'action-rewrite');
    expect(rw, 'the action-rewrite add-on must exist').toBeTruthy();
    expect(rw!.toolIds).toContain('rewrite');
  });
});

describe('install state', () => {
  it('starts with nothing installed, and gates that add-on\'s tools', () => {
    expect(installedAddons()).toEqual([]);
    expect(gatedToolIds()).toContain('rewrite');
  });

  it('installing ungates the tool; removing re-gates it', () => {
    installAddon('action-rewrite');
    expect(isAddonInstalled('action-rewrite')).toBe(true);
    expect(gatedToolIds()).not.toContain('rewrite');

    removeAddon('action-rewrite');
    expect(isAddonInstalled('action-rewrite')).toBe(false);
    expect(gatedToolIds()).toContain('rewrite');
  });

  it('installing twice does not duplicate', () => {
    installAddon('action-rewrite');
    installAddon('action-rewrite');
    expect(installedAddons().filter((x) => x === 'action-rewrite')).toHaveLength(1);
  });

  it('an unknown id is a no-op, not a crash or a phantom install', () => {
    installAddon('does-not-exist');
    expect(installedAddons()).toEqual([]);
    expect(() => removeAddon('does-not-exist')).not.toThrow();
  });

  it('persists to localStorage so the install survives a restart', () => {
    installAddon('action-rewrite');
    expect(localStorage.getItem('opendraft:addons:installed')).toContain('action-rewrite');
  });

  it('notifies subscribers on install and remove', () => {
    let calls = 0;
    const off = subscribeAddons(() => { calls += 1; });
    installAddon('action-rewrite');
    removeAddon('action-rewrite');
    off();
    installAddon('action-rewrite');       // after unsubscribe — must not count
    expect(calls).toBe(2);
  });
});
