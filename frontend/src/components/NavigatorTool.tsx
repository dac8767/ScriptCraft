/**
 * NavigatorTool — the outline at a glance, ported from ScriptCraft v5.5's
 * Navigator. Lists every jumpable landmark in the script:
 *   - Scenes:       scene headings (click to jump)
 *   - Acts:         new act / end of act markers (click to jump)
 *   - Notes: anchored notes (click opens Notes → Script focused on it)
 *   - To-Dos:       sticky To-Do items (tick here; click opens the To-Do tab)
 * Show/hide per kind via the dropdown; the filter box narrows by text.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { FilterIcon } from './uiIcons';

const KINDS = ['scene', 'act', 'section', 'marker', 'note', 'todo'] as const;
type Kind = typeof KINDS[number];
const LABEL: Record<Kind, string> = {
  scene: 'Scene Headers', act: 'Acts', section: 'Sections', marker: 'Markers',
  note: 'Notes', todo: 'To-Dos',
};

interface Item {
  kind: Kind;
  text: string;
  /** doc position for jumpable kinds */
  pos?: number;
  /** note id for script notes */
  noteId?: string;
  /** shelf card id + item index for to-dos */
  cardId?: string;
  itemIdx?: number;
  done?: boolean;
}

interface NavigatorToolProps {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}

/** v1.80: header/footer state lives in the store (navFilter / navShowKinds)
 *  because the dropdown and filter field render in the WINDOW CHROME (header
 *  and footer slots), outside this component. Missing kind = shown. */
const kindShown = (show: Record<string, boolean>, k: Kind) => show[k] !== false;

/** The Navigator's ONE filter control (v2.03): a single funnel button,
 *  right-aligned in the window header. Clicking it opens a portalled
 *  popover (AddMenu lesson: body portal, top/left only) holding the
 *  keyword filter AND the element-type show/hide checkboxes. */
export function NavigatorHeaderExtra() {
  const navShowKinds = useEditorStore((s) => s.navShowKinds);
  const setNavShowKinds = useEditorStore((s) => s.setNavShowKinds);
  const navFilter = useEditorStore((s) => s.navFilter);
  const setNavFilter = useEditorStore((s) => s.setNavFilter);
  const anyHidden = KINDS.some((k) => !kindShown(navShowKinds, k));
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.fs-nav-filterpop') && t !== btnRef.current && !btnRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 220, window.innerWidth - 236)) });
    }
    setOpen((v) => !v);
  };

  return (
    <span className="fs-nav-filterctl">
      <button
        ref={btnRef}
        className="fs-nav-filterbtn"
        title="Filter by keyword or element type"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
      >
        <FilterIcon filled={anyHidden || !!navFilter} />
      </button>
      {open && pos && createPortal(
        <div className="fs-nav-filterpop" style={{ top: pos.top, left: pos.left }}>
          <input
            autoFocus
            className="fs-nav-filter"
            placeholder="Filter by keyword"
            value={navFilter}
            onChange={(e) => setNavFilter(e.target.value)}
          />
          <div className="fs-nav-filterpop-title">Show element types</div>
          {KINDS.map((k) => (
            <label key={k} className="fs-nav-filterpop-kind">
              <input
                type="checkbox"
                checked={kindShown(navShowKinds, k)}
                onChange={() => setNavShowKinds({ ...navShowKinds, [k]: !kindShown(navShowKinds, k) })}
              />
              <span>{LABEL[k]}</span>
            </label>
          ))}
          <div className="fs-nav-filterpop-actions">
            <button onClick={() => setNavShowKinds({})}>Show All</button>
            <button onClick={() => setNavShowKinds(Object.fromEntries(KINDS.map((x) => [x, false])))}>Hide All</button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

export default function NavigatorTool({ editor, scrollContainer }: NavigatorToolProps) {
  const { notes, setNoteFilter, openShelfTab } = useEditorStore();
  const filter = useEditorStore((s) => s.navFilter);
  const show = useEditorStore((s) => s.navShowKinds);
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
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          // v2.32: the editor RENDERS headings uppercase via CSS whatever the
          // typed case — the Navigator must match what the page shows.
          out.push({ kind: 'scene', text: (node.textContent || '(untitled scene)').toUpperCase(), pos });
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
    for (const n of notes) {
      out.push({ kind: 'note', text: n.content || n.anchorText || '(empty note)', noteId: n.id });
    }
    // v0.15: General To-Do cards intentionally do NOT appear here — the
    // Navigator maps the SCRIPT, and only script to-dos have a location
    // in it. Standalone to-dos live solely in the To-Do window (blank Location).
    return out;
    // docTick forces re-scan of editor content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docTick, notes]);

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
    if (it.pos !== undefined) jumpTo(it.pos);
    else if (it.kind === 'note' && it.noteId) {
      setNoteFilter({ elementType: null, contextLabel: null, color: null, noteId: it.noteId });
      openShelfTab('script');
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
            <span className={it.done ? 'fs-nav-done' : ''}>
              {it.kind === 'note' ? '📝 ' : it.kind === 'act' ? '§ ' : it.kind === 'marker' ? '⚑ ' : it.kind === 'section' ? '# ' : ''}
              {it.text.length > 80 ? it.text.slice(0, 80) + '…' : it.text || '(untitled)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
