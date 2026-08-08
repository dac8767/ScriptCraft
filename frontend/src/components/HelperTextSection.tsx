/**
 * HelperTextSection (v6.20; own window since v6.22; v6.24 batch) — the guts
 * of the Helper Text editor. Derek: "edit every single piece of helper text
 * in the app," then (v6.24): rows GROUPED by where they're found (ribbon,
 * menus, side panel, quick access toolbar, tool windows…), the found-in
 * info ON SCREEN (not a hover), a hide button per row so reviewed items can
 * be cleared (recallable via the Hidden view, persisted), and a go-there
 * button that opens the surface the text lives in WITHOUT closing this
 * window (utils/helperTextDestinations).
 *
 * Overrides key on the DEFAULT string (helperTextOverrides): editing
 * "Delete" retitles every Delete tooltip at once. Delivery is
 * utils/helperText.ts: the DOM applier for title/placeholder, ht()/useHt()
 * for rendered hints. The catalog (+ areas, icons, labels) is generated —
 * devtools/build-helper-catalog.mjs.
 */
import { useMemo, useState } from 'react';
import { LuRotateCcw } from 'react-icons/lu';
import { FaRegEye, FaRegEyeSlash, FaExternalLinkAlt, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { helperDestination } from '../utils/helperTextDestinations';
import { HELPER_ICONS } from '../data/helperTextIcons';
import catalog from '../data/helperTextCatalog.json';

export interface HelperEntry {
  text: string; kind: string; sites: number; area: string; where: string[];
  icon?: string; label?: string;
}

const KIND_LABEL: Record<string, string> = {
  tooltip: 'Hover', placeholder: 'Field', hint: 'Hint',
};
const KIND_FILTERS = ['all', 'tooltip', 'placeholder', 'hint'] as const;

/** Derek's naming order first; every other area alphabetical; the unmapped
 *  bucket last. */
const AREA_ORDER = [
  'Ribbon Toolbar', 'Quick Access Toolbar', 'Menus', 'Context Menu',
  'Side Panel & Window Chrome', 'Status Bar', 'Editor & Preview',
];
const AREA_LAST = 'Everything Else';

export const HELPER_CATALOG = catalog as HelperEntry[];

/** The catalog rows matching the window's search box. */
export function filterHelperCatalog(q: string): HelperEntry[] {
  if (!q) return HELPER_CATALOG;
  return HELPER_CATALOG.filter((e) =>
    e.text.toLowerCase().includes(q)
    || e.label?.toLowerCase().includes(q)
    || e.area.toLowerCase().includes(q)
    || e.where.some((w) => w.toLowerCase().includes(q)));
}

/** Grow the row's textarea to its content — never an inner scrollbar. */
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const prettyFile = (w: string) => w.replace(/^(components|editor|utils)\//, '').replace(/\.tsx?$/, '');

function HelperRow({ entry }: { entry: HelperEntry }) {
  const override = useEditorStore((s) => s.helperTextOverrides[entry.text]);
  const setOverride = useEditorStore((s) => s.setHelperTextOverride);
  const toggleHidden = useEditorStore((s) => s.toggleHelperTextHidden);
  const hidden = useEditorStore((s) => s.helperTextHidden.includes(entry.text));
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? override ?? entry.text;
  const edited = override !== undefined;
  const Icon = entry.icon ? HELPER_ICONS[entry.icon] : null;
  const dest = helperDestination(entry.where);
  /* v6.24, Derek: the found-in info renders ON SCREEN, not as hover text. */
  const foundIn = entry.where.map(prettyFile).join(', ');

  const commit = (raw: string) => {
    const v = raw.trim();
    /* v6.38, Derek: a BLANK field is a real choice — "there is no helper
       text for that item". Empty commits as an '' override (title/placeholder
       go empty wherever the string appears); the reset button is the way
       back to the app's own text. Only typing the default verbatim clears. */
    setOverride(entry.text, v === entry.text ? null : v);
    setDraft(null);
  };

  return (
    <div className={`dz-row ht-row${edited ? ' dz-row-on' : ''}`}>
      <div className="ht-row-head">
        <span className="ht-ctx">
          {Icon && <span className="ht-ctx-icon"><Icon /></span>}
          <span className="ht-ctx-label">{entry.label ?? prettyFile(entry.where[0] ?? '')}</span>
        </span>
        <span className="ht-kind">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
        {dest && (
          <button
            className="ht-iconbtn ht-goto"
            title={dest.label}
            onClick={dest.go}
          ><FaExternalLinkAlt /></button>
        )}
        <button
          className="ht-iconbtn ht-hide"
          title={hidden ? 'Put this item back in the list' : 'Hide this item — it moves to the Hidden view'}
          onClick={() => toggleHidden(entry.text)}
        >{hidden ? <FaRegEye /> : <FaRegEyeSlash />}</button>
        <button
          className="dz-reset"
          title={edited ? 'Reset to the app’s own text' : 'Default'}
          disabled={!edited}
          onClick={() => { setDraft(null); setOverride(entry.text, null); }}
        ><LuRotateCcw /></button>
      </div>
      <div className="ht-where">Found in: {foundIn}</div>
      {edited && <div className="ht-default" title="The app’s own text">{entry.text}</div>}
      {/* v6.24, Derek: line breaks allowed — a TEXTAREA that grows with
          its content. Enter = a new line; blur commits; Escape reverts.
          Multi-line shows wherever the text renders as content or in the
          hover bubble (white-space: pre-line); a single-line field's
          placeholder just runs the lines together. */}
      <textarea
        className="ht-input"
        data-ht-for={entry.text}
        rows={1}
        value={shown}
        onFocus={(e) => { setDraft(shown); autoGrow(e.currentTarget); }}
        onChange={(e) => { setDraft(e.target.value); autoGrow(e.currentTarget); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
        }}
        onBlur={() => { if (draft !== null) commit(draft); }}
      />
    </div>
  );
}

export function HelperTextSection({ entries }: { entries: HelperEntry[] }) {
  const overrides = useEditorStore((s) => s.helperTextOverrides);
  const hiddenList = useEditorStore((s) => s.helperTextHidden);
  const resetAllHelperText = useEditorStore((s) => s.resetAllHelperText);
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());

  const hiddenSet = useMemo(() => new Set(hiddenList), [hiddenList]);
  const byKind = kind === 'all' ? entries : entries.filter((e) => e.kind === kind);
  /* v6.24: the main list omits rows Derek has checked off; the Hidden view
     shows exactly those, each with a put-it-back eye. */
  const visible = byKind.filter((e) => (showHidden ? hiddenSet.has(e.text) : !hiddenSet.has(e.text)));

  /* v6.24: grouped by AREA — Derek's named surfaces first, windows A→Z,
     the unmapped bucket last. Groups fold; all start open (every row shows
     at once, v6.22's rule, just organized). */
  const groups = useMemo(() => {
    const m = new Map<string, HelperEntry[]>();
    for (const e of visible) {
      const g = m.get(e.area) ?? [];
      g.push(e); m.set(e.area, g);
    }
    const rank = (a: string) => {
      const i = AREA_ORDER.indexOf(a);
      if (i >= 0) return `0${i.toString().padStart(2, '0')}`;
      return a === AREA_LAST ? '9' : `5${a}`;
    };
    return [...m.entries()].sort(([a], [b]) => rank(a).localeCompare(rank(b)));
  }, [visible]);

  const editedCount = Object.keys(overrides).length;
  const toggleFold = (area: string) => setFolded((f) => {
    const n = new Set(f);
    if (n.has(area)) n.delete(area); else n.add(area);
    return n;
  });

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
          <button
            className={`dz-choice ht-hiddenchip${showHidden ? ' on' : ''}`}
            title="Items you've hidden from the list"
            onClick={() => setShowHidden((v) => !v)}
          >Hidden ({hiddenList.length})</button>
        </div>
        {editedCount > 0 && (
          <button className="dz-foot-btn ht-reset-all" onClick={resetAllHelperText}>
            <LuRotateCcw /> Reset helper text ({editedCount})
          </button>
        )}
      </div>
      {groups.map(([area, rows]) => {
        const open = !folded.has(area);
        return (
          <div className="dz-group" key={area}>
            <button className="dz-group-head" onClick={() => toggleFold(area)}>
              {open ? <FaChevronDown /> : <FaChevronRight />}
              <span>{area}</span>
              <span className="ht-group-count">{rows.length}</span>
            </button>
            {open && rows.map((e) => <HelperRow key={e.text} entry={e} />)}
          </div>
        );
      })}
      {visible.length === 0 && (
        <div className="dz-hint ht-more">
          {showHidden ? 'Nothing hidden.' : 'Nothing matches.'}
        </div>
      )}
    </>
  );
}
