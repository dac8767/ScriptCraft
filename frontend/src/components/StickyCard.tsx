/**
 * StickyCard (v0.96) — THE card. One component for every card in Notes and To-Do,
 * whether the thing was made in the window or in the script.
 *
 * It used to live inside StickyNotes, so anything outside that file could only
 * imitate it — which is exactly how script to-dos and script notes ended up as
 * second-class lookalikes with a different shape. Extracted here so there is one
 * card and both callers render it instead of reproducing it.
 *
 * It also breaks an import cycle: ScriptNotes needs the card, and StickyNotes
 * needs ScriptNotes. formatDate lives here now, so nothing imports backwards.
 */
import React, { useRef, useState } from 'react';
import { FaCopy, FaRegTrashAlt } from 'react-icons/fa';
import type { ShelfCard, ShelfCardType } from '../stores/editorStore';
import { SHELF_COLORS, SHELF_DEFAULT_COLOR } from '../stores/editorStore';
import { readableTextOn } from '../utils/palettes';

/** Shared date formatter for card headers. */
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// v1.2: the title is an editable field, and "Note" / "To-Do" read like a label
// for the card rather than an invitation to type. The ellipsis says "your turn".
export const CARD_PLACEHOLDERS: Record<ShelfCardType, string> = {
  comment: 'Note Title...',
  todo: '✓ List Title...',
  snippet: 'Snippet',
};

export function ColorDots({ card, onUpdate, surface }: { card: ShelfCard; onUpdate: (p: Partial<ShelfCard>) => void; surface?: string }) {
  const [open, setOpen] = useState(false);
  // v4.35 (batch-v9 #5): while the NATIVE color panel is up the pointer is off
  // the row — the pop must not close under it, or the <input> unmounts and
  // every pick lands in the void. Blur (next click anywhere) closes instead.
  const picking = useRef(false);
  const cur = card.color || SHELF_DEFAULT_COLOR;
  const isPreset = SHELF_COLORS.some(([c]) => c === cur);
  // v4.37: the closed trigger circle is painted the card's own color and sits
  // ON the card — on a dark card it vanishes. Ring it with the black-or-white
  // that readableTextOn picks for ink on that surface (the card face itself,
  // or whatever surface the caller says the dot is sitting on).
  const ring = readableTextOn(surface || cur);
  // the pop is right-anchored, so the row fans out to the LEFT of the trigger
  // and always stays inside the pane. v4.36 batch-v10 #3, Derek: whatever
  // shows the CURRENT color sits RIGHTMOST — exactly over the closed dot's
  // spot, so opening the pop never moves it — and the custom + swatch takes
  // the FAR (left) end. When the current color IS a custom hex, the custom
  // swatch is the current-color slot and stays rightmost instead.
  const ordered = [...SHELF_COLORS.filter(([c]) => c !== cur), ...SHELF_COLORS.filter(([c]) => c === cur)];
  const customSwatch = (
    <label
      className="swn-color-custom"
      title="Custom color"
      style={isPreset ? undefined : { background: cur, outline: '2px solid #666' }}
    >
      <input
        type="color"
        value={cur}
        onFocus={() => { picking.current = true; }}
        onBlur={() => { picking.current = false; setOpen(false); }}
        onChange={(e) => onUpdate({ color: e.target.value })}
      />
      {isPreset && <span>+</span>}
    </label>
  );
  return (
    <span
      className="swn-color-pick"
      onClick={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <span
        className="swn-dot"
        style={{
          background: cur,
          visibility: open ? 'hidden' : 'visible',
          ...(ring ? { borderColor: ring } : {}),
        }}
        title="Sticky color"
        onClick={() => setOpen(true)}
      />
      {open && (
        <span className="swn-color-pop" onMouseLeave={() => { if (!picking.current) setOpen(false); }}>
          {isPreset && customSwatch}
          {ordered.map(([c, name]) => (
            <span
              key={c}
              className="swn-dot"
              title={name}
              style={{ background: c, outline: c === cur ? '2px solid #666' : 'none' }}
              onClick={() => { onUpdate({ color: c }); setOpen(false); }}
            />
          ))}
          {!isPreset && customSwatch}
        </span>
      )}
    </span>
  );
}

interface StickyCardProps {
  card: ShelfCard;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDropHere: () => void;
  onUpdate: (p: Partial<ShelfCard>) => void;
  onRemove: () => void;
  /** Replace the card's body while keeping the identical shell. */
  children?: React.ReactNode;
}

// v4.33: the `anchor` foot ("Linked to Scene 14" / "General") is gone — every
// card in these windows is general now, so there was nothing left to
// distinguish. Script notes/to-dos live in the Navigator instead.
export function StickyCard({ card, dragging, onDragStart, onDragEnd, onDropHere, onUpdate, onRemove, children }: StickyCardProps) {
  // v4.37, Derek: the resize grabber lives in the foot's right corner now, so
  // the textarea's native corner handle is off (19-sticky-notes.css) and this
  // pointer-drag adjusts its height instead. Height is an inline style, same
  // as the native handle wrote, so persistence semantics are unchanged.
  const taRef = useRef<HTMLTextAreaElement>(null);
  const startResize = (e: React.PointerEvent) => {
    const ta = taRef.current;
    if (!ta) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = ta.offsetHeight;
    const onMove = (ev: PointerEvent) => {
      ta.style.height = Math.max(64, startH + (ev.clientY - startY)) + 'px';
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Header: ⋮⋮ grip drags; the type name is placeholder text in an editable title
  const head = (extra?: React.ReactNode) => (
    <h5 className="swn-card-head">
      <span
        className="swn-drag-grip"
        draggable
        onDragStart={(e) => {
          // v5.24, Derek: "the drag feature isn't working." The consumers
          // pass bare closures, and WebKit refuses to START a drag without
          // dataTransfer data (the house footgun, CLAUDE.md §4) — so the
          // grip sets its own payload; no caller can forget it again.
          e.dataTransfer.setData('text/plain', card.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(e);
        }}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >⋮⋮</span>
      <input
        className="swn-card-title"
        value={card.title || ''}
        placeholder={CARD_PLACEHOLDERS[card.type]}
        onChange={(e) => onUpdate({ title: e.target.value })}
      />
      <span className="swn-card-actions">
        <ColorDots card={card} onUpdate={onUpdate} />
        {extra}
        <button className="swn-x" title="Delete" onClick={onRemove}><FaRegTrashAlt /></button>
      </span>
    </h5>
  );

  const wrap = (inner: React.ReactNode, resizable = false) => (
    <div
      className={'swn-card' + (dragging ? ' dragging' : '')}
      style={{ background: card.color || SHELF_DEFAULT_COLOR }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHere}
    >
      {inner}
      {/* v4.37, Derek: foot is ONE row — date on the LEFT, resize grabber
          (comment cards) on the RIGHT. */}
      <div className="swn-card-foot">
        {card.createdAt && <span className="swn-card-date">{formatDate(card.createdAt)}</span>}
        {resizable && (
          <span
            className="swn-card-resize"
            title="Drag to resize"
            // The shared stripe gradient inks with --fd-text-muted (a THEME
            // color); this grip sits on a USER color, so re-point the var at
            // the card's luminance ink — same system as the dot ring above.
            style={{ '--fd-text-muted': readableTextOn(card.color || SHELF_DEFAULT_COLOR) || '#333' } as React.CSSProperties}
            onPointerDown={startResize}
          />
        )}
      </div>
    </div>
  );

  // A caller can supply the body while keeping the identical shell — this is how
  // a script note gets the same card as a window note without losing its own
  // editor (asset autocomplete, media).
  if (children) return wrap(<>{head()}{children}</>);

  if (card.type === 'comment') {
    return wrap(<>
      {head()}
      <textarea
        ref={taRef}
        className="swn-comment-input"
        value={card.text || ''}
        placeholder="Research links, themes to keep present, notes to self…"
        onChange={(e) => onUpdate({ text: e.target.value })}
      />
    </>, true);
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
      {/* v5.22, Derek: the add affordance IS a blank check row — no dashed
          divider, no separate field. Type into it; Enter (or clicking away
          with text) commits the item and the row blanks again. */}
      <label className="swn-todo-item swn-todo-blank">
        <input type="checkbox" checked={false} disabled aria-hidden="true" tabIndex={-1} />
        <input
          className="swn-todo-blank-input"
          aria-label="New checklist item"
          onKeyDown={(e) => {
            const el = e.target as HTMLInputElement;
            if (e.key === 'Enter' && el.value.trim()) {
              onUpdate({ items: [...items, { text: el.value.trim(), done: false }] });
              el.value = '';
            }
          }}
          onBlur={(e) => {
            const el = e.currentTarget;
            if (el.value.trim()) {
              onUpdate({ items: [...items, { text: el.value.trim(), done: false }] });
              el.value = '';
            }
          }}
        />
      </label>
    </>);
  }

  if (card.type === 'snippet') {
    return wrap(<>
      {head((
        <button
          className="swn-x"
          title="Copy to clipboard"
          onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(card.text || ''); }}
        ><FaCopy /></button>
      ))}
      <div className="swn-snippet">{card.text}</div>
    </>);
  }
  return null;
}
