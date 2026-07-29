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
import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { FaHashtag, FaRegStickyNote } from 'react-icons/fa';
import { ControlDropdown, ControlSearch } from './ToolControls';
import { findNotePos } from '../utils/scriptNoteActions';
import { findMarkupPos, markupPreviewText } from '../utils/markupActions';
import { MarkupIcon } from './markupIcons';

const KINDS = ['scene', 'act', 'section', 'marker', 'note', 'todo', 'markup'] as const;
type Kind = typeof KINDS[number];
const LABEL: Record<Kind, string> = {
  scene: 'Scene Headers', act: 'Acts', section: 'Sections', marker: 'Markers',
  note: 'Notes', todo: 'To-Dos', markup: 'Annotations',
};

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
  /** shelf card id + item index for to-dos */
  cardId?: string;
  itemIdx?: number;
  done?: boolean;
}

interface NavigatorToolProps {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}

/** v1.80: header state lives in the store (navFilter / navShowKinds /
 *  navShowSceneNumbers) because the controls render in the WINDOW CHROME
 *  (the row-2 cluster), outside this component. Missing kind = shown. */
const kindShown = (show: Record<string, boolean>, k: Kind) => show[k] !== false;

/** v4.32 batch-v8 #5–#7, Derek's window template: the Navigator's row-2
 *  cluster, composed from the ToolControls primitives (replaces the v2.03
 *  funnel popover — same store state, standard chrome):
 *    - scene-number toggle, seated LEFT via .tool-ctl-lead
 *    - Filter: kind show/hide as a keepOpen multi-toggle menu (the chip
 *      counts HIDDEN kinds)
 *    - Search: the keyword filter (narrows the list by text) */
export function NavigatorControls() {
  const showNums = useEditorStore((s) => s.navShowSceneNumbers);
  const setShowNums = useEditorStore((s) => s.setNavShowSceneNumbers);
  const navShowKinds = useEditorStore((s) => s.navShowKinds);
  const setNavShowKinds = useEditorStore((s) => s.setNavShowKinds);
  const navFilter = useEditorStore((s) => s.navFilter);
  const setNavFilter = useEditorStore((s) => s.setNavFilter);
  const hiddenCount = KINDS.filter((k) => !kindShown(navShowKinds, k)).length;
  const annosShown = kindShown(navShowKinds, 'markup');
  return (
    <>
      {/* v5.28, Derek: a dedicated Annotations toggle — the same kind
          visibility the Filter menu drives, one click instead of two. */}
      <button
        className={'tool-ctl tool-ctl-lead' + (annosShown ? ' active' : '')}
        title={annosShown ? 'Hide annotations in this list' : 'Show annotations in this list'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setNavShowKinds({ ...navShowKinds, markup: !annosShown })}
      >
        <span className="tool-ctl-label">Annotations</span>
      </button>
      <ControlDropdown
        label="Filter"
        chip={hiddenCount}
        items={KINDS.map((k) => ({
          label: LABEL[k],
          active: kindShown(navShowKinds, k),
          keepOpen: true,
          onSelect: () => setNavShowKinds({ ...navShowKinds, [k]: !kindShown(navShowKinds, k) }),
        }))}
      />
      <ControlSearch value={navFilter} onChange={setNavFilter} placeholder="Filter by keyword" />
      {/* v5.28, Derek: the scene-number toggle moved DOWN A ROW, left-
          aligned (the break forces the wrap; lead pins it left). */}
      <span className="tool-ctl-break" aria-hidden />
      <button
        className={'tool-ctl tool-ctl-lead' + (showNums ? ' active' : '')}
        title={showNums ? 'Hide scene numbers' : 'Show scene numbers'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setShowNums(!showNums)}
      >
        <FaHashtag aria-hidden />
        <span className="tool-ctl-label">Scene Numbers</span>
      </button>
    </>
  );
}

export default function NavigatorTool({ editor, scrollContainer }: NavigatorToolProps) {
  const { notes, setNotePopoverId } = useEditorStore();
  const markups = useEditorStore((s) => s.markups);
  const setMarkupEditorId = useEditorStore((s) => s.setMarkupEditorId);
  const filter = useEditorStore((s) => s.navFilter);
  const show = useEditorStore((s) => s.navShowKinds);
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
      const item: Item = {
        kind: 'markup',
        text: markupPreviewText(m) || '(empty annotation)',
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
  }, [editor, docTick, notes, markups]);

  const visible = items.filter(
    (it) => kindShown(show, it.kind) && (!filter || it.text.toLowerCase().includes(filter.toLowerCase())),
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
      {/* v1.80: the body is ONLY the list — the whole filter control
          (funnel + field) lives in the window header (v1.97). */}
      <div className="fs-nav-list">
        {visible.length === 0 && (
          <div className="fs-nav-empty">
            Scene headings, acts, script notes, and to-dos will show up here as you write.
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
            <span
              className={it.done ? 'fs-nav-done' : ''}
              /* v5.28: annotation rows wear their icon's color */
              style={it.kind === 'markup' && it.markupColor ? { color: it.markupColor } : undefined}
            >
              {it.kind === 'markup' ? (
                <span className="fs-nav-kind-icon fs-nav-markup-icon">
                  <MarkupIcon icon={it.markupIcon ?? 'flag'} color={it.markupColor} />
                </span>
              ) : it.kind === 'note' ? <FaRegStickyNote className="fs-nav-kind-icon" /> : it.kind === 'act' ? '§ ' : it.kind === 'marker' ? '⚑ ' : it.kind === 'section' ? '# ' : ''}
              {it.text.length > 80 ? it.text.slice(0, 80) + '…' : it.text || '(untitled)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
