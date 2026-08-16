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
import { odraftTextFor } from './saveLocations';
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
