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

export interface AddMenuGroup {
  label: string;
  options: { value: string; label: string }[];
}

export default function AddMenu({ groups, onPick, label = '+ Add Item', title }: {
  groups: AddMenuGroup[];
  onPick: (value: string) => void;
  label?: string;
  title?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div className="fs-addmenu" ref={ref}>
      <button
        className="fs-addmenu-trigger"
        title={title}
        onClick={() => setOpen((o) => !o)}
      >{label}</button>
      {open && (
        <div className="fs-addmenu-pop">
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
                >{o.label}</button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
