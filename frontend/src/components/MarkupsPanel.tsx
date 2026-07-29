/**
 * v5.25/v5.26: the Annotations tool window — every annotation on the script
 * in one list. A card shows the icon, a text preview, its page number and
 * scene heading; DOUBLE-CLICK jumps the script there AND opens the editor
 * popover (v5.26 — the edit button is gone); the checkbox completes it; the
 * ⋮ menu carries status / hide-type / delete.
 *
 * Header (v5.26): Filter — two sections, "Select one" (Open / Complete /
 * All) and "Select all that you want visible" (a GRID of the annotation
 * types actually in the script, with Show/Hide all); "Show in Script" — the
 * same type grid, but driving which types render in the EDITOR
 * (viewPrefs.markupHiddenIcons — the same list each ⋮ menu toggles); and
 * Search. The eye toggle and the count ride the window chrome as before.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { computePageBlocks } from '../editor/pagination';
import { ControlSearch } from './ToolControls';
import { MarkupIcon } from './markupIcons';
import { MarkupDotsMenu, iconLabel, useSeat, useDismiss } from './MarkupPickers';
import {
  createMarkupAtSelection, findMarkupPos, markupPreviewText,
  pageForPos, sceneHeadingBefore,
} from '../utils/markupActions';
import type { ScriptMarkup } from '../stores/slices/markupsSlice';

const DONE_LABELS = { open: 'Open', done: 'Complete', all: 'All' } as const;

/** Annotation types (icons) present in the script, plus any already-hidden
 *  selections — a hidden type must stay listed or it could never come back. */
function useTypesInUse(extra: string[]) {
  const markups = useEditorStore((s) => s.markups);
  return useMemo(
    () => [...new Set([...markups.map((m) => m.icon), ...extra])],
    [markups, extra],
  );
}

/** The shared two-part popover body: state toggle row + type grid. */
function TypeGridPop({ boxRef, pos, done, onDone, gridHelp, types, hidden, onToggle, onShowAll, onHideAll }: {
  boxRef: React.RefObject<HTMLDivElement | null>;
  pos: { top: number; left: number } | null;
  done: 'open' | 'done' | 'all';
  onDone: (d: 'open' | 'done' | 'all') => void;
  /** helper text over the type grid — the two popovers differ here */
  gridHelp: string;
  types: string[];
  hidden: string[];
  onToggle: (icon: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}) {
  return createPortal(
    <div ref={boxRef} className="markup-subpop markup-filter-pop" style={pos ?? { top: -9999, left: -9999 }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div className="markup-filter-help">Select one</div>
      {/* v5.27, Derek: the three states side by side as ONE toggle row */}
      <span className="markup-seg markup-filter-seg">
        {(['open', 'done', 'all'] as const).map((d) => (
          <button key={d} className={done === d ? 'active' : ''} onClick={() => onDone(d)}>
            {DONE_LABELS[d]}
          </button>
        ))}
      </span>
      <div className="markup-dots-sep" />
      <div className="markup-filter-help">{gridHelp}</div>
      {types.length === 0 && <div className="markup-filter-empty">No annotations yet.</div>}
      <div className="markup-filter-grid">
        {types.map((icon) => (
          <button
            key={icon}
            className={`markup-preset${hidden.includes(icon) ? '' : ' active'}`}
            title={iconLabel(icon)}
            onClick={() => onToggle(icon)}
          ><MarkupIcon icon={icon} /></button>
        ))}
      </div>
      <div className="markup-filter-allrow">
        <button className="markup-hl-clear" onClick={onShowAll}>Show all</button>
        <button className="markup-hl-clear" onClick={onHideAll}>Hide all</button>
      </div>
    </div>,
    document.body,
  );
}

export function MarkupsTitleExtra() {
  const markups = useEditorStore((s) => s.markups);
  const filters = useEditorStore((s) => s.markupFilters);
  const search = useEditorStore((s) => s.markupSearch);
  const shown = markups.filter((m) =>
    (filters.done === 'all' || (filters.done === 'done') === m.done)
    && !filters.hiddenIcons.includes(m.icon)
    && (!search || markupPreviewText(m).toLowerCase().includes(search.toLowerCase()))).length;
  return <span className="tool-title-extra">· {shown}</span>;
}

/* v5.27, Derek: the header eye is GONE — whole-tool visibility lives in the
   View menu, the ribbon toggle, and per-type in "Show in Script". */

export function MarkupsControls() {
  const filters = useEditorStore((s) => s.markupFilters);
  const setFilters = useEditorStore((s) => s.setMarkupFilters);
  const scriptHidden = useEditorStore((s) => s.markupHiddenIcons);
  const setScriptHidden = useEditorStore((s) => s.setMarkupHiddenIcons);
  const scriptDone = useEditorStore((s) => s.markupScriptDone);
  const setScriptDone = useEditorStore((s) => s.setMarkupScriptDone);
  const search = useEditorStore((s) => s.markupSearch);
  const setSearch = useEditorStore((s) => s.setMarkupSearch);

  const filterTypes = useTypesInUse(filters.hiddenIcons);
  const scriptTypes = useTypesInUse(scriptHidden);

  const [filterOpen, setFilterOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const filterBtn = useRef<HTMLButtonElement>(null);
  const scriptBtn = useRef<HTMLButtonElement>(null);
  const filterBox = useRef<HTMLDivElement>(null);
  const scriptBox = useRef<HTMLDivElement>(null);
  const filterPos = useSeat(filterOpen, filterBtn, filterBox);
  const scriptPos = useSeat(scriptOpen, scriptBtn, scriptBox);
  useDismiss(filterOpen, filterBox, filterBtn, () => setFilterOpen(false));
  useDismiss(scriptOpen, scriptBox, scriptBtn, () => setScriptOpen(false));

  const toggle = (list: string[], icon: string) =>
    (list.includes(icon) ? list.filter((x) => x !== icon) : [...list, icon]);

  const filterChip = filters.hiddenIcons.length + (filters.done !== 'open' ? 1 : 0);
  const showChip = scriptHidden.length + (scriptDone !== 'all' ? 1 : 0);
  return (
    <>
      {/* v5.27, Derek: "Show" — no icon, LEFT-aligned in the header (the
          tool-ctl-lead seat), driving what renders in the SCRIPT. */}
      <button ref={scriptBtn} className={`tool-ctl tool-ctl-lead markup-ctl-script${scriptOpen ? ' open' : ''}`}
        title="What shows in the script"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setFilterOpen(false); setScriptOpen((v) => !v); }}>
        <span className="tool-ctl-label">Show</span>
        {showChip > 0 && <span className="tool-ctl-chip">{showChip}</span>}
      </button>
      {scriptOpen && (
        <TypeGridPop
          boxRef={scriptBox}
          pos={scriptPos}
          done={scriptDone}
          onDone={setScriptDone}
          gridHelp="Toggle visibility in script"
          types={scriptTypes}
          hidden={scriptHidden}
          onToggle={(icon) => setScriptHidden(toggle(scriptHidden, icon))}
          onShowAll={() => setScriptHidden([])}
          onHideAll={() => setScriptHidden(scriptTypes)}
        />
      )}
      <button ref={filterBtn} className={`tool-ctl markup-ctl-filter${filterOpen ? ' open' : ''}`} title="Filter this list"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setScriptOpen(false); setFilterOpen((v) => !v); }}>
        <span className="tool-ctl-label">Filter</span>
        {filterChip > 0 && <span className="tool-ctl-chip">{filterChip}</span>}
      </button>
      {filterOpen && (
        <TypeGridPop
          boxRef={filterBox}
          pos={filterPos}
          done={filters.done}
          onDone={(d) => setFilters({ ...filters, done: d })}
          gridHelp="Toggle visibility in tool window"
          types={filterTypes}
          hidden={filters.hiddenIcons}
          onToggle={(icon) => setFilters({ ...filters, hiddenIcons: toggle(filters.hiddenIcons, icon) })}
          onShowAll={() => setFilters({ ...filters, hiddenIcons: [] })}
          onHideAll={() => setFilters({ ...filters, hiddenIcons: filterTypes })}
        />
      )}
      <ControlSearch value={search} onChange={setSearch} placeholder="Search annotations" />
    </>
  );
}

interface Row { m: ScriptMarkup; pos: number | null; page: number | null; heading: string }

export default function MarkupsPanel({ editor }: { editor: Editor | null }) {
  const markups = useEditorStore((s) => s.markups);
  const filters = useEditorStore((s) => s.markupFilters);
  const search = useEditorStore((s) => s.markupSearch);
  const pageLayout = useEditorStore((s) => s.pageLayout);
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setDocTick((t) => t + 1);
    editor.on('update', bump);
    return () => { editor.off('update', bump); };
  }, [editor]);

  const rows = useMemo<Row[]>(() => {
    const pageContent = editor ? computePageBlocks(editor.state.doc, pageLayout) : [];
    const out: Row[] = markups.map((m) => {
      const pos = editor ? findMarkupPos(editor, m.id) : null;
      return {
        m,
        pos,
        page: pos != null ? pageForPos(pageContent, pos) : null,
        heading: pos != null && editor ? sceneHeadingBefore(editor, pos) : '',
      };
    });
    // Script order; annotations whose anchor left the script sink to the end
    // (still listed — their content survives and stays editable/deletable).
    out.sort((a, b) => (a.pos ?? Infinity) - (b.pos ?? Infinity));
    return out;
    // docTick re-scans positions after each doc change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, markups, pageLayout, docTick]);

  const visible = rows.filter(({ m }) => {
    if (filters.done !== 'all' && (filters.done === 'done') !== m.done) return false;
    if (filters.hiddenIcons.includes(m.icon)) return false;
    if (search && !markupPreviewText(m).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // v5.26 (#13): double-click = go there AND open the editor window. The
  // jump scrolls first; the popover seats on the next frame's geometry.
  const jumpAndOpen = (id: string, pos: number | null) => {
    const s = useEditorStore.getState();
    if (pos != null) {
      if (s.fullscreenTool) s.setFullscreenTool(null);
      s.requestEditorScroll(pos);
      window.setTimeout(() => s.setMarkupEditorId(id), 160);
    } else {
      s.setMarkupEditorId(id);   // orphan: the popover seats screen-center
    }
  };

  return (
    <div className="markups-panel">
      <div className="markups-add-row">
        <button
          className="dialog-btn dialog-btn-primary markups-add-btn"
          disabled={!editor}
          onClick={() => { if (editor) createMarkupAtSelection(editor); }}
        >
          + Add Annotation
        </button>
      </div>
      <div className="markups-list">
        {visible.length === 0 && (
          <div className="markups-empty">
            {markups.length === 0
              ? 'Place the cursor (or select text) and hit Add Annotation — your annotations collect here.'
              : 'No annotations match the current filter.'}
          </div>
        )}
        {visible.map(({ m, pos, page, heading }) => (
          <div
            key={m.id}
            className={`markup-card${m.done ? ' done' : ''}`}
            onDoubleClick={() => jumpAndOpen(m.id, pos)}
            title="Double-click to open this annotation in the script"
          >
            <span className="markup-card-icon"><MarkupIcon icon={m.icon} color={m.color} /></span>
            <div className="markup-card-main">
              <div className="markup-card-text">{markupPreviewText(m) || '(empty annotation)'}</div>
              <div className="markup-card-meta">
                {pos != null
                  ? `p. ${page}${heading ? ` · ${heading}` : ''}`
                  : 'location removed from script'}
              </div>
            </div>
            <span className="markup-card-actions">
              <MarkupDotsMenu markup={m} editor={editor} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
