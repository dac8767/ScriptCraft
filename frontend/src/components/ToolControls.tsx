/**
 * v4.27, Derek's window template: the row-2 control cluster every tool window
 * shares — quiet Airtable-style text controls, in the fixed order
 * Filter / Sort / View / Search. Tools compose these primitives in their
 * TOOL_CHROME entry (ToolDock); nothing here is tool-specific.
 *
 * - ControlDropdown: text trigger (optional icon / count chip / current-value
 *   label) opening a portalled menu — fixed position, measured from the
 *   trigger, top/left only (the WebKit bottom-anchor footgun).
 * - ControlSearch: a magnifier that expands into an inline field, pushing the
 *   sibling controls left; ✕ or Escape collapses it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronDown, LuSearch, LuX } from 'react-icons/lu';

export interface ControlDropdownItem {
  label: string;
  active?: boolean;
  onSelect: () => void;
}

export const ControlDropdown: React.FC<{
  /** The control's name ("Filter", "Sort") — or omit to show only `current`. */
  label?: string;
  /** Current-value text shown on the trigger (View shows the active view). */
  current?: string;
  icon?: React.ReactNode;
  /** Small count chip (e.g. active filter count); hidden when 0/undefined. */
  chip?: number;
  title?: string;
  items: ControlDropdownItem[];
}> = ({ label, current, icon, chip, title, items }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pos) return;
    // Grace window: the opening click can emit a scroll a frame later
    // (focus scroll / anchoring) — without it the menu dies the frame it
    // opens. Genuine user scrolling still dismisses.
    const openedAt = performance.now();
    const close = () => setPos(null);
    const closeOnScroll = () => { if (performance.now() - openedAt > 150) setPos(null); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [pos]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 200) });
  };
  return (
    <>
      <button
        ref={btnRef}
        className={`tool-ctl${pos ? ' open' : ''}`}
        title={title ?? label}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {icon && <span className="tool-ctl-icon">{icon}</span>}
        {label && <span className="tool-ctl-label">{label}</span>}
        {current && <span className="tool-ctl-current">{current}</span>}
        {chip !== undefined && chip > 0 && <span className="tool-ctl-chip">{chip}</span>}
        <LuChevronDown className="tool-ctl-chev" aria-hidden />
      </button>
      {pos && createPortal(
        <div className="tool-ctl-menu" style={{ top: pos.top, left: pos.left }} onPointerDown={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button
              key={it.label}
              className={`tool-ctl-menu-item${it.active ? ' active' : ''}`}
              onClick={() => { setPos(null); it.onSelect(); }}
            >
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

export const ControlSearch: React.FC<{
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [open, setOpen] = useState(value.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  if (!open) {
    return (
      <button
        className="tool-ctl tool-ctl-search-btn"
        title="Search"
        onClick={() => setOpen(true)}
      >
        <LuSearch aria-hidden />
      </button>
    );
  }
  return (
    <span className="tool-ctl-search-field">
      <LuSearch className="tool-ctl-search-glass" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder ?? 'Search...'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); setOpen(false); } }}
      />
      <button
        className="tool-ctl-search-close"
        title="Close search"
        onClick={() => { onChange(''); setOpen(false); }}
      >
        <LuX aria-hidden />
      </button>
    </span>
  );
};
