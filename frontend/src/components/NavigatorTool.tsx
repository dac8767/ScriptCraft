/**
 * NavigatorTool — the outline at a glance, ported from ScriptCraft v5.5's
 * Navigator. Lists every jumpable landmark in the script:
 *   - Scenes:       scene headings (click to jump)
 *   - Acts:         new act / end of act markers (click to jump)
 *   - Notes: anchored notes (click opens Notes → Script focused on it)
 *   - To-Dos:       sticky To-Do items (tick here; click opens the To-Do tab)
 * Show/hide per kind via the dropdown; the filter box narrows by text.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';

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

/** The show/hide dropdown — rendered in the window HEADER by the chrome. */
export function NavigatorHeaderExtra() {
  const navShowKinds = useEditorStore((s) => s.navShowKinds);
  const setNavShowKinds = useEditorStore((s) => s.setNavShowKinds);
  return (
    <select
      className="fs-nav-showhide"
      value=""
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const k = e.target.value;
        if (k === '__all') setNavShowKinds({});
        else if (k === '__none') setNavShowKinds(Object.fromEntries(KINDS.map((x) => [x, false])));
        else if (k) setNavShowKinds({ ...navShowKinds, [k]: !kindShown(navShowKinds, k as Kind) });
      }}
    >
      <option value="">show/hide…</option>
      <option value="__all">Show All</option>
      <option value="__none">Hide All</option>
      <option value="" disabled>────────</option>
      {KINDS.map((k) => (
        <option key={k} value={k}>{(kindShown(navShowKinds, k) ? '✓ ' : '   ') + LABEL[k]}</option>
      ))}
    </select>
  );
}

/** The filter field — rendered as the window FOOTER by the chrome. */
export function NavigatorFooter() {
  const navFilter = useEditorStore((s) => s.navFilter);
  const setNavFilter = useEditorStore((s) => s.setNavFilter);
  return (
    <input
      className="fs-nav-filter"
      placeholder="Filter Navigator"
      value={navFilter}
      onChange={(e) => setNavFilter(e.target.value)}
    />
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
          out.push({ kind: 'scene', text: node.textContent || '(untitled scene)', pos });
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
      {/* v1.80: the body is ONLY the list — the show/hide dropdown lives in
          the window header and the filter field in the window footer. */}
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
