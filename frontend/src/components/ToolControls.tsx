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
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuSearch } from 'react-icons/lu';

export interface ControlDropdownItem {
  label: string;
  active?: boolean;
  onSelect: () => void;
  /** v4.32: multi-toggle menus (Navigator's Filter) stay open on select —
   *  the item re-renders with its new active state instead of closing. */
  keepOpen?: boolean;
}

/** One tab of a window's row-2 strip (TOOL_CHROME.useTabs). */
export interface ToolChromeTab {
  label: string;
  active: boolean;
  onSelect: () => void;
  /** v4.32: attention dot on the tab (e.g. Tags' Manage tab while a selection
   *  is waiting to be tagged). Strip mode only — the collapsed dropdown drops
   *  it (opening the menu is the same gesture the dot invites). */
  badge?: boolean;
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
      </button>
      {pos && createPortal(
        <div className="tool-ctl-menu" style={{ top: pos.top, left: pos.left }} onPointerDown={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button
              key={it.label}
              className={`tool-ctl-menu-item${it.active ? ' active' : ''}`}
              onClick={() => { if (!it.keepOpen) setPos(null); it.onSelect(); }}
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

/** The tab strip — file tabs, or (collapsed) one dropdown showing the active
 *  tab. ChromeRow2 decides which; the fullscreen/overlay headers render the
 *  strip directly. */
export const ChromeTabs: React.FC<{ tabs: ToolChromeTab[]; collapsed?: boolean }> = ({ tabs, collapsed }) => {
  if (collapsed) {
    const active = tabs.find((t) => t.active) ?? tabs[0];
    return (
      <ControlDropdown
        title="Section"
        current={active?.label}
        items={tabs.map((t) => ({ label: t.label, active: t.active, onSelect: t.onSelect }))}
      />
    );
  }
  return (
    <>
      {tabs.map((t) => (
        <button
          key={t.label}
          className={`tool-chrome-tab${t.active ? ' active' : ''}`}
          onClick={t.onSelect}
        >
          {t.label}
          {t.badge && <span className="tool-chrome-tab-dot" />}
        </button>
      ))}
    </>
  );
};

/** v4.28 batch-v6 #4, Derek: a tabbed row 2 NEVER wraps. When the full strip
 *  doesn't fit beside the controls, the tabs collapse into a dropdown; if
 *  even that overflows, the row scrolls horizontally (CSS overflow-x). A
 *  hidden fixed-position copy of the strip supplies its natural width and the
 *  controls' natural width comes from an inner span — so the visible row's
 *  own flexing never feeds back into the decision (no flip-flopping). */
export const ChromeRow2: React.FC<{
  tabs: ToolChromeTab[];
  /** The host row's base classes ('tool-chrome-row2' or 'tool-inline-header'). */
  className: string;
  /** Pop-out button when the dock hosts the row (right panel = before). */
  before?: React.ReactNode;
  after?: React.ReactNode;
  /** The Filter/Sort/View/Search cluster content. */
  children?: React.ReactNode;
}> = ({ tabs, className, before, after, children }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const ctlRef = useRef<HTMLSpanElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const decide = () => {
      if (!row.clientWidth) return;            // unmeasurable (jsdom / hidden)
      const stripW = measureRef.current?.offsetWidth ?? 0;
      const ctlW = ctlRef.current?.offsetWidth ?? 0;
      const cs = getComputedStyle(row);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const gap = parseFloat(cs.columnGap || cs.gap) || 0;
      let fixed = pad + gap;                   // strip↔controls gap
      row.querySelectorAll(':scope > .tool-dock-popout, :scope > .char-profiles-fullscreen-btn').forEach((el) => {
        fixed += (el as HTMLElement).offsetWidth + gap;
      });
      setCollapsed(stripW + ctlW + fixed + 4 > row.clientWidth);
    };
    decide();
    if (typeof ResizeObserver === 'undefined') return;   // jsdom
    const ro = new ResizeObserver(decide);
    ro.observe(row);
    if (measureRef.current) ro.observe(measureRef.current);
    if (ctlRef.current) ro.observe(ctlRef.current);
    return () => ro.disconnect();
  }, [tabs.length]);
  return (
    <div ref={rowRef} className={`${className} tool-chrome-row2-tabbed`}>
      {before}
      <span className={`tool-chrome-tabs${collapsed ? ' tool-chrome-tabs-dd' : ''}`}>
        <ChromeTabs tabs={tabs} collapsed={collapsed} />
      </span>
      {/* natural-width measurer — never visible, never interactive */}
      <span className="tool-chrome-tabs tool-chrome-tabs-measure" ref={measureRef} aria-hidden>
        <ChromeTabs tabs={tabs} />
      </span>
      <span className="tool-chrome-controls">
        <span className="tool-chrome-controls-inner" ref={ctlRef}>{children}</span>
      </span>
      {after}
    </div>
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
