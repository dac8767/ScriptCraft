/**
 * The extension rename, and the promise attached to it.
 *
 * v7.21, Derek: "make the extension .script". New files get the new name.
 * The old names keep opening — forever, not for a deprecation window — because
 * every script he saved before today is called `.odraft`, and the v1.16–v7.17
 * folder copies are called `.odraft.json`. A file this app wrote is a file
 * this app opens.
 *
 * What did NOT change is inside the file: `format: 'opendraft-script'` and
 * `odraft_version` are read out of every existing file, so renaming those
 * would orphan the lot. That is the rename this project never makes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SCRIPT_EXT, LEGACY_SCRIPT_EXTS, SCRIPT_EXTS, isScriptExt, scriptFileName, SCRIPT_FORMAT_LABEL,
} from './scriptFileExt';

describe('the script extension', () => {
  it('is .script', () => {
    expect(SCRIPT_EXT).toBe('script');
    expect(scriptFileName('Episode X')).toBe('Episode X.script');
    expect(SCRIPT_FORMAT_LABEL).toBe('ScriptCraft (.script)');
  });

  it('still opens everything the app has ever written', () => {
    expect(LEGACY_SCRIPT_EXTS).toContain('odraft');   // v0 – v7.20
    expect(LEGACY_SCRIPT_EXTS).toContain('json');     // the v1.16–v7.17 folder copies
    for (const e of ['script', 'odraft', 'json', 'SCRIPT', 'OdRaFt']) {
      expect(isScriptExt(e), `${e} must open`).toBe(true);
    }
  });

  it('does not claim files that are not ours', () => {
    for (const e of ['fdx', 'fountain', 'txt', 'pdf', 'docx', '', undefined, null]) {
      expect(isScriptExt(e as string), `${e} is not ours`).toBe(false);
    }
  });

  it('the new name leads the accepted list, so dialogs default to it', () => {
    expect(SCRIPT_EXTS[0]).toBe(SCRIPT_EXT);
  });
});

describe('what the rename must NOT have touched', () => {
  const fmt = readFileSync('src/utils/odraftFormat.ts', 'utf8');

  it('the on-disk format tag is unchanged — it is read from every existing file', () => {
    expect(fmt).toMatch(/format: 'opendraft-script'/);
    expect(fmt).toMatch(/odraft_version: 1/);
  });

  it('the bundle identity is unchanged — macOS has it recorded against every saved file', () => {
    // The bundle id lives in the Tauri config; the document UTIs are injected
    // into Info.plist by the release workflow. Both are identity, not naming.
    const conf = readFileSync('../src-tauri/tauri.conf.json', 'utf8');
    expect(conf).toContain('com.freedraft.app');
    const release = readFileSync('../.github/workflows/release.yml', 'utf8');
    expect(release).toContain('com.proteus.opendraft.document');
  });

  it('the OS still associates BOTH extensions with the app', () => {
    const conf = JSON.parse(readFileSync('../src-tauri/tauri.conf.json', 'utf8'));
    const walk = (n: unknown): string[] => {
      if (Array.isArray(n)) return n.flatMap(walk);
      if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>;
        if (Array.isArray(o.fileAssociations)) {
          return (o.fileAssociations as Array<{ ext: string[] }>).flatMap((a) => a.ext);
        }
        return Object.values(o).flatMap(walk);
      }
      return [];
    };
    const exts = walk(conf);
    expect(exts).toContain('script');
    expect(exts).toContain('odraft');
  });

  it('the desktop open-handler accepts both too', () => {
    const rust = readFileSync('../src-tauri/src/lib.rs', 'utf8');
    const line = rust.match(/const OPENABLE_EXTENSIONS[^;]*;/)?.[0] ?? '';
    expect(line).toContain('"script"');
    expect(line).toContain('"odraft"');
  });
});
