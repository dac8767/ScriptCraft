/**
 * NavigatorTool — the outline at a glance, ported from FreeScript v5.5's
 * Navigator. Lists every jumpable landmark in the script:
 *   - Scenes:       scene headings (click to jump)
 *   - Acts:         new act / end of act markers (click to jump)
 *   - Script Notes: anchored notes (click opens Notes → Script focused on it)
 *   - To-Dos:       sticky To-Do items (tick here; click opens the To-Do tab)
 * Show/hide per kind via the dropdown; the filter box narrows by text.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';

const KINDS = ['scene', 'act', 'note', 'todo'] as const;
type Kind = typeof KINDS[number];
const LABEL: Record<Kind, string> = {
  scene: 'Scene Headers', act: 'Acts', note: 'Script Notes', todo: 'To-Dos',
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

export default function NavigatorTool({ editor, scrollContainer }: NavigatorToolProps) {
  const { notes, shelfCards, setShelfCards, setNoteFilter, openShelfTab } = useEditorStore();
  const [filter, setFilter] = useState('');
  const [show, setShow] = useState<Record<Kind, boolean>>(
    () => Object.fromEntries(KINDS.map((k) => [k, true])) as Record<Kind, boolean>,
  );
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
        }
        return true;
      });
    }
    for (const n of notes) {
      out.push({ kind: 'note', text: n.content || n.anchorText || '(empty note)', noteId: n.id });
    }
    shelfCards.forEach((card) => {
      if (card.type !== 'todo') return;
      (card.items || []).forEach((it, idx) => {
        out.push({ kind: 'todo', text: it.text, cardId: card.id, itemIdx: idx, done: it.done });
      });
    });
    return out;
    // docTick forces re-scan of editor content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docTick, notes, shelfCards]);

  const visible = items.filter(
    (it) => show[it.kind] && (!filter || it.text.toLowerCase().includes(filter.toLowerCase())),
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
    } else if (it.kind === 'todo') {
      openShelfTab('todo');
    }
  };

  const toggleTodo = (it: Item) => {
    setShelfCards(shelfCards.map((c) =>
      c.id === it.cardId
        ? { ...c, items: (c.items || []).map((x, j) => (j === it.itemIdx ? { ...x, done: !x.done } : x)) }
        : c,
    ));
  };

  return (
    <div className="fs-navigator">
      <div className="fs-nav-toolbar">
        <select
          className="fs-nav-showhide"
          value=""
          onChange={(e) => {
            const k = e.target.value;
            if (k === '__all') setShow(Object.fromEntries(KINDS.map((x) => [x, true])) as Record<Kind, boolean>);
            else if (k === '__none') setShow(Object.fromEntries(KINDS.map((x) => [x, false])) as Record<Kind, boolean>);
            else if (k) setShow((s) => ({ ...s, [k as Kind]: !s[k as Kind] }));
          }}
        >
          <option value="">show/hide…</option>
          <option value="__all">Show All</option>
          <option value="__none">Hide All</option>
          <option value="" disabled>────────</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{(show[k] ? '✓ ' : '\u00a0\u00a0\u00a0') + LABEL[k]}</option>
          ))}
        </select>
      </div>
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
              {it.kind === 'note' ? '📝 ' : it.kind === 'act' ? '§ ' : ''}
              {it.text.length > 80 ? it.text.slice(0, 80) + '…' : it.text || '(untitled)'}
            </span>
          </div>
        ))}
      </div>
      <input
        className="fs-nav-filter"
        placeholder="Filter Navigator"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
    </div>
  );
}
