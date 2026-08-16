/**
 * The title page's draft line — written in ONE place, in the Settings format.
 *
 * v7.24, Derek: "the date format on the title page is still not matching the
 * date format I picked in setting > DATES & TIMES" — his page read
 * "First Draft - 2026-07-17" with the setting on Local (8/16/2026).
 *
 * WHY IT SURVIVED THE v7.11 FIX. That fix taught the title-page BUILDERS to
 * format the date, and the Title Page editor does pass the setting. But the
 * draft line is stored in the document as plain TEXT, so once a page had been
 * built with an ISO date nothing ever reformatted it:
 *   · Set Draft copied the existing date suffix VERBATIM, so every later
 *     draft change carried the old format forward;
 *   · the three importers (fountain, fdx, docx) pass no format at all.
 *
 * The structured date is still there — `tpDraftDate` rides on the TITLE
 * node's attrs, because titlePageBlockSpecs spreads the whole TitlePageData
 * onto it. So the line is always RE-DERIVED from the structured fields rather
 * than parsed back out of its own rendering, and the label/date join goes
 * through deriveTitleFields, the same joiner the builders use.
 */
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { TitlePageAttrs } from '../editor/extensions/TitlePage';
import { EMPTY_TITLE_PAGE, deriveTitleFields } from './titlePageLayout';
import type { DateFormatId } from './dateFormat';

/**
 * Stamped on a transaction that only re-renders a stored value in the current
 * display format. ScreenplayEditor's unsaved-changes tracker ignores it: a
 * preference catching up is not an edit the writer made, and marking a
 * freshly-opened script dirty is a worse bug than the one this fixes.
 */
export const DISPLAY_REFRESH_META = 'tpDisplayRefresh';

/** The first titlePage node with field='title' — the one carrying the
 *  structured TitlePageData. Shared with the Title Page editor. */
export function findTitlePageNode(editor: Editor): { pos: number; attrs: TitlePageAttrs } | null {
  let found: { pos: number; attrs: TitlePageAttrs } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'titlePage' && node.attrs.field === 'title') {
      found = { pos, attrs: node.attrs as TitlePageAttrs };
      return false;
    }
    return true;
  });
  return found;
}

/** The rendered draft line's node. */
function findDraftNode(editor: Editor): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'titlePage' && node.attrs.field === 'draft') {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Rewrite the title page's draft line.
 *
 * `label` given (Set Draft Number) — a real edit: it goes into the undo stack
 * and into the title node's `tpDraft` attr, so the structure and the rendering
 * stay in step. Leave it out and only the DATE is re-rendered, silently.
 *
 * A page whose title node carries no `tpDraftDate` (a legacy or hand-typed
 * page) keeps whatever date text it already shows — there is no structured
 * value to re-derive from, and an imported .fdx date is not ours to reformat.
 *
 * Returns true when the document changed.
 */
export function writeTitlePageDraftLine(
  editor: Editor,
  opts: { dateFormat: DateFormatId; label?: string },
): boolean {
  if (editor.isDestroyed) return false;
  const draft = findDraftNode(editor);
  if (!draft) return false;            // no draft line on this page to update
  const title = findTitlePageNode(editor);
  const storedLabel = (title?.attrs.tpDraft as string) || '';
  const storedDate = (title?.attrs.tpDraftDate as string) || '';

  const oldText = draft.node.textContent || '';
  /* Split the rendered line on the LAST " - ", the separator the builders
     write. Greedy on purpose: a lazy head turns "Pre-Production Draft -
     2026-07-17" into the label "Pre", which is what the code this replaced
     did — the hyphen inside a label is not the separator. */
  const shown = oldText.match(/^(.*)\s+[-–—]\s+(.+)$/);
  const shownLabel = shown ? shown[1] : oldText;
  const shownTail = shown ? shown[2] : '';

  /* A refresh (no label) re-renders the DATE and nothing else — the label
     half is left exactly as the page shows it. Reading the label from
     tpDraft instead would erase the visible label of any page that has no
     structured one, which is every legacy and hand-typed title page. */
  const label = opts.label ?? shownLabel;
  // A display refresh re-renders text; it never CREATES any. No stored date
  // (nothing to re-render) or an empty line (nothing rendered) — leave it.
  if (opts.label === undefined && (!storedDate || !oldText)) return false;

  // The date half. With a structured value, re-derive it; without one, the
  // line's own tail is all the date there is.
  const shownDate = storedDate
    ? deriveTitleFields({ ...EMPTY_TITLE_PAGE, tpDraftDate: storedDate }, opts.dateFormat).draftLine
    : shownTail;
  // The join is the builders' join — one rule for "Label - Date".
  const newText = deriveTitleFields({ ...EMPTY_TITLE_PAGE, tpDraft: label, tpDraftDate: shownDate }).draftLine;

  const relabel = opts.label !== undefined && !!title && storedLabel !== label;
  if (newText === oldText && !relabel) return false;

  const tr = editor.state.tr;
  if (newText !== oldText) {
    tr.replaceWith(
      draft.pos + 1, draft.pos + draft.node.nodeSize - 1,
      newText ? editor.state.schema.text(newText) : [],
    );
  }
  if (relabel && title) {
    tr.setNodeMarkup(tr.mapping.map(title.pos), undefined, { ...title.attrs, tpDraft: label });
  }
  if (opts.label === undefined) {
    tr.setMeta('addToHistory', false);
    tr.setMeta(DISPLAY_REFRESH_META, true);
  }
  editor.view.dispatch(tr);
  return true;
}

/** Re-render the stored draft date in `dateFormat`. Nothing else moves. */
export function refreshTitlePageDraftDate(editor: Editor, dateFormat: DateFormatId): boolean {
  return writeTitlePageDraftLine(editor, { dateFormat });
}
