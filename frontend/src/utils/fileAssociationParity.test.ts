/**
 * The extensions the app opens are declared in THREE places, and macOS only
 * reads one of them.
 *
 * v7.31, Derek: double-clicking a .script file did not open ScriptCraft, and
 * ScriptCraft was greyed out in "Open With". Every list below already agreed —
 * the cause was an INSTALLED app bundle older than the .script extension, and
 * `tauri dev` never installs one at all. But the three lists agreeing was luck,
 * not structure:
 *
 *   1. src-tauri/tauri.conf.json  bundle.fileAssociations
 *        The ONLY one macOS reads. Baked into Info.plist at BUILD time, which
 *        is why a stale /Applications bundle keeps the old answer no matter
 *        what the source says.
 *   2. src-tauri/src/lib.rs       OPENABLE_EXTENSIONS
 *        What the app accepts once launched with a path.
 *   3. frontend/.../scriptFileExt SCRIPT_EXTS
 *        What the app writes and offers in its own file dialogs.
 *
 * Miss (1) and the file cannot reach the app. Miss (2) and macOS launches the
 * app, which then ignores the file — the silent no-op shape. Miss (3) and the
 * app writes files it will not open.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCRIPT_EXT, SCRIPT_EXTS } from './scriptFileExt';

const ROOT = join(__dirname, '..', '..', '..');
const conf = JSON.parse(readFileSync(join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const lib = readFileSync(join(ROOT, 'src-tauri', 'src', 'lib.rs'), 'utf8');

/** Extensions the BUNDLE claims — what macOS offers in "Open With". */
const bundleExts: string[] = (conf.bundle?.fileAssociations ?? [])
  .flatMap((a: { ext: string[] }) => a.ext)
  .map((e: string) => e.toLowerCase());

/** Extensions the Rust side will act on once launched. */
const openable = (lib.match(/OPENABLE_EXTENSIONS: &\[&str\] = &\[([^\]]*)\]/)?.[1] ?? '')
  .split(',')
  .map((s) => s.trim().replace(/"/g, ''))
  .filter(Boolean);

describe('the extensions the app opens', () => {
  it('the bundle claims the app\'s own format — without this, macOS greys it out', () => {
    expect(bundleExts, `tauri.conf.json must declare .${SCRIPT_EXT}`).toContain(SCRIPT_EXT);
  });

  it('…and the Rust side acts on it — without this, it launches and ignores the file', () => {
    expect(openable).toContain(SCRIPT_EXT);
  });

  /* .json is READ but deliberately NOT claimed: it is a legacy script
     extension the app can still open, and declaring it would make ScriptCraft
     the system handler for every JSON file on the machine. Reading a type and
     claiming a type are different decisions, and this is the one place they
     part company. */
  const NOT_CLAIMED = ['json'];

  it('every format the app WRITES, it can also be launched with', () => {
    // A file the app saves must be openable by double-clicking it.
    for (const e of SCRIPT_EXTS.filter((x) => !NOT_CLAIMED.includes(x))) {
      expect(bundleExts, `.${e} is written but not declared in tauri.conf.json`).toContain(e);
      expect(openable, `.${e} is written but not in OPENABLE_EXTENSIONS`).toContain(e);
    }
  });

  it('every extension the bundle claims, the app actually handles', () => {
    // The other direction: claiming a type in Open With and then doing nothing
    // with it is worse than not claiming it.
    for (const e of bundleExts) {
      expect(openable, `.${e} is claimed in tauri.conf.json but not in OPENABLE_EXTENSIONS`).toContain(e);
    }
  });
});
