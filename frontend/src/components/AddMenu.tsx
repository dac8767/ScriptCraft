/**
 * AddMenu (v0.95) — the "+ Add Item" dropdown in the Customize tabs.
 *
 * These were native <select>s, and a native select ALWAYS marks its current
 * value with a checkmark. The current value here is the placeholder ("+ Add
 * Item") — so the menu opened showing "✓ + Add Item", a tick against a thing you
 * hadn't picked. The tick isn't removable from a native select; it's the OS
 * drawing the selected row. So this is a plain menu instead: a button that opens
 * a list, with no selected state to advertise, which is the honest model anyway —
 * you're running an action, not choosing a value.
 *
 * Keeps the grouped layout (categories with headers) the tabs already relied on.
 */
import React from 'react';
import { createPortal } from 'react-dom';

export interface AddMenuGroup {
  label: string;
  /** v0.99: an option shows the same icon its row (and the real button) shows. */
  options: { value: string; label: string; icon?: React.ReactNode }[];
}

export default function AddMenu({ groups, onPick, label = '+ Add Item', title, center }: {
  groups: AddMenuGroup[];
  onPick: (value: string) => void;
  label?: string;
  title?: string;
  /** Centre the trigger's text, for when it sits in a row of ordinary buttons. */
  center?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const usable = groups.filter((g) => g.options.length > 0);

  /**
   * v1.2 — the menu is rendered into the BODY, not inside the panel.
   *
   * The Sort menu in a side panel was appearing BEHIND the panel: an absolutely
   * positioned child is still trapped by its ancestors' stacking context and
   * their overflow, and no z-index on the menu itself can climb out of that. A
   * portal with fixed coordinates escapes both. Position is measured from the
   * trigger, and the menu flips above it when there isn't room below.
   */
  const [pos, setPos] = React.useState<{ left: number; top?: number; bottom?: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setPos(below < 260 && r.top > below
      ? { left: r.left, bottom: window.innerHeight - r.top + 4 }
      : { left: r.left, top: r.bottom + 4 });
  }, [open]);

  return (
    <div className="fs-addmenu" ref={ref}>
      <button
        ref={btnRef}
        className={`fs-addmenu-trigger${center ? ' fs-addmenu-center' : ''}`}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >{label}</button>
      {open && pos && createPortal(
        <div
          className="fs-addmenu-pop"
          ref={popRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom }}
        >
          {usable.length === 0 && (
            <div className="fs-addmenu-empty">Nothing left to add</div>
          )}
          {usable.map((g) => (
            <div className="fs-addmenu-group" key={g.label}>
              {g.label && <div className="fs-addmenu-head">{g.label}</div>}
              {g.options.map((o) => (
                <button
                  key={o.value}
                  className="fs-addmenu-item"
                  onClick={() => { onPick(o.value); setOpen(false); }}
                >
                  <span className="fs-customize-icon">{o.icon ?? null}</span>
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
