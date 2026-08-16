// @vitest-environment jsdom
/**
 * The title page's draft line (v7.24).
 *
 * Derek: "the date format on the title page is still not matching the date
 * format I picked in setting > DATES & TIMES" — his page read
 * "First Draft - 2026-07-17" with the setting on Local.
 *
 * These drive the REAL document: build a title page the way the builders do
 * (structured data on the title node, rendered text on the draft node), then
 * read back what the writer actually produced. Asserting on the composition
 * rule in the abstract is what let this survive v7.11 — the rule was right,
 * the stored text simply never went back through it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { TitlePage } from '../editor/extensions/TitlePage';
import { EMPTY_TITLE_PAGE } from './titlePageLayout';
import {
  writeTitlePageDraftLine,
  refreshTitlePageDraftDate,
  findTitlePageNode,
  DISPLAY_REFRESH_META,
} from './titlePageDraftLine';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

/** A title page as the builders leave it: the structured fields on the title
 *  node, the draft line as rendered TEXT on its own node. */
function makeEditor(opts: { draft: string; draftDate: string; rendered: string }) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [Document, Text, TitlePage],
    content: {
      type: 'doc',
      content: [
        {
          type: 'titlePage',
          attrs: { ...EMPTY_TITLE_PAGE, field: 'title', tpTitle: 'EPISODE X', tpDraft: opts.draft, tpDraftDate: opts.draftDate },
          content: [{ type: 'text', text: 'EPISODE X' }],
        },
        {
          type: 'titlePage',
          attrs: { field: 'draft' },
          ...(opts.rendered ? { content: [{ type: 'text', text: opts.rendered }] } : {}),
        },
      ],
    },
  });
  return editor;
}

const draftText = (ed: Editor): string => {
  let out = '';
  ed.state.doc.descendants((n) => {
    if (n.type.name === 'titlePage' && n.attrs.field === 'draft') { out = n.textContent; return false; }
    return true;
  });
  return out;
};

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

describe('refreshTitlePageDraftDate — the setting reaches an existing page', () => {
  it('re-renders a stored ISO date in the chosen format (Derek\'s page)', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: 'First Draft - 2026-07-17' });
    expect(refreshTitlePageDraftDate(ed, 'local')).toBe(true);
    expect(draftText(ed)).toBe('First Draft - 7/17/2026');
  });

  it('is idempotent — a second pass changes nothing', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: 'First Draft - 2026-07-17' });
    refreshTitlePageDraftDate(ed, 'us');
    const once = draftText(ed);
    expect(refreshTitlePageDraftDate(ed, 'us')).toBe(false);
    expect(draftText(ed)).toBe(once);
  });

  it('leaves a page with no structured date alone — an imported date is not ours to reformat', () => {
    const ed = makeEditor({ draft: '', draftDate: '', rendered: 'Shooting Draft - Spring 2026' });
    expect(refreshTitlePageDraftDate(ed, 'iso')).toBe(false);
    expect(draftText(ed)).toBe('Shooting Draft - Spring 2026');
  });

  it('never CREATES a draft line — an empty one stays empty', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: '' });
    expect(refreshTitlePageDraftDate(ed, 'local')).toBe(false);
    expect(draftText(ed)).toBe('');
  });

  it('keeps a hyphen INSIDE the label — only the " - " separator splits', () => {
    const ed = makeEditor({ draft: 'Pre-Production Draft', draftDate: '2026-07-17', rendered: 'Pre-Production Draft - 2026-07-17' });
    refreshTitlePageDraftDate(ed, 'local');
    expect(draftText(ed)).toBe('Pre-Production Draft - 7/17/2026');
  });

  it('leaves the label alone even when the structured one disagrees', () => {
    // A refresh re-renders the DATE. Taking the label from tpDraft would
    // erase the visible label of every page that has no structured one.
    const ed = makeEditor({ draft: '', draftDate: '2026-07-17', rendered: 'Shooting Draft - 2026-07-17' });
    refreshTitlePageDraftDate(ed, 'local');
    expect(draftText(ed)).toBe('Shooting Draft - 7/17/2026');
  });

  it('marks the transaction as a display refresh, and keeps it out of undo', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: 'First Draft - 2026-07-17' });
    let seen: { display: unknown; history: unknown } | null = null;
    ed.on('transaction', ({ transaction }) => {
      if (transaction.docChanged) seen = { display: transaction.getMeta(DISPLAY_REFRESH_META), history: transaction.getMeta('addToHistory') };
    });
    refreshTitlePageDraftDate(ed, 'local');
    expect(seen).toEqual({ display: true, history: false });
  });
});

describe('writeTitlePageDraftLine with a label — Set Draft Number', () => {
  it('re-renders the date instead of copying the old suffix forward', () => {
    // The v7.23 bug: the label changed, the ISO date rode along verbatim.
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: 'First Draft - 2026-07-17' });
    expect(writeTitlePageDraftLine(ed, { dateFormat: 'local', label: 'Second Draft' })).toBe(true);
    expect(draftText(ed)).toBe('Second Draft - 7/17/2026');
  });

  it('writes the new label into the structured field too, so a later refresh keeps it', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: 'First Draft - 2026-07-17' });
    writeTitlePageDraftLine(ed, { dateFormat: 'local', label: 'Second Draft' });
    expect(findTitlePageNode(ed)?.attrs.tpDraft).toBe('Second Draft');
    // …and the refresh does not resurrect "First Draft"
    refreshTitlePageDraftDate(ed, 'iso');
    expect(draftText(ed)).toBe('Second Draft - 2026-07-17');
  });

  it('is a real edit — it goes into undo and is not stamped as a display refresh', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '2026-07-17', rendered: 'First Draft - 2026-07-17' });
    let meta: { display: unknown; history: unknown } | null = null;
    ed.on('transaction', ({ transaction }) => {
      if (transaction.docChanged) meta = { display: transaction.getMeta(DISPLAY_REFRESH_META), history: transaction.getMeta('addToHistory') };
    });
    writeTitlePageDraftLine(ed, { dateFormat: 'local', label: 'Second Draft' });
    expect(meta).toEqual({ display: undefined, history: undefined });
  });

  it('keeps a legacy page\'s own date tail when there is nothing structured', () => {
    const ed = makeEditor({ draft: '', draftDate: '', rendered: 'First Draft - Spring 2026' });
    writeTitlePageDraftLine(ed, { dateFormat: 'local', label: 'Second Draft' });
    expect(draftText(ed)).toBe('Second Draft - Spring 2026');
  });

  it('a label with no date at all stands alone — no dangling dash', () => {
    const ed = makeEditor({ draft: 'First Draft', draftDate: '', rendered: 'First Draft' });
    writeTitlePageDraftLine(ed, { dateFormat: 'local', label: 'Second Draft' });
    expect(draftText(ed)).toBe('Second Draft');
  });
});
