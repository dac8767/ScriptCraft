/**
 * StickyNotes — the ScriptCraft sticky-card system, now split into three
 * right-dock tools:
 *   - StickyNotesTool ("Sticky Notes"): General / Script sub-tabs — General is
 *     free-form sticky cards, Script is OpenDraft's anchored notes. The 🔍
 *     search spans both sub-views.
 *   - FragmentsTool ("Snippets"): text sent from the
 *     editor via ⌥⌘X (cut) / ⌥⌘C (copy) — bound in ScreenplayEditor.
 *   - TodoTool ("To-Do"): to-do lists, each showing where in the script it lives.
 * Cards keep sticky colors, drag-reorder, editable title headers (type name
 * as placeholder), and creation dates. Data persists per script as the
 * `_shelf` key of the saved content JSON and syncs in collab via collabSync.
 */
import { useState, useMemo, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  useEditorStore,
  SHELF_DEFAULT_COLOR,
  type ShelfCard,
  type ShelfCardType,
} from '../stores/editorStore';
import { ScriptNotesContent } from './ScriptNotes';
import React from 'react';
import { StickyCard } from './StickyCard';
import {
  ListToolbar, arrangeEntries, reorderKeys, entryDragProps,
  type ListEntry, type ListFilter, type ListSort,
} from './ListControls';
import { uuid } from '../utils/uuid';


const EMPTY_HINTS: Record<ShelfCardType, string> = {
  comment: 'Notes to self, research links, themes to keep present. Hit + Add below.',
  todo: 'To-do lists. Ones added to the script show the scene they’re in. Hit + Add below.',
  snippet: 'Select text in the Editor and press ⌥⌘X to cut it here, or ⌥⌘C to copy it over.',
};

/** Build a snippet card from editor text (used by the capture shortcuts). */
export function makeSnippetCard(text: string): ShelfCard {
  return { id: uuid(), type: 'snippet', text, color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString() };
}

/* ═══════════ Shared card list (per card type) with drag reorder ═══════════ */

function useCardOps() {
  const { shelfCards, setShelfCards } = useEditorStore();
  const update = (id: string, patch: Partial<ShelfCard>) =>
    setShelfCards(shelfCards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setShelfCards(shelfCards.filter((c) => c.id !== id));
  const add = (type: ShelfCardType) => {
    const base: ShelfCard = { id: uuid(), type, color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString() };
    if (type === 'comment') base.text = '';
    if (type === 'todo') base.items = [];
    setShelfCards([...shelfCards, base]);
  };
  return { shelfCards, setShelfCards, update, remove, add };
}

interface CardListProps {
  type: ShelfCardType;
  /** already-filtered cards to show (search); defaults to all of this type */
  cards?: ShelfCard[];
}

function CardList({ type, cards }: CardListProps) {
  const { shelfCards, setShelfCards, update, remove } = useCardOps();
  const [dragId, setDragId] = useState<string | null>(null);
  const [startArmed, setStartArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const visible = cards ?? shelfCards.filter((c) => c.type === type);

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const to = arr.findIndex((c) => c.id === targetId);
    arr.splice(to === -1 ? arr.length : to, 0, moved);
    setShelfCards(arr);
    setDragId(null);
  };
  const dropAtStart = () => {
    if (!dragId) return;
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    const firstIdx = arr.findIndex((c) => c.type === type);
    arr.splice(firstIdx === -1 ? arr.length : firstIdx, 0, moved);
    setShelfCards(arr);
    setDragId(null);
    setStartArmed(false);
  };
  const dropAtEnd = () => {
    if (!dragId) return;
    const arr = [...shelfCards];
    const from = arr.findIndex((c) => c.id === dragId);
    if (from === -1) { setDragId(null); return; }
    const [moved] = arr.splice(from, 1);
    arr.push(moved);
    setShelfCards(arr);
    setDragId(null);
    setEndArmed(false);
  };

  return (
    <div className="swn-scroll">
      {visible.length === 0 && <div className="swn-hint">{EMPTY_HINTS[type]}</div>}
      {dragId && visible.length > 0 && (
        <div
          className={'swn-drop-zone' + (startArmed ? ' armed' : '')}
          onDragOver={(e) => { e.preventDefault(); setStartArmed(true); }}
          onDragLeave={() => setStartArmed(false)}
          onDrop={dropAtStart}
        />
      )}
      {visible.map((card) => (
        <StickyCard
          key={card.id}
          card={card}
          dragging={dragId === card.id}
          onDragStart={() => setDragId(card.id)}
          onDragEnd={() => { setDragId(null); setStartArmed(false); setEndArmed(false); }}
          onDropHere={() => dropOn(card.id)}
          onUpdate={(p) => update(card.id, p)}
          onRemove={() => remove(card.id)}
        />
      ))}
      {dragId && visible.length > 0 && (
        <div
          className={'swn-drop-zone' + (endArmed ? ' armed' : '')}
          onDragOver={(e) => { e.preventDefault(); setEndArmed(true); }}
          onDragLeave={() => setEndArmed(false)}
          onDrop={dropAtEnd}
        />
      )}
    </div>
  );
}

/* ═══════════ Tool: Notes ═══════════ */

interface EditorToolProps {
  editor: Editor | null;
}

/**
 * v0.93 — ONE list, no sub-types (same move as To-Do in v0.92).
 *
 * General vs Script was a filing system you had to understand before you could
 * find a note. What actually distinguishes them isn't a type, it's whether the
 * note is LINKED to something in the script — so both now sit in one list, and
 * the link is shown on the note itself: a script note carries the scene or
 * character it's anchored to (and the text it's attached to), while a standalone
 * note shows nothing there. Blank is the signal.
 */
export function StickyNotesTool({ editor }: EditorToolProps) {
  const { add } = useCardOps();
  return (
    <div className="fs-sticky-tool">
      {/* v1.0: ScriptNotesContent now renders BOTH kinds of note in one list,
          with the Filter / Sort bar at the top. No more separate sections. */}
      <div className="fs-notes-list">
        <ScriptNotesContent editor={editor} />
      </div>
      <div className="swn-add-row">
        <button className="swn-add-btn" onClick={() => add('comment')}>+ Add</button>
      </div>
    </div>
  );
}

/* ═══════════ Tool: Snippets ═══════════ */

export function FragmentsTool(_props: EditorToolProps) {
  return (
    <div className="fs-sticky-tool">
      <CardList type="snippet" />
    </div>
  );
}

/* ═══════════ Tool: To-Do ═══════════ */

/**
 * v0.92 — ONE list, no sub-types.
 *
 * There used to be two kinds of to-do (General cards vs Script checklist lines)
 * split across sub-tabs, which forced you to know which bucket a thing was in
 * before you could find it. The distinction that actually matters isn't a type —
 * it's WHERE the to-do lives. So there's now a single list, and each row carries
 * a Location: the scene it sits in for a to-do added to the script, blank for one
 * that only exists in this window.
 *
 * Both are still real things (a script to-do is a [ ] line in the document, so it
 * travels with the script; a standalone one doesn't) — that difference is now
 * shown rather than filed away in tabs.
 */
export function TodoTool({ editor }: EditorToolProps) {
  const { add } = useCardOps();
  const { shelfCards, setShelfCards, todoOrder, setTodoOrder } = useEditorStore();
  const [docTick, setDocTick] = useState(0);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [sort, setSort] = useState<ListSort>('manual');
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  /**
   * To-do lists living in the script. Consecutive [ ] lines are ONE list (what
   * Enter builds), so they surface as one card — the same card a list made in
   * this window gets. Title and colour ride on the first line's attrs.
   */
  const scriptLists = useMemo(() => {
    type Line = { text: string; done: boolean };
    const out: Array<{
      id: string; start: number; end: number; lines: Line[];
      title: string; color: string | null; scene: string;
    }> = [];
    if (editor) {
      // v1.3.1: the link names the scene NUMBER — a locked production number if
      // the heading carries one, otherwise its position in the script.
      let scene = 'Linked to Script';
      let ordinal = 0;
      let run: (typeof out)[number] | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          ordinal += 1;
          const num = (node.attrs as { sceneNumber?: number | string | null })?.sceneNumber;
          scene = `Linked to Scene ${num ?? ordinal}`;
          run = null;
          return true;
        }
        if (node.type.name === 'general') {
          const text = node.textContent || '';
          if (/^\[[ x]\]/.test(text)) {
            const line: Line = { text: text.slice(3).trim(), done: text[1] === 'x' };
            if (run && run.end === pos) {
              run.lines.push(line);
              run.end = pos + node.nodeSize;
            } else {
              run = {
                id: (node.attrs.todoId as string) || `at:${pos}`,
                start: pos, end: pos + node.nodeSize, lines: [line],
                title: (node.attrs.todoTitle as string) || '',
                color: (node.attrs.todoColor as string) || null,
                scene,
              };
              out.push(run);
            }
            return true;
          }
        }
        run = null;
        return true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return out;
  }, [editor, docTick]);

  /** Rewrite a run from its items — one transaction, so undo is one step. */
  const writeLines = (
    list: { start: number; end: number; id: string; title: string; color: string | null },
    lines: Array<{ text: string; done: boolean }>,
    attrs?: { todoTitle?: string | null; todoColor?: string | null },
  ) => {
    if (!editor) return;
    const { schema } = editor.state;
    const nodes = lines.map((l, i) => schema.nodes.general.create(
      i === 0
        ? {
            todoId: list.id.startsWith('at:') ? uuid() : list.id,
            todoTitle: attrs?.todoTitle !== undefined ? attrs.todoTitle : (list.title || null),
            todoColor: attrs?.todoColor !== undefined ? attrs.todoColor : list.color,
          }
        : {},
      schema.text(`[${l.done ? 'x' : ' '}] ${l.text || ''}`),
    ));
    editor.view.dispatch(editor.state.tr.replaceWith(list.start, list.end, nodes));
  };

  const removeList = (list: { start: number; end: number }) => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.delete(list.start, list.end));
  };

  const jumpTo = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
  };

  const entries: ListEntry[] = [
    ...scriptLists.map((list) => ({
      key: `todo:${list.id}`,
      linked: true,
      pos: list.start,
      render: () => {
        const card: ShelfCard = {
          id: `todo:${list.id}`,
          type: 'todo',
          color: list.color || SHELF_DEFAULT_COLOR,
          title: list.title,
          items: list.lines.map((l) => ({ text: l.text, done: l.done })),
        };
        const dp = entryDragProps(`todo:${list.id}`, sort === 'manual', dragKey, setDragKey, onDropKey);
        return (
          <div {...dp.card}>
            <StickyCard
              card={card}
              dragging={dragKey === `todo:${list.id}`}
              onDragStart={dp.grip.onDragStart}
              onDragEnd={dp.grip.onDragEnd}
              onDropHere={() => {}}
              anchor={{ label: list.scene, onClick: () => jumpTo(list.start) }}
              onUpdate={(patch) => writeLines(list, patch.items ?? card.items ?? [], {
                ...(patch.title !== undefined ? { todoTitle: patch.title || null } : {}),
                ...(patch.color !== undefined ? { todoColor: patch.color || null } : {}),
              })}
              onRemove={() => removeList(list)}
            />
          </div>
        );
      },
    })),
    ...shelfCards.filter((c) => c.type === 'todo').map((card) => ({
      key: `card:${card.id}`,
      linked: false,
      createdAt: card.createdAt,
      render: () => {
        const dp = entryDragProps(`card:${card.id}`, sort === 'manual', dragKey, setDragKey, onDropKey);
        return (
          <div {...dp.card}>
            <StickyCard
              card={card}
              dragging={dragKey === `card:${card.id}`}
              onDragStart={dp.grip.onDragStart}
              onDragEnd={dp.grip.onDragEnd}
              onDropHere={() => {}}
              anchor={{ label: 'General' }}
              onUpdate={(patch) => setShelfCards(shelfCards.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))}
              onRemove={() => setShelfCards(shelfCards.filter((c) => c.id !== card.id))}
            />
          </div>
        );
      },
    })),
  ];
  const allKeys = entries.map((e) => e.key);
  function onDropKey(from: string, to: string) {
    setSort('manual');
    setTodoOrder(reorderKeys(todoOrder, allKeys, from, to));
  }
  const visible = arrangeEntries(entries, filter, sort, todoOrder);

  return (
    <div className="fs-sticky-tool">
      <ListToolbar
        filter={filter} setFilter={setFilter}
        sort={sort} setSort={setSort}
        count={visible.length} noun="to-do"
      />
      <div className="fs-todo-list">
        {visible.length === 0 ? (
          <div className="fs-nav-empty fs-todo-hint">
            {entries.length === 0
              ? <>Add a to-do below, or use <strong>Insert → To-Do List</strong> to add one in the script.</>
              : 'No to-dos match this filter.'}
          </div>
        ) : (
          visible.map((e) => <React.Fragment key={e.key}>{e.render()}</React.Fragment>)
        )}
      </div>
      <div className="swn-add-row">
        <button className="swn-add-btn" onClick={() => add('todo')}>+ Add</button>
      </div>
    </div>
  );
}

