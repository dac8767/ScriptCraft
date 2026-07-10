/**
 * StickyNotes — the FreeDraft sticky-card system, now split into three
 * right-dock tools:
 *   - StickyNotesTool ("Sticky Notes"): General / Script sub-tabs — General is
 *     free-form sticky cards, Script is OpenDraft's anchored notes. The 🔍
 *     search spans both sub-views.
 *   - FragmentsTool ("Snippets"): text sent from the
 *     editor via ⌥⌘X (cut) / ⌥⌘C (copy) — bound in ScreenplayEditor.
 *   - TodoTool ("To-Do"): checklist cards.
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
  todo: 'Running checklists that stay out of the Navigator. Hit + Add below.',
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

/* ═══════════ Tool: Sticky Notes (General / Script sub-tabs) ═══════════ */

interface EditorToolProps {
  editor: Editor | null;
}

export function StickyNotesTool({ editor }: EditorToolProps) {
  const { shelfCards, notesSubTab, setNotesSubTab } = useEditorStore();
  const { add } = useCardOps();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const searching = searchOpen && q.length > 0;
  const matches = searching
    ? shelfCards.filter((c) => c.type === 'comment' && cardText(c).toLowerCase().includes(q))
    : undefined;

  return (
    <div className="fs-sticky-tool">
      <div className="fs-subtab-row">
        <button
          className={`fs-subtab${notesSubTab === 'general' ? ' active' : ''}`}
          onClick={() => setNotesSubTab('general')}
        >General</button>
        <button
          className={`fs-subtab${notesSubTab === 'script' ? ' active' : ''}`}
          onClick={() => setNotesSubTab('script')}
        >Script</button>
      </div>
      {notesSubTab === 'script' ? (
        <ScriptNotesContent editor={editor} />
      ) : (
      <>
      <div className="fs-sticky-toolbar">
        <span className="swn-group-label" style={{ padding: 0, flex: 1 }}>
          {shelfCards.filter((c) => c.type === 'comment').length} note{shelfCards.filter((c) => c.type === 'comment').length === 1 ? '' : 's'}
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
      <CardList type="comment" cards={matches} />
      {!searching && (
        <div className="swn-add-row">
          <button className="swn-add-btn" onClick={() => add('comment')}>+ Add</button>
        </div>
      )}
      </>
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

export function TodoTool({ editor }: EditorToolProps) {
  const { add } = useCardOps();
  const [subTab, setSubTab] = useState<'general' | 'script'>('general');
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor || subTab !== 'script') return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor, subTab]);

  // Script sub-tab: checklist lines living in the document itself
  // (Insert > Checklist Item), the same items the Navigator shows.
  const docItems = useMemo(() => {
    const out: Array<{ text: string; pos: number; done: boolean }> = [];
    if (editor && subTab === 'script') {
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'general') {
          const text = node.textContent || '';
          if (/^\[[ x]\]/.test(text)) {
            out.push({ text: text.slice(3).trim() || '(empty item)', pos, done: text[1] === 'x' });
          }
        }
        return true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return out;
  }, [editor, subTab, docTick]);

  const toggleDocItem = (it: { pos: number; done: boolean }) => {
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
      <div className="fs-subtab-row">
        <button
          className={`fs-subtab${subTab === 'general' ? ' active' : ''}`}
          onClick={() => setSubTab('general')}
        >General</button>
        <button
          className={`fs-subtab${subTab === 'script' ? ' active' : ''}`}
          onClick={() => setSubTab('script')}
        >Script</button>
      </div>
      {subTab === 'general' ? (
        <>
          <CardList type="todo" />
          <div className="swn-add-row">
            <button className="swn-add-btn" onClick={() => add('todo')}>+ Add</button>
          </div>
        </>
      ) : (
        <div className="fs-doc-todo-list">
          {docItems.length === 0 && (
            <div className="fs-nav-empty">
              No checklist items in the script yet.
              <br />
              Use <strong>Insert → Checklist Item</strong> to add one at the cursor.
            </div>
          )}
          {docItems.map((it, i) => (
            <div key={`${it.pos}-${i}`} className="fs-doc-todo-row">
              <input type="checkbox" checked={it.done} onChange={() => toggleDocItem(it)} />
              <span
                className={it.done ? 'fs-nav-done' : ''}
                onClick={() => jumpTo(it.pos)}
                title="Click to jump to this item in the script"
              >{it.text}</span>
            </div>
          ))}
        </div>
      )}
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
