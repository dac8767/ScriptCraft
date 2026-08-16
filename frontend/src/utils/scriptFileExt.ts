/**
 * THE script file extension. One source, because the last three versions were
 * spent finding the same bug in six different writers of the same file.
 *
 * v7.21, Derek: "make the extension .script".
 *
 * WHAT CHANGED: what new files are NAMED.
 * WHAT DID NOT: what is INSIDE them. The envelope still says
 * `format: 'opendraft-script'` with `odraft_version: 1`, because those are
 * read out of every file already on disk — renaming them would orphan the
 * lot, which is the one rename this project never makes (CLAUDE.md). The
 * macOS UTI stays `com.proteus.opendraft.document` for the same reason: it is
 * the identity the OS has already recorded against every saved script.
 *
 * `.odraft` therefore stays OPENABLE forever. It is not deprecated, it is
 * previous — every script Derek saved before v7.21 has that name, and a file
 * the app wrote is a file the app opens.
 */

/** What new files are named. */
export const SCRIPT_EXT = 'script';

/** Older names the app still opens. Order matters only for display.
 *  - `odraft`  the name from v0 to v7.20
 *  - `json`    the v1.16–v7.17 folder copies, which were `<title>.odraft.json`
 *              (their LAST extension is what a file dialog matches on) */
export const LEGACY_SCRIPT_EXTS = ['odraft', 'json'] as const;

/** Every extension the app will open as one of its own scripts. */
export const SCRIPT_EXTS = [SCRIPT_EXT, ...LEGACY_SCRIPT_EXTS];

/** True when `ext` (no dot, any case) is one of ours. */
export function isScriptExt(ext: string | undefined | null): boolean {
  return !!ext && SCRIPT_EXTS.includes(ext.toLowerCase());
}

/** The label shown for an opened file's source format. */
export const SCRIPT_FORMAT_LABEL = `ScriptCraft (.${SCRIPT_EXT})`;

/** `<name>.script` — the one place a script filename is assembled. */
export function scriptFileName(base: string): string {
  return `${base}.${SCRIPT_EXT}`;
}
