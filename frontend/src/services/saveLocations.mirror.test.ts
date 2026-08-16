// @vitest-environment jsdom
/**
 * The copy-in-a-folder mirror must write a file the app can OPEN.
 *
 * v7.18, Derek, testing v7.17 on his Mac: "saved on desktop. it saved as
 * Episode X.odraft.json / it will not open in the app."
 *
 * It couldn't. From v1.16 to v7.17 this mirror wrote the bare TipTap document
 * under a `.odraft.json` name, while a real .odraft is an envelope — so
 * parseOdraft rejected it as "unrecognized format", and the file dialog never
 * offered it in the first place because its last extension is `json`. The
 * auto-save mirror, same feature and same folder, had been writing the
 * envelope correctly since v6.42: two writers, one right.
 *
 * The single source is now odraftTextFor, and the assertion that matters is
 * the round trip — write it, open it, get the script back.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { odraftTextFor, copyFileBase } from './saveLocations';
import { parseOdraft } from '../utils/odraftFormat';

const DOC = {
  type: 'doc',
  content: [
    { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. KITCHEN - DAY' }] },
    { type: 'action', content: [{ type: 'text', text: 'She pours the coffee.' }] },
  ],
};

describe('the folder mirror writes an openable file', () => {
  it('round-trips through parseOdraft — write it, open it, get the script back', async () => {
    const parsed = parseOdraft(await odraftTextFor('Episode X', DOC));
    expect(parsed.content).toEqual(DOC);
  });

  it('carries the title, so the opened copy is not "Untitled"', async () => {
    expect(parseOdraft(await odraftTextFor('Episode X', DOC)).meta.title).toBe('Episode X');
  });

  it('is a real envelope, not a bare document', async () => {
    const data = JSON.parse(await odraftTextFor('Episode X', DOC));
    expect(data.format).toBe('opendraft-script');
    expect(data.odraft_version).toBe(1);
    // the failure this test exists for: a bare doc has `type` at the root
    expect(data.type).toBeUndefined();
  });

  it('an empty script still produces a valid file', async () => {
    const empty = { type: 'doc', content: [] };
    expect(parseOdraft(await odraftTextFor('', empty)).content).toEqual(empty);
  });
});

/**
 * v7.20, Derek, reading the file auto save produced: "the filename shouldnt
 * have spaces either. make autosave filenames in this format:
 * EpisodeX_autosave_08-15-26_23-15.odraft"
 */
describe('the copy filename', () => {
  const AT = new Date(2026, 7, 15, 23, 15);   // 08-15-26 23:15, local

  it('is exactly the shape Derek asked for', () => {
    expect(copyFileBase('Episode X', 'autosave', AT)).toBe('EpisodeX_autosave_08-15-26_23-15');
  });

  it('has no spaces, wherever they came from', () => {
    expect(copyFileBase('The Long Goodbye', 'Before the rewrite', AT))
      .toBe('TheLongGoodbye_Beforetherewrite_08-15-26_23-15');
  });

  it('pads the single digits, so names sort', () => {
    expect(copyFileBase('X', 'autosave', new Date(2026, 0, 2, 3, 4)))
      .toBe('X_autosave_01-02-26_03-04');
  });

  it('keeps a name with a slash from escaping the folder', () => {
    expect(copyFileBase('Act 1/2', 'autosave', AT)).toBe('Act1-2_autosave_08-15-26_23-15');
  });

  it('drops an empty part rather than leaving a double underscore', () => {
    expect(copyFileBase('Episode X', '', AT)).toBe('EpisodeX_08-15-26_23-15');
  });

  it('the auto-save tick passes the lowercase one-word kind', () => {
    // the caller's literal is what lands in the name — pinned here because
    // the format depends on it and it lives in another file
    const editorSrc = readFileSync('src/components/ScreenplayEditor.tsx', 'utf8');
    expect(editorSrc).toMatch(/message: 'autosave'/);
  });
});

/**
 * EVERY writer, not the one you were shown.
 *
 * This bug was fixed three times. v7.18 fixed the local Save As copy believing
 * it was "the mirror". v7.19 found the same thing in the two cloud SAVE
 * writers. v7.20 found it again in the two cloud SNAPSHOT writers — missed
 * twice because their filenames said `.json`, so a grep for "odraft" never
 * reached them. Six writers of the same file, in one module, found three at a
 * time.
 *
 * So the assertion is over the MODULE, not over a call: nothing in here may
 * serialize script content by hand, and no copy may be named `.json`.
 */
describe('no writer serializes script content by hand', () => {
  /* vitest serves modules over http, so import.meta.url is not a file URL —
     read from the project root, which is where vitest runs. */
  const src = readFileSync('src/services/saveLocations.ts', 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/^\s*\/\/.*$/gm, '');        // line comments

  it('no JSON.stringify of the payload content anywhere', () => {
    expect(code).not.toMatch(/JSON\.stringify\(\s*args\.content\s*\)/);
  });

  it('every script copy is named .odraft, never .json', () => {
    // filename templates: `…${…}.EXT` inside a path or name literal
    const exts = [...code.matchAll(/\$\{[^}]*\}\.(\w+)`/g)].map((m) => m[1]);
    expect(exts.length).toBeGreaterThan(0);
    expect(exts.filter((e) => e === 'json')).toEqual([]);
  });

  it('the serializer is used by every destination — local, Drive, OneDrive', () => {
    // 6 writers: save ×3 (local/gdrive/onedrive) + snapshot ×3
    expect((code.match(/odraftTextFor\(/g) ?? []).length).toBeGreaterThanOrEqual(7); // 6 calls + the definition
  });
});
