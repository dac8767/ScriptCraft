/**
 * StickyNotes — the FreeDraft sticky-card system, now split into three
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
import React, { useState, useMemo, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  useEditorStore,
  SHELF_COLORS,
  SHELF_DEFAULT_COLOR,
  type ShelfCard,
  type ShelfCardType,
} from '../stores/editorStore';
import { ScriptNotesContent, formatDate } from './ScriptNotes';
import { uuid } from '../utils/uuid';

const CARD_PLACEHOLDERS: Record<ShelfCardType, string> = {
  comment: '💬 Note',
  todo: '✓ To-Do',
  snippet: '📄 Snippet',
};

const EMPTY_HINTS: Record<ShelfCardType, string> = {
  comment: 'Notes to self, research links, themes to keep present. Hit + Add below.',
  todo: 'To-do lists. Ones added to the script show the scene they’re in. Hit + Add below.',
  snippet: 'Select text in the Editor and press ⌥⌘X to cut it here, or ⌥⌘C to copy it over.',
};

/** Build a snippet card from editor text (used by the capture shortcuts). */
export function makeSnippetCard(text: string): ShelfCard {
  return { id: uuid(), type: 'snippet', text, color: SHELF_DEFAULT_COLOR, createdAt: new Date().toISOString() };
}

const cardText = (c: ShelfCard): string => {
  const body = c.type === 'todo' ? (c.items || []).map((i) => i.text).join('\n') : c.text || '';
  return c.title ? `${c.title}\n${body}` : body;
};

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
  const { shelfCards } = useEditorStore();
  const { add } = useCardOps();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const searching = searchOpen && q.length > 0;
  const matches = searching
    ? shelfCards.filter((c) => c.type === 'comment' && cardText(c).toLowerCase().includes(q))
    : undefined;
  const standalone = shelfCards.filter((c) => c.type === 'comment').length;

  return (
    <div className="fs-sticky-tool">
      <div className="fs-sticky-toolbar">
        <span className="swn-group-label" style={{ padding: 0, flex: 1 }}>
          {standalone} note{standalone === 1 ? '' : 's'} not linked to the script
        </span>
        <button
          className="swn-search-btn"
          title={searchOpen ? 'Close search' : 'Search notes'}
          onClick={() => { if (searchOpen) setQuery(''); setSearchOpen((o) => !o); }}
        >{searchOpen ? '✕' : '🔍'}</button>
      </div>
      {searchOpen && (
        <div className="swn-search-row">
          <input autoFocus value={query} placeholder="Search notes…" onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      {/* Script-linked notes first — each already shows what it's anchored to
          (the scene or character, plus the quoted text). Then the standalone
          notes, which have nothing to show there. */}
      <div className="fs-notes-list">
        {!searching && <ScriptNotesContent editor={editor} />}
        <CardList type="comment" cards={matches} />
      </div>

      {!searching && (
        <div className="swn-add-row">
          <button className="swn-add-btn" onClick={() => add('comment')}>+ Add</button>
        </div>
      )}
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
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  // To-dos that live in the script: [ ] lines in the document. Each one records
  // the scene it falls under — that's the Location shown on its row.
  const docTodos = useMemo(() => {
    const out: Array<{ text: string; pos: number; done: boolean; linkLabel: string }> = [];
    if (editor) {
      let scene = '';
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'sceneHeading') {
          scene = node.textContent || '(untitled scene)';
        } else if (node.type.name === 'general') {
          const text = node.textContent || '';
          if (/^\[[ x]\]/.test(text)) {
            out.push({
              text: text.slice(3).trim() || '(empty to-do)',
              pos,
              done: text[1] === 'x',
              // The label is just what you click — the scene it's in when there
              // is one, otherwise a plain "View in script". Not a description of
              // where it lives; a way to get there.
              linkLabel: scene || 'View in script',
            });
          }
        }
        return true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return out;
  }, [editor, docTick]);

  const toggleDocTodo = (it: { pos: number; done: boolean }) => {
    if (!editor) return;
    const tr = editor.state.tr.replaceWith(
      it.pos + 1, it.pos + 4, editor.state.schema.text(it.done ? '[ ]' : '[x]'),
    );
    editor.view.dispatch(tr);
  };

  const jumpTo = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
  };

  return (
    <div className="fs-sticky-tool">
      <div className="fs-todo-list">
        {/* v0.94: a to-do added in the script uses the SAME card format as one
            added here — the only difference is the link at the bottom, which
            takes you to it in the editor. It doesn't describe where it is; you
            just click through. */}
        {docTodos.map((it, i) => (
          <div key={`${it.pos}-${i}`} className="swn-card swn-card-script">
            <label className="swn-todo-item">
              <input type="checkbox" checked={it.done} onChange={() => toggleDocTodo(it)} />
              <span style={{ textDecoration: it.done ? 'line-through' : 'none', color: it.done ? '#8a8a7a' : '#333' }}>
                {it.text}
              </span>
            </label>
            <button
              className="fs-script-link"
              onClick={() => jumpTo(it.pos)}
              title="Go to this to-do in the script"
            >{it.linkLabel}</button>
          </div>
        ))}

        {/* Standalone to-do lists — nothing to link to, so no link. */}
        <CardList type="todo" />

        {docTodos.length === 0 && (
          <div className="fs-nav-empty fs-todo-hint">
            Add a to-do below, or use <strong>Insert → To-Do List</strong> to add one
            in the script.
          </div>
        )}
      </div>
      <div className="swn-add-row">
        <button className="swn-add-btn" onClick={() => add('todo')}>+ Add</button>
      </div>
    </div>
  );
}

/* ═══════════ Card + color picker (unchanged behavior) ═══════════ */

function ColorDots({ card, onUpdate }: { card: ShelfCard; onUpdate: (p: Partial<ShelfCard>) => void }) {
  const [open, setOpen] = useState(false);
  const cur = card.color || SHELF_DEFAULT_COLOR;
  // when open, the trigger dot joins the row: the current color sits rightmost,
  // exactly where the single circle was, and the rest fan out to the LEFT so
  // the row always stays inside the pane
  const ordered = [...SHELF_COLORS.filter(([c]) => c !== cur), ...SHELF_COLORS.filter(([c]) => c === cur)];
  return (
    <span
      className="swn-color-pick"
      onClick={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <span
        className="swn-dot"
        style={{ background: cur, visibility: open ? 'hidden' : 'visible' }}
        title="Sticky color"
        onClick={() => setOpen(true)}
      />
      {open && (
        <span className="swn-color-pop" onMouseLeave={() => setOpen(false)}>
          {ordered.map(([c, name]) => (
            <span
              key={c}
              className="swn-dot"
              title={name}
              style={{ background: c, outline: c === cur ? '2px solid #666' : 'none' }}
              onClick={() => { onUpdate({ color: c }); setOpen(false); }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

interface StickyCardProps {
  card: ShelfCard;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropHere: () => void;
  onUpdate: (p: Partial<ShelfCard>) => void;
  onRemove: () => void;
}

function StickyCard({ card, dragging, onDragStart, onDragEnd, onDropHere, onUpdate, onRemove }: StickyCardProps) {
  // Header: ⠿ grip drags; the type name is placeholder text in an editable title
  const head = (extra?: React.ReactNode) => (
    <h5 className="swn-card-head">
      <span
        className="swn-drag-grip"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >⠿</span>
      <input
        className="swn-card-title"
        value={card.title || ''}
        placeholder={CARD_PLACEHOLDERS[card.type]}
        onChange={(e) => onUpdate({ title: e.target.value })}
      />
      <span className="swn-card-actions">
        <ColorDots card={card} onUpdate={onUpdate} />
        {extra}
        <button className="swn-x" title="Delete" onClick={onRemove}>✕</button>
      </span>
    </h5>
  );

  const wrap = (children: React.ReactNode) => (
    <div
      className={'swn-card' + (dragging ? ' dragging' : '')}
      style={{ background: card.color || SHELF_DEFAULT_COLOR }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHere}
    >
      {children}
      {card.createdAt && <div className="swn-card-date">{formatDate(card.createdAt)}</div>}
    </div>
  );

  if (card.type === 'comment') {
    return wrap(<>
      {head()}
      <textarea
        className="swn-comment-input"
        value={card.text || ''}
        placeholder="Research links, themes to keep present, notes to self…"
        onChange={(e) => onUpdate({ text: e.target.value })}
      />
    </>);
  }

  if (card.type === 'todo') {
    const items = card.items || [];
    return wrap(<>
      {head((
        <button
          className="swn-x"
          title="Clear completed"
          onClick={() => onUpdate({ items: items.filter((i) => !i.done) })}
        >⌫</button>
      ))}
      {items.map((it, i) => (
        <label key={i} className="swn-todo-item">
          <input
            type="checkbox"
            checked={it.done}
            onChange={() =>
              onUpdate({ items: items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
          />
          <span style={{ textDecoration: it.done ? 'line-through' : 'none', color: it.done ? '#8a8a7a' : '#333' }}>
            {it.text}
          </span>
        </label>
      ))}
      <input
        className="swn-todo-new"
        placeholder="New to-do…"
        onKeyDown={(e) => {
          const el = e.target as HTMLInputElement;
          if (e.key === 'Enter' && el.value.trim()) {
            onUpdate({ items: [...items, { text: el.value.trim(), done: false }] });
            el.value = '';
          }
        }}
      />
    </>);
  }

  if (card.type === 'snippet') {
    return wrap(<>
      {head((
        <button
          className="swn-x"
          title="Copy to clipboard"
          onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(card.text || ''); }}
        >⧉</button>
      ))}
      <div className="swn-snippet">{card.text}</div>
    </>);
  }
  return null;
}
