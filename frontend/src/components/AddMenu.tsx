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

export default function AddMenu({ groups, onPick, label = '+ Add Item', title, center, triggerClass }: {
  groups: AddMenuGroup[];
  onPick: (value: string) => void;
  /** v1.90: may carry an icon (ListControls' Filter trigger wears the funnel). */
  label?: React.ReactNode;
  title?: string;
  /** Centre the trigger's text, for when it sits in a row of ordinary buttons. */
  center?: boolean;
  /** v7.57: wear the surrounding control's class instead of the default
   *  trigger — a column header's "+Add" has to match the "Show All" beside it,
   *  and a menu that looks like a form field in a header row reads as a
   *  mistake. Replaces the trigger's own styling rather than adding to it. */
  triggerClass?: string;
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
   * Placement (v1.3.2).
   *
   * The menu is portalled to the BODY: inside a side panel it was painted behind
   * the neighbouring panel, and an absolutely positioned child can't climb out of
   * its ancestors' stacking context or overflow no matter what z-index it carries.
   *
   * It is positioned with TOP and LEFT only — never `bottom`. Anchoring an
   * auto-height, max-height, overflow:auto box by its bottom edge is exactly the
   * combination that collapsed the "+ Add Item" menus in Customize: they sit at
   * the foot of the dialog, so they were the ones that took the flip-upward path,
   * while the Filter/Sort menus near the top of a panel opened downward and worked.
   * So: measure the menu, decide up or down, and give it a real top.
   */
  const [pos, setPos] = React.useState<{ top: number; left: number; maxH: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;

    const GAP = 4;
    const EDGE = 8;
    const r = btn.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const spaceBelow = vh - r.bottom - GAP - EDGE;
    const spaceAbove = r.top - GAP - EDGE;
    const wanted = pop.scrollHeight;               // the menu's natural height

    const down = wanted <= spaceBelow || spaceBelow >= spaceAbove;
    const maxH = Math.max(120, Math.min(320, down ? spaceBelow : spaceAbove));
    const height = Math.min(wanted, maxH);
    const top = down ? r.bottom + GAP : Math.max(EDGE, r.top - GAP - height);

    const left = Math.max(EDGE, Math.min(r.left, vw - pop.offsetWidth - EDGE));
    setPos({ top, left, maxH });
  }, [open, groups]);

  // A menu pinned to the viewport can't follow its button, so close rather than
  // leave it stranded somewhere the button no longer is.
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <div className="fs-addmenu" ref={ref}>
      <button
        ref={btnRef}
        className={triggerClass ?? `fs-addmenu-trigger${center ? ' fs-addmenu-center' : ''}`}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >{label}</button>
      {open && createPortal(
        <div
          className="fs-addmenu-pop"
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            maxHeight: pos?.maxH ?? 320,
            // Mounted but invisible for one frame so it can be measured; showing
            // it at 0,0 first would make it jump across the screen.
            visibility: pos ? 'visible' : 'hidden',
            zIndex: 2147483647,
          }}
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
