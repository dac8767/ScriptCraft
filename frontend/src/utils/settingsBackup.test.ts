// @vitest-environment jsdom
/**
 * Settings backup/restore (v4.22) — the export gathers every opendraft:* key
 * except security/session ones, and import writes back only safe keys, so a
 * dev app's config can move to a release build.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gatherSettings, buildBackup, applyBackup, BACKUP_EXCLUDED } from './settingsBackup';

beforeEach(() => localStorage.clear());

describe('gatherSettings', () => {
  it('collects opendraft:* keys and ignores others', () => {
    localStorage.setItem('opendraft:theme', 'dark');
    localStorage.setItem('opendraft:toolbarRibbon295', '[1,2,3]');
    localStorage.setItem('unrelated', 'x');
    const g = gatherSettings();
    expect(g).toEqual({ 'opendraft:theme': 'dark', 'opendraft:toolbarRibbon295': '[1,2,3]' });
  });

  it('excludes security / device keys', () => {
    localStorage.setItem('opendraft:theme', 'dark');
    localStorage.setItem('opendraft:auth', 'secret-token');
    localStorage.setItem('opendraft:gdriveTokens', 'oauth');
    localStorage.setItem('opendraft:deviceId', 'dev-123');
    const g = gatherSettings();
    expect(g).toHaveProperty('opendraft:theme');
    expect(g).not.toHaveProperty('opendraft:auth');
    expect(g).not.toHaveProperty('opendraft:gdriveTokens');
    expect(g).not.toHaveProperty('opendraft:deviceId');
    for (const k of BACKUP_EXCLUDED) expect(g).not.toHaveProperty(k);
  });
});

describe('buildBackup / applyBackup round-trip', () => {
  it('exports then re-imports every safe key into fresh storage', () => {
    localStorage.setItem('opendraft:theme', 'light');
    localStorage.setItem('opendraft:elementOverrides', '{"hidden":[]}');
    localStorage.setItem('opendraft:auth', 'nope');           // excluded
    const json = buildBackup('2026-07-20T00:00:00Z');

    localStorage.clear();
    const res = applyBackup(json);
    expect(res.imported).toBe(2);
    expect(localStorage.getItem('opendraft:theme')).toBe('light');
    expect(localStorage.getItem('opendraft:elementOverrides')).toBe('{"hidden":[]}');
    expect(localStorage.getItem('opendraft:auth')).toBeNull();
  });

  it('stamps the document shape', () => {
    const doc = JSON.parse(buildBackup('2026-07-20T00:00:00Z'));
    expect(doc.app).toBe('ScriptCraft');
    expect(doc.kind).toBe('settings-backup');
    expect(doc.version).toBe(1);
    expect(doc.exportedAt).toBe('2026-07-20T00:00:00Z');
  });
});

describe('applyBackup validation', () => {
  it('rejects non-JSON', () => {
    expect(() => applyBackup('not json')).toThrow(/not valid JSON/i);
  });

  it('rejects a non-backup document', () => {
    expect(() => applyBackup(JSON.stringify({ hello: 'world' }))).toThrow(/not a ScriptCraft settings backup/i);
  });

  it('ignores non-opendraft, excluded, and non-string keys in a hostile file', () => {
    const hostile = JSON.stringify({
      app: 'ScriptCraft', kind: 'settings-backup', version: 1, exportedAt: 'x',
      data: {
        'opendraft:theme': 'dark',      // applied
        'evil': 'rm -rf',               // wrong prefix → skipped
        'opendraft:auth': 'token',      // excluded → skipped
        'opendraft:num': 42,            // non-string → skipped
      },
    });
    const res = applyBackup(hostile);
    expect(res.imported).toBe(1);
    expect(localStorage.getItem('opendraft:theme')).toBe('dark');
    expect(localStorage.getItem('evil')).toBeNull();
    expect(localStorage.getItem('opendraft:auth')).toBeNull();
  });
});
