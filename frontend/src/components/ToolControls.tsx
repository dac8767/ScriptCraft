/**
 * v4.27, Derek's window template: the row-2 control cluster every tool window
 * shares — quiet Airtable-style text controls, in the fixed order
 * View / Filter / Sort / Search (v5.80, Derek: "for all windows, put the
 * header buttons in this order (if they're present in that window)").
 * Tools compose these primitives in their TOOL_CHROME entry (ToolDock);
 * nothing here is tool-specific.
 *
 * The order is a RULE, and a rule nobody can check is a rule that drifts —
 * it already had, two windows deep. So every control stamps itself with the
 * slot it fills (`data-ctl`), and ToolControls.order.test.tsx renders each
 * window's real cluster and asserts the stamps come out in this sequence.
 * A new control that skips the stamp is invisible to the guard, so the
 * hand-rolled ones (Scenes/Navigator/Annotations' Filter) carry it too.
 *
 * - ControlDropdown: text trigger (optional icon / count chip / current-value
 *   label) opening a portalled menu — fixed position, measured from the
 *   trigger, top/left only (the WebKit bottom-anchor footgun).
 * - ControlSearch: a magnifier that expands into an inline field, pushing the
 *   sibling controls left; ✕ or Escape collapses it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopup } from '../hooks/usePopup';
import { LuSearch } from 'react-icons/lu';
import { FaCaretDown, FaChevronUp, FaChevronDown } from 'react-icons/fa';

/** v5.50, Derek: THE "… per row:" stepper — one framed Up/Down arrow pair
 *  with a typeable number field beside it (the v5.49 Pages format). Every
 *  per-row control renders THIS; the caller's store setter clamps. */
export function PerRowStepper({ value, min, max, onChange, labelledBy, moreTitle, fewerTitle }: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  labelledBy: string;
  /** tooltip for the UP arrow (more per row) */
  moreTitle: string;
  /** tooltip for the DOWN arrow (fewer per row) */
  fewerTitle: string;
}) {
  // raw text while editing; blur snaps back to the clamped store value
  const [text, setText] = useState<string | null>(null);
  return (
    <>
      <span className="fs-updown">
        <button
          className="fs-updown-btn"
          title={moreTitle}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        ><FaChevronUp /></button>
        <button
          className="fs-updown-btn"
          title={fewerTitle}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        ><FaChevronDown /></button>
      </span>
      <input
        className="tool-action-field fs-perrow-input"
        type="text"
        inputMode="numeric"
        aria-labelledby={labelledBy}
        value={text ?? String(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9]/g, '');
          setText(t);
          const n = parseInt(t, 10);
          if (Number.isFinite(n) && n >= 1) onChange(n);
        }}
        onBlur={() => setText(null)}
      />
    </>
  );
}

/** The canonical left-to-right order of the shared header controls. */
export const CHROME_CONTROL_ORDER = ['view', 'filter', 'sort', 'search'] as const;
export type ChromeControlSlot = typeof CHROME_CONTROL_ORDER[number];

/** Which slot a control fills, read from the name it already shows/announces
 *  — no second list to keep in step with the first. */
export function chromeSlotOf(name?: string): ChromeControlSlot | undefined {
  const n = (name ?? '').trim().toLowerCase();
  return (CHROME_CONTROL_ORDER as readonly string[]).includes(n) ? (n as ChromeControlSlot) : undefined;
}

export interface ControlDropdownItem {
  label: string;
  active?: boolean;
  onSelect: () => void;
  /** v4.32: multi-toggle menus (Navigator's Filter) stay open on select —
   *  the item re-renders with its new active state instead of closing. */
  keepOpen?: boolean;
  /** v6.49 (the Outline's color filter): a small color dot before the label. */
  swatch?: string;
}

/** One tab of a window's row-2 strip (TOOL_CHROME.useTabs). */
export interface ToolChromeTab {
  label: string;
  active: boolean;
  onSelect: () => void;
  /** v6.48: stable identity for dynamic (user-created) tabs whose labels can
   *  collide — falls back to the label when absent. */
  key?: string;
  /** v4.32: attention dot on the tab (e.g. Tags' Manage tab while a selection
   *  is waiting to be tagged). Strip mode only — the collapsed dropdown drops
   *  it (opening the menu is the same gesture the dot invites). */
  badge?: boolean;
  /** v6.48 (Outline's variation tabs): double-click renames the tab in place.
   *  Strip mode only, like badge — the collapsed dropdown just switches. */
  onRename?: (name: string) => void;
  /** v6.48: a small × on the tab. Strip mode only. */
  onClose?: () => void;
  closeTitle?: string;
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
  /** v5.71, Derek: a trailing ▾ so a control that IS a menu says so — set on
   *  the collapsed header-tabs dropdown ("if the tabs are shrunk down to a
   *  drop down… add a caret so it is obvious"). */
  caret?: boolean;
  items: ControlDropdownItem[];
}> = ({ label, current, icon, chip, title, caret, items }) => {
  /* v5.95: the dismissal rules moved to hooks/usePopup — the comments that
     were here (capture phase, the scroll grace window) live with them now,
     and 19 other popups get the same behaviour instead of their own. */
  const { pos, toggle: togglePopup, close, triggerRef, popupRef } = usePopup({ width: 200 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePopup(btnRef.current);
  };
  return (
    <>
      <button
        ref={(el) => { btnRef.current = el; triggerRef.current = el; }}
        className={`tool-ctl${pos ? ' open' : ''}`}
        data-ctl={chromeSlotOf(label ?? title)}
        title={title ?? label}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {icon && <span className="tool-ctl-icon">{icon}</span>}
        {label && <span className="tool-ctl-label">{label}</span>}
        {current && <span className="tool-ctl-current">{current}</span>}
        {caret && <span className="tool-ctl-caret" aria-hidden><FaCaretDown /></span>}
        {chip !== undefined && chip > 0 && <span className="tool-ctl-chip">{chip}</span>}
      </button>
      {pos && createPortal(
        <div
          ref={(el) => { popupRef.current = el; }}
          className="tool-ctl-menu"
          style={{ top: pos.top, left: pos.left }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.label}
              className={`tool-ctl-menu-item${it.active ? ' active' : ''}`}
              onClick={() => { if (!it.keepOpen) close(); it.onSelect(); }}
            >
              {it.swatch && <span className="tool-ctl-swatch" style={{ background: it.swatch }} />}
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

/** The tab strip. v4.39, Derek: the single-row header WRAPS when the window
 *  is narrow (excess items flow to a second line), so the old collapse-to-
 *  dropdown mode and the ChromeRow2 measurement machinery are gone.
 *  v5.22, Derek: a chrome entry may pass `onReorder` — then the tabs are
 *  DRAGGABLE and dropping one on another reorders the strip (Sticky Notes
 *  persists its order; Characters passes nothing and stays fixed).
 *  dataTransfer.setData is NOT optional — WebKit refuses to start the drag
 *  without it (the house footgun). */
export const ChromeTabs: React.FC<{ tabs: ToolChromeTab[]; onReorder?: (from: number, to: number) => void }> = ({ tabs, onReorder }) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // v6.48: index of the tab being renamed in place (double-click, when the
  // tab carries onRename). Keyed by index — a rename can change the label.
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  return (
    <>
      {tabs.map((t, i) => (
        renameIdx === i && t.onRename ? (
          <input
            key={t.key ?? t.label}
            autoFocus
            className="tool-chrome-tab-rename"
            defaultValue={t.label}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => { t.onRename!(e.target.value); setRenameIdx(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenameIdx(null);
            }}
          />
        ) : (
        <button
          key={t.key ?? t.label}
          className={`tool-chrome-tab${t.active ? ' active' : ''}`}
          onClick={t.onSelect}
          onDoubleClick={t.onRename ? () => setRenameIdx(i) : undefined}
          title={t.onRename ? 'Double-click to rename' : undefined}
          draggable={!!onReorder}
          onDragStart={onReorder ? (e) => {
            e.dataTransfer.setData('text/plain', t.label);   // required by WebKit
            e.dataTransfer.effectAllowed = 'move';
            setDragIdx(i);
          } : undefined}
          onDragEnd={onReorder ? () => setDragIdx(null) : undefined}
          onDragOver={onReorder ? (e) => { if (dragIdx !== null && dragIdx !== i) e.preventDefault(); } : undefined}
          onDrop={onReorder ? (e) => {
            e.preventDefault();
            if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i);
            setDragIdx(null);
          } : undefined}
        >
          {t.label}
          {t.badge && <span className="tool-chrome-tab-dot" />}
          {/* a span, not a button — buttons can't nest */}
          {t.onClose && (
            <span
              role="button"
              className="tool-chrome-tab-x"
              title={t.closeTitle ?? 'Close'}
              onClick={(e) => { e.stopPropagation(); t.onClose!(); }}
            >×</span>
          )}
        </button>
        )
      ))}
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
        data-ctl="search"
        title="Search"
        onClick={() => setOpen(true)}
      >
        <LuSearch aria-hidden />
      </button>
    );
  }
  return (
    <span className="tool-ctl-search-field" data-ctl="search">
      <LuSearch className="tool-ctl-search-glass" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder ?? 'Search...'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); setOpen(false); } }}
        // v4.28 batch-v6 #2, Derek: clicking away from an EMPTY search folds it
        // back to the magnifier; with text in it, it stays (the ✕ clears).
        onBlur={() => { if (!value) setOpen(false); }}
      />
      <button
        className="tool-ctl-search-close"
        title="Close search"
        onClick={() => { onChange(''); setOpen(false); }}
      >
        ×
      </button>
    </span>
  );
};

/**
 * v5.01, Derek: "for tool specific buttons, like Reorder in the scene tool,
 * move it down into the first row of the body, aligned left. give it a button
 * shape and background color."
 *
 * The window HEADER carries the controls every tool shares — Filter, Sort,
 * View, Search — as small text affordances. A tool's OWN actions read as
 * something else and belong to its body: this is the first row of it,
 * left-aligned, its buttons shaped and filled so they read as buttons rather
 * than as more header text.
 *
 * One row component, so a second tool adopting it can't invent its own
 * spacing. Renders nothing when it has no children — a tool with no
 * actions must not gain an empty strip.
 */
export const ToolActionRow: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const has = React.Children.toArray(children).some(Boolean);
  if (!has) return null;
  return <div className="tool-action-row">{children}</div>;
};
