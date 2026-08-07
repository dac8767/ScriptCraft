/**
 * HelperTextSection (v6.20; own window since v6.22) — the guts of the Helper
 * Text editor. Derek: "edit every single piece of helper text in the app …
 * blank lists and fields, hover text, helper text for buttons and windows,
 * the ? button text."
 *
 * Lists every string the generated catalog knows (tooltips, field
 * placeholders, content hints — devtools/build-helper-catalog.mjs) with an
 * edit field per row — ALL of them at once (v6.22; the 60-row cap is gone).
 * Each row leads with the control it belongs to: the control's ICON and/or
 * visible text where the scan found one (v6.22), else the source file's
 * name. Overrides key on the DEFAULT string (helperTextOverrides): editing
 * "Delete" retitles every Delete tooltip at once — they were the same
 * string on purpose. Delivery is utils/helperText.ts: the DOM applier for
 * title/placeholder, ht()/useHt() for rendered hints.
 */
import { useState } from 'react';
import { LuRotateCcw } from 'react-icons/lu';
import { useEditorStore } from '../stores/editorStore';
import { HELPER_ICONS } from '../data/helperTextIcons';
import catalog from '../data/helperTextCatalog.json';

export interface HelperEntry {
  text: string; kind: string; sites: number; where: string[];
  icon?: string; label?: string;
}

const KIND_LABEL: Record<string, string> = {
  tooltip: 'Hover', placeholder: 'Field', hint: 'Hint',
};
const KIND_FILTERS = ['all', 'tooltip', 'placeholder', 'hint'] as const;

export const HELPER_CATALOG = catalog as HelperEntry[];

/** The catalog rows matching the window's search box. */
export function filterHelperCatalog(q: string): HelperEntry[] {
  if (!q) return HELPER_CATALOG;
  return HELPER_CATALOG.filter((e) =>
    e.text.toLowerCase().includes(q)
    || e.label?.toLowerCase().includes(q)
    || e.where.some((w) => w.toLowerCase().includes(q)));
}

/** "Which control is this?" — icon + visible text when the scan found them,
 *  else the source file's basename. */
function RowContext({ entry }: { entry: HelperEntry }) {
  const Icon = entry.icon ? HELPER_ICONS[entry.icon] : null;
  const fallback = entry.where[0]?.replace(/^components\//, '').replace(/\.tsx?$/, '');
  return (
    <span className="ht-ctx" title={`Found in: ${entry.where.join(', ')}`}>
      {Icon && <span className="ht-ctx-icon"><Icon /></span>}
      <span className="ht-ctx-label">{entry.label ?? fallback}</span>
    </span>
  );
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
        <RowContext entry={entry} />
        <span className="ht-kind">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
        <button
          className="dz-reset"
          title={edited ? 'Reset to the app’s own text' : 'Default'}
          disabled={!edited}
          onClick={() => { setDraft(null); setOverride(entry.text, null); }}
        ><LuRotateCcw /></button>
      </div>
      {edited && <div className="ht-default" title="The app’s own text">{entry.text}</div>}
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
      {/* v6.22, Derek: EVERY row renders — no cap, no "N more" note. */}
      {visible.map((e) => <HelperRow key={e.text} entry={e} />)}
      {visible.length === 0 && <div className="dz-hint ht-more">Nothing matches.</div>}
    </>
  );
}
