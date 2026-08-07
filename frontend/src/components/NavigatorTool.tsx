/**
 * NavigatorTool — the outline at a glance, ported from ScriptCraft v5.5's
 * Navigator. Lists every jumpable landmark in the script:
 *   - Scenes:       scene headings (click to jump)
 *   - Acts:         new act / end of act markers (click to jump)
 *   - Notes:        anchored notes (click jumps to the highlight; its popover
 *                   opens there — v4.33, the Notes window is general-only)
 *   - To-Dos:       script [ ] lines (tick here; click to jump)
 * Show/hide per kind via the Filter dropdown; Search narrows by text.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useNotebookStore } from '../stores/notebookStore';
import { FaRegStickyNote } from 'react-icons/fa';
import { ControlDropdown, ControlSearch } from './ToolControls';
import { findNotePos } from '../utils/scriptNoteActions';
import { countActiveNavSceneFilters, EMPTY_NAV_SCENE_FILTERS, navSceneHeadingMatch, sceneHeadingLocations } from '../utils/sceneFilters';
import { EMPTY_MARKUP_FILTERS } from '../stores/slices/markupsSlice';
import { findMarkupPos, markupContentLines, markupNavLines, markupIsList, type MarkupNavLine } from '../utils/markupActions';
import { MarkupIcon } from './markupIcons';
import { useHt } from '../utils/helperText';
import { MarkupNavLineSpans } from './MarkupNavLines';
import { TypeGridSection, useTypesInUse, useSeat, useDismiss } from './MarkupPickers';

const KINDS = ['scene', 'act', 'section', 'marker', 'note', 'todo', 'markup'] as const;
type Kind = typeof KINDS[number];

interface Item {
  kind: Kind;
  text: string;
  /** v4.32 batch-v8 #5: scene rows only — the scene's number (the assigned
   *  sceneNumber attr when there is one, else its 1-based position among
   *  scenes — the same rule the Scenes list and note locations use). */
  num?: string;
  /** doc position for jumpable kinds */
  pos?: number;
  /** note id for script notes */
  noteId?: string;
  /** markup id (v5.25) — the row carries its chosen icon + color */
  markupId?: string;
  markupIcon?: string;
  markupColor?: string;
  /** v5.30: content lines — a LIST annotation renders as a list
   *  (v5.46: structured — checklist lines carry live checked state) */
  markupLines?: MarkupNavLine[];
  /** v5.41, Derek: list annotations show NO icon in the Navigator */
  markupIsList?: boolean;
  /** shelf card id + item index for to-dos */
  cardId?: string;
  itemIdx?: number;
  done?: boolean;
}

interface NavigatorToolProps {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}

/** v4.32 batch-v8 #5–#7, Derek's window template: the Navigator's row-2
 *  cluster (window chrome).
 *  v5.46, Derek: the Filter menu IS the annotation filter now — the old
 *  kind toggles (Scene Headers / Acts / …) are gone, and the grid that
 *  lived in the body's "Annotations" button moved in here under a
 *  "Filter Annotations" title. Drives the SAME markupFilters the
 *  Annotations panel and the ribbon share.
 *  v5.68, Derek: a "Scene Headings" section ABOVE it — INT./EXT.,
 *  location, contains-text — and that title reads just "Annotations".
 *  The predicate is utils/sceneFilters.navSceneHeadingMatch, the ONE
 *  definition this chip and the body's row test share. */
export function NavigatorControls() {
  const navFilter = useEditorStore((s) => s.navFilter);
  const setNavFilter = useEditorStore((s) => s.setNavFilter);
  const mkFilters = useEditorStore((s) => s.markupFilters);
  const setMkFilters = useEditorStore((s) => s.setMarkupFilters);
  const scnf = useEditorStore((s) => s.navSceneFilters);
  const setScnf = useEditorStore((s) => s.setNavSceneFilters);
  // Live while this popover can exist: 'navigator' is in SCENES_READERS,
  // so the store list rescans whenever the Navigator window is open.
  const scenes = useEditorStore((s) => s.scenes);
  const locOptions = useMemo(() => sceneHeadingLocations(scenes.map((sc) => sc.heading)), [scenes]);
  // v5.51, Derek: the Scene # toggle became a "View" MENU — Scene
  // Numbers / Annotations / Scene Headings, each a keep-open toggle.
  // Kind visibility rides navShowKinds (missing = shown).
  const showNums = useEditorStore((s) => s.navShowSceneNumbers);
  const setShowNums = useEditorStore((s) => s.setNavShowSceneNumbers);
  const showKinds = useEditorStore((s) => s.navShowKinds);
  const setShowKinds = useEditorStore((s) => s.setNavShowKinds);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pos = useSeat(open, btn, box);
  useDismiss(open, box, btn, () => setOpen(false));
  const types = useTypesInUse(mkFilters.hiddenIcons);
  const chip = mkFilters.hiddenIcons.length + (mkFilters.done !== 'open' ? 1 : 0)
    + countActiveNavSceneFilters(scnf);
  return (
    <>
      <ControlDropdown
        label="View"
        items={[
          { label: 'Scene Numbers', active: showNums, keepOpen: true,
            onSelect: () => setShowNums(!showNums) },
          // store-time reads — two quick toggles must not clobber each
          // other through stale render closures
          { label: 'Annotations', active: showKinds.markup !== false, keepOpen: true,
            onSelect: () => {
              const cur = useEditorStore.getState().navShowKinds;
              setShowKinds({ ...cur, markup: cur.markup === false });
            } },
          { label: 'Scene Headings', active: showKinds.scene !== false, keepOpen: true,
            onSelect: () => {
              const cur = useEditorStore.getState().navShowKinds;
              setShowKinds({ ...cur, scene: cur.scene === false });
            } },
        ]}
      />
      <button ref={btn} data-ctl="filter" className={`tool-ctl markup-ctl-filter${open ? ' open' : ''}`} title="Filter annotations"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <span className="tool-ctl-label">Filter</span>
        {chip > 0 && <span className="tool-ctl-chip">{chip}</span>}
      </button>
      {open && createPortal(
        <div ref={box} className="markup-subpop markup-filter-pop" style={pos ?? { top: -9999, left: -9999 }}
          onPointerDown={(e) => e.stopPropagation()}>
          {/* v5.68, Derek: Scene Headings filters lead the pop. The segment
              row wears the Status toggle's classes — one look for one idea. */}
          <div className="fs-nav-filter-title">Scene Headings</div>
          <div className="markup-filter-statusrow">
            <span className="markup-filter-help">INT. / EXT.: </span>
            <span className="markup-seg markup-filter-seg">
              {([['all', 'All'], ['int', 'INT.'], ['ext', 'EXT.']] as const).map(([id, label]) => (
                <button key={id} className={scnf.intExt === id ? 'active' : ''}
                  onClick={() => setScnf({ ...scnf, intExt: id })}>{label}</button>
              ))}
            </span>
          </div>
          <div className="fs-nav-scnf-row">
            <span className="markup-filter-help">Location: </span>
            <select
              className="fs-nav-scnf-select"
              value={scnf.location}
              onChange={(e) => setScnf({ ...scnf, location: e.target.value })}
            >
              <option value="">All locations</option>
              {locOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="fs-nav-scnf-row">
            <span className="markup-filter-help">Contains: </span>
            <input
              className="tool-action-field fs-nav-scnf-input"
              type="text"
              placeholder="a word or words"
              value={scnf.contains}
              onChange={(e) => setScnf({ ...scnf, contains: e.target.value })}
            />
          </div>
          <div className="fs-nav-filter-title">Annotations</div>
          <TypeGridSection
            done={mkFilters.done}
            onDone={(d) => setMkFilters({ ...mkFilters, done: d })}
            types={types}
            hidden={mkFilters.hiddenIcons}
            onToggle={(icon) => setMkFilters({
              ...mkFilters,
              hiddenIcons: mkFilters.hiddenIcons.includes(icon)
                ? mkFilters.hiddenIcons.filter((x) => x !== icon)
                : [...mkFilters.hiddenIcons, icon],
            })}
            onShowAll={() => setMkFilters({ ...mkFilters, hiddenIcons: [] })}
            onHideAll={() => setMkFilters({ ...mkFilters, hiddenIcons: types })}
          />
          {/* v5.70, Derek: Reset — the WHOLE menu back to defaults, scene
              filters and annotation filters alike. Both writes use the same
              constants the store starts from (EMPTY_*), so "default" can't
              drift from what a fresh session shows. The annotation half is
              the SHARED markupFilters — resetting here resets the
              Annotations panel/ribbon view too, which is v5.46's one-filter
              design working as intended. */}
          <div className="fs-nav-filter-resetrow">
            <button
              className="markup-hl-clear fs-nav-filter-reset"
              onClick={() => { setScnf(EMPTY_NAV_SCENE_FILTERS); setMkFilters(EMPTY_MARKUP_FILTERS); }}
            >Reset</button>
          </div>
        </div>,
        document.body,
      )}
      <ControlSearch value={navFilter} onChange={setNavFilter} placeholder="Filter by keyword" />
    </>
  );
}

/* (v5.48, Derek: the body's action row is GONE — the scene-number toggle
   moved into the window HEADER (NavigatorControls), text only.) */

export default function NavigatorTool({ editor, scrollContainer }: NavigatorToolProps) {
  const ht = useHt();
  const { notes, setNotePopoverId } = useEditorStore();
  const markups = useEditorStore((s) => s.markups);
  const mkFilters = useEditorStore((s) => s.markupFilters);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const filter = useEditorStore((s) => s.navFilter);
  const showNums = useEditorStore((s) => s.navShowSceneNumbers);
  const [docTick, setDocTick] = useState(0);

  // Re-scan the outline when the document changes (throttled by rAF batching)
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (editor) {
      let sceneOrdinal = 0; // 1-based scene count — the fallback number
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          sceneOrdinal += 1;
          // v4.32 batch-v8 #5: assigned sceneNumber attr ?? doc order — the
          // same rule ScriptNotes/StickyNotes use for scene locations.
          const assigned = (node.attrs as { sceneNumber?: number | string | null }).sceneNumber;
          // v2.32: the editor RENDERS headings uppercase via CSS whatever the
          // typed case — the Navigator must match what the page shows.
          out.push({
            kind: 'scene',
            text: (node.textContent || '(untitled scene)').toUpperCase(),
            num: String(assigned ?? sceneOrdinal),
            pos,
          });
        } else if (node.type.name === 'newAct' || node.type.name === 'endOfAct') {
          out.push({ kind: 'act', text: node.textContent || '(act)', pos });
        } else if (node.type.name === 'general') {
          // Outline lines from Insert → Section / Marker / To-Do List
          const text = node.textContent || '';
          if (/^#+\s/.test(text)) {
            out.push({ kind: 'section', text: text.replace(/^#+\s*/, '') || '(section)', pos });
          } else if (text.startsWith('⚑')) {
            out.push({ kind: 'marker', text: text.replace(/^⚑\s*/, '') || '(marker)', pos });
          } else if (/^\[[ x]\]/.test(text)) {
            out.push({ kind: 'todo', text: text.slice(3).trim(), pos, done: text[1] === 'x' });
          }
        }
        return true;
      });
    }
    // v5.26 (#10): annotations sort INTO the outline by doc position, so
    // each one sits under the scene it lives in — they used to append at
    // the bottom. Same-position ties (a block anchor ON a scene heading)
    // keep the landmark first, its annotation under it.
    const annos: Item[] = [];
    const orphans: Item[] = [];
    for (const m of markups) {
      // v5.30: the Annotations button drives the SAME filter as the side
      // panel (markupFilters) — hidden types/states drop out here too.
      if (mkFilters.done !== 'all' && (mkFilters.done === 'done') !== m.done) continue;
      if (mkFilters.hiddenIcons.includes(m.icon)) continue;
      // v5.33: the rendered lines come from the SHARED capper (the edit
      // window's "Displays as:" preview uses the same one); search text
      // stays uncapped so long lines remain findable.
      const item: Item = {
        kind: 'markup',
        // empty annotation → NO placeholder text; the row is just the icon
        text: markupContentLines(m).join(' '),
        markupLines: markupNavLines(m.content),
        markupIsList: markupIsList(m.content),
        markupId: m.id,
        markupIcon: m.icon,
        markupColor: m.color,
        done: m.done,
        pos: editor ? findMarkupPos(editor, m.id) ?? undefined : undefined,
      };
      (item.pos !== undefined ? annos : orphans).push(item);
    }
    const placed = [...out.map((it, i) => ({ it, i, anno: 0 })), ...annos.map((it, i) => ({ it, i, anno: 1 }))]
      .sort((a, b) => ((a.it.pos ?? 0) - (b.it.pos ?? 0)) || (a.anno - b.anno) || (a.i - b.i))
      .map((x) => x.it);
    for (const n of notes) {
      placed.push({ kind: 'note', text: n.content || n.anchorText || '(empty note)', noteId: n.id });
    }
    placed.push(...orphans);
    // v0.15: General To-Do cards intentionally do NOT appear here — the
    // Navigator maps the SCRIPT, and only script to-dos have a location
    // in it. Standalone to-dos live solely in the To-Do window (blank Location).
    return placed;
    // docTick forces re-scan of editor content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docTick, notes, markups, mkFilters]);

  // v5.51, Derek: the View menu governs scene-heading and annotation rows
  // (navShowKinds — missing = shown); other kinds always list until their
  // phase-2 retirement. Search stacks on top.
  // v5.68: the Filter pop's Scene Headings section stacks on scene rows —
  // annotations/notes/acts are untouched by it (they carry their own
  // filters), exactly as the View menu hides kinds independently.
  const show = useEditorStore((s) => s.navShowKinds);
  const scnf = useEditorStore((s) => s.navSceneFilters);
  const visible = items.filter(
    (it) => (it.kind !== 'scene' || (show.scene !== false && navSceneHeadingMatch(it.text, scnf)))
      && (it.kind !== 'markup' || show.markup !== false)
      && (!filter || it.text.toLowerCase().includes(filter.toLowerCase())),
  );

  const jumpTo = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
    requestAnimationFrame(() => {
      const coords = editor.view.coordsAtPos(pos + 1);
      if (scrollContainer) {
        const rect = scrollContainer.getBoundingClientRect();
        scrollContainer.scrollTo({ top: scrollContainer.scrollTop + (coords.top - rect.top) - 60, behavior: 'auto' });
      }
    });
  };

  const handleClick = (it: Item) => {
    if (it.kind === 'markup' && it.markupId) {
      // v5.25: same gesture as notes — go there, open its popover. Checked
      // BEFORE the plain-jump branch: annotation rows carry a pos too (v5.26
      // sorts them into the outline), but a jump alone would skip the open.
      // v5.37: the popover needs the EDITOR — step any takeover aside first.
      const st = useEditorStore.getState();
      if (st.fullscreenTool) st.setFullscreenTool(null);
      if (useNotebookStore.getState().notebookOpen) useNotebookStore.getState().setNotebookOpen(false);
      if (it.pos !== undefined) jumpTo(it.pos);
      setMarkupEditorId(it.markupId);
    } else if (it.pos !== undefined) {
      jumpTo(it.pos);
    } else if (it.kind === 'note' && it.noteId && editor) {
      // v4.33: jump to the note's highlight and open its popover there —
      // the Notes window no longer holds script notes.
      const pos = findNotePos(editor, it.noteId);
      if (pos !== null) jumpTo(pos);
      setNotePopoverId(it.noteId);
    }
  };

  const toggleTodo = (it: Item) => {
    if (it.pos !== undefined && editor) {
      // Script to-do line: flip the [ ] / [x] prefix in place
      const tr = editor.state.tr.replaceWith(
        it.pos + 1, it.pos + 4, editor.state.schema.text(it.done ? '[ ]' : '[x]'),
      );
      editor.view.dispatch(tr);
    }
  };

  return (
    <div className="fs-navigator">
      {/* (v5.48: the body's action row is gone — Scene # rides the header.) */}
      <div className="fs-nav-list">
        {visible.length === 0 && (
          <div className="fs-nav-empty">
            {ht('Scene headings, acts, script notes, and to-dos will show up here as you write.')}
          </div>
        )}
        {visible.map((it, idx) => (
          <div
            key={idx}
            className={`fs-nav-item ${it.kind}`}
            onClick={() => handleClick(it)}
          >
            {it.kind === 'todo' && (
              <input
                type="checkbox"
                checked={!!it.done}
                onChange={() => toggleTodo(it)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {/* v5.28, Derek: the scene number is the Scenes tool's circle
                badge, BEFORE the heading (was a bare number at the right). */}
            {showNums && it.kind === 'scene' && it.num !== undefined && (
              <span className="scene-number-badge fs-nav-num-badge">{it.num}</span>
            )}
            {it.kind === 'markup' ? (
              /* v5.30, Derek: empty annotation = just the icon (no
                 placeholder text); a LIST annotation renders as a list. */
              <span
                className={`fs-nav-anno${it.done ? ' fs-nav-done' : ''}`}
                style={it.markupColor ? { color: it.markupColor } : undefined}
              >
                {/* v5.41, Derek: list annotations carry no icon here —
                    their stacked lines are identification enough */}
                {!it.markupIsList && (
                  <span className="fs-nav-kind-icon fs-nav-markup-icon">
                    <MarkupIcon icon={it.markupIcon ?? 'flag'} color={it.markupColor} />
                  </span>
                )}
                <MarkupNavLineSpans lines={it.markupLines ?? []} />
              </span>
            ) : (
              <span className={it.done ? 'fs-nav-done' : ''}>
                {it.kind === 'note' ? <FaRegStickyNote className="fs-nav-kind-icon" /> : it.kind === 'act' ? '§ ' : it.kind === 'marker' ? '⚑ ' : it.kind === 'section' ? '# ' : ''}
                {it.text.length > 80 ? it.text.slice(0, 80) + '…' : it.text || '(untitled)'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
