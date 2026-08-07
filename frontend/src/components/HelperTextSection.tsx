/**
 * HelperTextSection (v6.20) — the Design window's "Helper Text" group.
 * Derek: "edit every single piece of helper text in the app … blank lists
 * and fields, hover text, helper text for buttons and windows, the ? button
 * text."
 *
 * Lists every string the generated catalog knows (tooltips, field
 * placeholders, content hints — devtools/build-helper-catalog.mjs) with an
 * edit field per row. Overrides are keyed by the DEFAULT string
 * (helperTextOverrides in the store): editing "Delete" retitles every
 * Delete tooltip at once — they were the same string on purpose. Delivery
 * is utils/helperText.ts: the DOM applier for title/placeholder, ht()/useHt()
 * for rendered hints.
 */
import { useState } from 'react';
import { LuRotateCcw } from 'react-icons/lu';
import { useEditorStore } from '../stores/editorStore';
import catalog from '../data/helperTextCatalog.json';

export interface HelperEntry { text: string; kind: string; sites: number; where: string[] }

const KIND_LABEL: Record<string, string> = {
  tooltip: 'Hover', placeholder: 'Field', hint: 'Hint',
};
const KIND_FILTERS = ['all', 'tooltip', 'placeholder', 'hint'] as const;
const SHOW_CAP = 60;

export const HELPER_CATALOG = catalog as HelperEntry[];

/** The catalog rows matching the Design window's search box. */
export function filterHelperCatalog(q: string): HelperEntry[] {
  if (!q) return HELPER_CATALOG;
  return HELPER_CATALOG.filter((e) => e.text.toLowerCase().includes(q));
}

function HelperRow({ entry }: { entry: HelperEntry }) {
  const override = useEditorStore((s) => s.helperTextOverrides[entry.text]);
  const setOverride = useEditorStore((s) => s.setHelperTextOverride);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? override ?? entry.text;
  const edited = override !== undefined;

  const commit = (raw: string) => {
    const v = raw.trim();
    setOverride(entry.text, v === '' || v === entry.text ? null : v);
    setDraft(null);
  };

  return (
    <div className={`dz-row ht-row${edited ? ' dz-row-on' : ''}`}>
      <div className="ht-row-head">
        <span className="ht-kind">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
        {edited && <span className="ht-default" title="The app's own text">{entry.text}</span>}
        <button
          className="dz-reset"
          title={edited ? 'Reset to the app’s own text' : 'Default'}
          disabled={!edited}
          onClick={() => { setDraft(null); setOverride(entry.text, null); }}
        ><LuRotateCcw /></button>
      </div>
      <input
        className="ht-input"
        value={shown}
        onFocus={() => setDraft(shown)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
        }}
        onBlur={() => { if (draft !== null) commit(draft); }}
      />
    </div>
  );
}

export function HelperTextSection({ entries }: { entries: HelperEntry[] }) {
  const overrides = useEditorStore((s) => s.helperTextOverrides);
  const resetAllHelperText = useEditorStore((s) => s.resetAllHelperText);
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>('all');

  const visible = kind === 'all' ? entries : entries.filter((e) => e.kind === kind);
  const shown = visible.slice(0, SHOW_CAP);
  const editedCount = Object.keys(overrides).length;

  return (
    <>
      <div className="ht-tools">
        <div className="ht-kinds">
          {KIND_FILTERS.map((k) => (
            <button
              key={k}
              className={`dz-choice${kind === k ? ' on' : ''}`}
              onClick={() => setKind(k)}
            >{k === 'all' ? `All (${entries.length})` : `${KIND_LABEL[k]}s`}</button>
          ))}
        </div>
        {editedCount > 0 && (
          <button className="dz-foot-btn ht-reset-all" onClick={resetAllHelperText}>
            <LuRotateCcw /> Reset helper text ({editedCount})
          </button>
        )}
      </div>
      {shown.map((e) => <HelperRow key={e.text} entry={e} />)}
      {visible.length > SHOW_CAP && (
        <div className="dz-hint ht-more">
          {visible.length - SHOW_CAP} more — search above to narrow the list.
        </div>
      )}
      {visible.length === 0 && <div className="dz-hint ht-more">Nothing in this group matches.</div>}
    </>
  );
}
