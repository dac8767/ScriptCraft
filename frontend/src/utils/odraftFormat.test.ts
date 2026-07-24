/**
 * The .odraft native save format — exportOdraft -> parseOdraft round-trip is the
 * headline: this is the file every user script is saved as (the name is kept from
 * the OpenDraft days on purpose — renaming persisted identifiers orphans data,
 * CLAUDE.md). Pins the exact JSON envelope (version 1, format tag, 2-space
 * indent, key order), that only the four portable meta fields are written, the
 * themes-only-when-non-empty rule, and parseOdraft's tolerance of malformed /
 * legacy input. exported_at delegates to Date; outside the fake-clock test it is
 * asserted structurally only (toISOString is fixed-format UTC, so no locale flake).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScriptMeta } from '../services/api';
import { exportOdraft, parseOdraft, downloadOdraft } from './odraftFormat';
import { saveFile } from './fileOps';

// downloadOdraft dynamically imports ./fileOps (Tauri-backed) — replace it wholesale
// so the real module (and its Tauri imports) never loads.
vi.mock('./fileOps', () => ({ saveFile: vi.fn().mockResolvedValue(true) }));

/** Full ScriptMeta — the format must copy only title/author/color/page_count of these. */
const meta = (over: Partial<ScriptMeta> = {}): ScriptMeta => ({
  id: 'scr_1',
  title: 'Cold Open',
  author: 'Derek',
  format: 'screenplay',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  page_count: 12,
  size_bytes: 2048,
  color: '#7a5cff',
  pinned: true,
  sort_order: 3,
  preview: 'INT. HOUSE - DAY',
  ...over,
});

/** Realistic nested TipTap content, with attrs and marks, to prove deep round-trip. */
const CONTENT: Record<string, unknown> = {
  type: 'doc',
  content: [
    {
      type: 'sceneHeading',
      attrs: { sceneNumber: '1' },
      content: [{ type: 'text', text: 'INT. HOUSE - DAY' }],
    },
    {
      type: 'action',
      content: [
        { type: 'text', text: 'Rain hammers the glass.', marks: [{ type: 'scriptNote', attrs: { color: 'yellow' } }] },
      ],
    },
  ],
};

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('exportOdraft', () => {
  it('produces an application/json blob', () => {
    expect(exportOdraft(meta(), CONTENT).type).toBe('application/json');
  });

  it('writes the exact byte-for-byte envelope (clock pinned)', async () => {
    // Build the blob under a fake clock, restore real timers BEFORE awaiting
    // blob.text() so the async read never interacts with fake timers.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.678Z'));
    let blob: Blob;
    try {
      blob = exportOdraft(meta({ title: 'A', author: 'B', color: '#fff', page_count: 2 }), { k: 1 });
    } finally {
      vi.useRealTimers();
    }
    // Hand-computed: JSON.stringify(data, null, 2) with the literal's key order.
    expect(await blob.text()).toBe([
      '{',
      '  "odraft_version": 1,',
      '  "format": "opendraft-script",',
      '  "exported_at": "2026-01-02T03:04:05.678Z",',
      '  "meta": {',
      '    "title": "A",',
      '    "author": "B",',
      '    "color": "#fff",',
      '    "page_count": 2',
      '  },',
      '  "content": {',
      '    "k": 1',
      '  }',
      '}',
    ].join('\n'));
  });

  it('copies ONLY the four portable meta fields — no id, pinned, timestamps, preview', async () => {
    const data = JSON.parse(await exportOdraft(meta(), CONTENT).text());
    expect(Object.keys(data.meta)).toEqual(['title', 'author', 'color', 'page_count']);
    expect(data.meta).toEqual({ title: 'Cold Open', author: 'Derek', color: '#7a5cff', page_count: 12 });
    expect(data.exported_at).toMatch(ISO_UTC); // structural only — real clock here
  });

  it('omits the themes key entirely when themes are undefined OR an empty array', async () => {
    const withoutArg = JSON.parse(await exportOdraft(meta(), CONTENT).text());
    const withEmpty = JSON.parse(await exportOdraft(meta(), CONTENT, []).text());
    expect('themes' in withoutArg).toBe(false);
    expect('themes' in withEmpty).toBe(false);
  });

  it('appends themes as the last key when non-empty (v0.82 travel-with-file)', async () => {
    const data = JSON.parse(await exportOdraft(meta(), CONTENT, [{ name: 'Noir' }]).text());
    expect(data.themes).toEqual([{ name: 'Noir' }]);
    expect(Object.keys(data)).toEqual(['odraft_version', 'format', 'exported_at', 'meta', 'content', 'themes']);
  });
});

describe('exportOdraft -> parseOdraft round-trip', () => {
  it('round-trips the four meta fields and deeply nested content exactly', async () => {
    const text = await exportOdraft(meta(), CONTENT).text();
    // toEqual pins the FULL result shape — no extra keys may appear.
    expect(parseOdraft(text)).toEqual({
      meta: { title: 'Cold Open', author: 'Derek', color: '#7a5cff', page_count: 12 },
      content: CONTENT,
    });
  });

  it('round-trips a page_count of 0 (falsy but preserved — || 0 keeps 0)', async () => {
    const text = await exportOdraft(meta({ page_count: 0 }), CONTENT).text();
    expect(parseOdraft(text).meta.page_count).toBe(0);
  });

  // KNOWN LIMITATION: parseOdraft uses `|| 'Untitled'`, so a script whose title is
  // the empty string does NOT round-trip — export writes "" and parse reads back
  // 'Untitled'. The module header's "lossless round-tripping" claim has this hole.
  it('turns an empty-string title into "Untitled" (lossy, pinned as-is)', async () => {
    const text = await exportOdraft(meta({ title: '' }), CONTENT).text();
    expect(parseOdraft(text).meta.title).toBe('Untitled');
    // ...while empty author/color survive, because their fallbacks are also ''.
    const text2 = await exportOdraft(meta({ author: '', color: '' }), CONTENT).text();
    expect(parseOdraft(text2).meta).toEqual({ title: 'Cold Open', author: '', color: '', page_count: 12 });
  });

  // KNOWN LIMITATION: exportOdraft writes themes into the file, but parseOdraft
  // never returns them — the import-themes flow must re-parse the JSON itself.
  it('drops themes on parse even though export wrote them', async () => {
    const text = await exportOdraft(meta(), CONTENT, [{ name: 'Noir' }]).text();
    const result = parseOdraft(text);
    expect('themes' in result).toBe(false);
    expect(Object.keys(result)).toEqual(['meta', 'content']);
  });
});

describe('parseOdraft on malformed / legacy input', () => {
  it('rejects non-JSON with the friendly message', () => {
    expect(() => parseOdraft('not json {')).toThrow('Invalid .odraft file: not valid JSON');
    expect(() => parseOdraft('')).toThrow('Invalid .odraft file: not valid JSON');
  });

  // KNOWN LIMITATION: `null` IS valid JSON, so it survives JSON.parse — then
  // `data.format` crashes with a raw TypeError instead of the friendly error.
  it('crashes with a TypeError on the JSON literal null (pinned as-is)', () => {
    expect(() => parseOdraft('null')).toThrow(TypeError);
  });

  it('rejects valid JSON that is not an opendraft-script envelope', () => {
    for (const text of [
      '{}',
      '{"format":"fountain","odraft_version":1}',
      '[]',
      '"opendraft-script"', // the tag as a bare string, not an envelope
      '42',
      'true',
    ]) {
      expect(() => parseOdraft(text), `should reject ${text}`).toThrow('Invalid .odraft file: unrecognized format');
    }
  });

  it('rejects a missing or non-numeric version (format check runs first)', () => {
    expect(() => parseOdraft('{"format":"opendraft-script"}')).toThrow('Invalid .odraft file: missing version');
    // A hand-edited file with a STRING version is treated as missing.
    expect(() => parseOdraft('{"format":"opendraft-script","odraft_version":"1"}')).toThrow(
      'Invalid .odraft file: missing version',
    );
  });

  // KNOWN LIMITATION: there is no known-version gate — ANY number passes, so a
  // future v999 file (or a nonsense v0) parses silently instead of warning.
  it('accepts any numeric odraft_version, including 999 and 0', () => {
    for (const v of [999, 0]) {
      const result = parseOdraft(JSON.stringify({ format: 'opendraft-script', odraft_version: v, content: { a: 1 } }));
      expect(result.content).toEqual({ a: 1 });
    }
  });

  it('defaults every field when meta and content are missing entirely', () => {
    expect(parseOdraft('{"format":"opendraft-script","odraft_version":1}')).toEqual({
      meta: { title: 'Untitled', author: '', color: '', page_count: 0 },
      content: {},
    });
  });

  it('fills per-field defaults for a partial meta and null content', () => {
    const text = JSON.stringify({
      format: 'opendraft-script',
      odraft_version: 1,
      meta: { title: 'Only Title' },
      content: null,
    });
    expect(parseOdraft(text)).toEqual({
      meta: { title: 'Only Title', author: '', color: '', page_count: 0 },
      content: {},
    });
  });

  // KNOWN LIMITATION: meta values are not type-checked — a string page_count from
  // a hand-edited file passes straight through despite the declared number type.
  it('passes wrongly-typed meta values through unvalidated (pinned as-is)', () => {
    const text = JSON.stringify({
      format: 'opendraft-script',
      odraft_version: 1,
      meta: { title: 'T', page_count: '12' },
    });
    expect(parseOdraft(text).meta.page_count).toBe('12' as unknown as number);
  });
});

describe('downloadOdraft', () => {
  it('saves the export text as "<title>.odraft" with the ScriptCraft filter', async () => {
    await downloadOdraft(meta(), CONTENT);
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [text, filename, filters] = vi.mocked(saveFile).mock.calls[0];
    expect(filename).toBe('Cold Open.odraft');
    expect(filters).toEqual([{ name: 'ScriptCraft', extensions: ['odraft'] }]);
    expect(JSON.parse(text as string).meta.title).toBe('Cold Open');
  });

  it('falls back to Untitled.odraft when the title is empty', async () => {
    await downloadOdraft(meta({ title: '' }), CONTENT);
    expect(vi.mocked(saveFile).mock.calls[0][1]).toBe('Untitled.odraft');
  });
});
