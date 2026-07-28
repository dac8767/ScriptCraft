/**
 * DesignPanel (v4.8) — a floating, draggable, resizable control surface that
 * exposes every registered design token as a live slider. Adjusting one writes
 * to the store (`setDesignVar`), an effect mirrors the store onto :root, and the
 * running app restyles in real time — no reload, no per-tweak note.
 *
 * It portals to <body> and is `position: fixed` so it floats over the whole app
 * (including portaled dialogs) and you can watch the thing you're tuning change
 * behind it. "Copy CSS" dumps the current overrides as a :root block so a chosen
 * look can be baked into the stylesheet permanently.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuRotateCcw, LuSearch } from 'react-icons/lu';
import { FaCopy, FaCheck, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import { useEditorStore } from '../stores/editorStore';
import { DESIGN_GROUPS, buildOverrideCss, type DesignToken } from '../design/designTokens';

// Round to the token's step so the number input doesn't show float noise.
function snap(val: number, step: number): number {
  const inv = 1 / step;
  return Math.round(val * inv) / inv;
}

function TokenRow({ t }: { t: DesignToken }) {
  const isStore = !!t.store;
  /* v5.13, Derek: "i was trying to type 650 … but it immediately changes to
     300." The number field committed (and CLAMPED) on every keystroke, so a
     leading "6" was clamped to the 300 minimum before the "5" could land —
     unnoticed until scenesTableMin became the first token with a min bigger
     than a single digit. While focused, the field holds an unclamped DRAFT
     string; clamp-and-commit happen on blur/Enter, Escape abandons the
     draft. The slider keeps instant commit — dragging can't leave range. */
  const [draft, setDraft] = useState<string | null>(null);
  const draftCancelled = useRef(false);
  // css-var tokens read their override map; store-bound tokens read the store
  // field live (so external changes — e.g. the drag handle — reflect here too).
  const cssOverride = useEditorStore((s) => (isStore ? undefined : s.designVars[t.id]));
  const storeVal = useEditorStore((s) => (t.store ? t.store.get(s) : 0));
  const setDesignVar = useEditorStore((s) => s.setDesignVar);
  const resetDesignVar = useEditorStore((s) => s.resetDesignVar);
  const value = isStore ? storeVal : (cssOverride ?? t.def);
  const isOverridden = isStore ? storeVal !== t.def : cssOverride !== undefined && cssOverride !== t.def;

  const commit = (raw: number) => {
    if (Number.isNaN(raw)) return;
    const clamped = Math.min(t.max, Math.max(t.min, snap(raw, t.step)));
    if (t.store) t.store.set(clamped); else setDesignVar(t.id, clamped);
  };
  const reset = () => { if (t.store) t.store.set(t.def); else resetDesignVar(t.id); };

  return (
    <div className={`dz-row${isOverridden ? ' dz-row-on' : ''}`}>
      <div className="dz-row-top">
        <span className="dz-row-label" title={t.label}>{t.label}</span>
        <div className="dz-row-num">
          {!t.choices && (
            <>
              <input
                type="number"
                className="dz-num"
                value={draft ?? value}
                min={t.min}
                max={t.max}
                step={t.step}
                onFocus={() => setDraft(String(value))}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  else if (e.key === 'Escape') { draftCancelled.current = true; e.currentTarget.blur(); }
                }}
                onBlur={(e) => {
                  // Read the DOM value, not the draft state — an Escape-blur
                  // fires this handler inside the OLD closure.
                  if (!draftCancelled.current && draft !== null) commit(parseFloat(e.currentTarget.value));
                  draftCancelled.current = false;
                  setDraft(null);
                }}
              />
              {t.unit && <span className="dz-unit">{t.unit}</span>}
            </>
          )}
          <button
            className="dz-reset"
            title={isOverridden ? 'Reset to default' : 'Default'}
            disabled={!isOverridden}
            onClick={reset}
          ><LuRotateCcw /></button>
        </div>
      </div>
      {t.choices ? (
        /* v4.71: enumerated token — a segmented row, not a slider */
        <div className="dz-choices">
          {t.choices.map((c) => (
            <button
              key={c.value}
              className={`dz-choice${value === c.value ? ' on' : ''}`}
              onClick={() => commit(c.value)}
            >{c.label}</button>
          ))}
        </div>
      ) : (
        <input
          type="range"
          className="dz-range"
          value={value}
          min={t.min}
          max={t.max}
          step={t.step}
          onChange={(e) => commit(parseFloat(e.target.value))}
        />
      )}
      {t.hint && <div className="dz-hint">{t.hint}</div>}
    </div>
  );
}

/**
 * The scrollable guts of the Design surface — search, the grouped token rows,
 * and the Reset/Copy footer. Shared verbatim by the floating window (below) and
 * the dockable side-panel tool (ToolDock 'design'), so the two entry points can
 * never drift apart. It carries no chrome and no positioning of its own — the
 * host provides that.
 */
export function DesignPanelBody() {
  const designVars = useEditorStore((s) => s.designVars);
  const resetAllDesign = useEditorStore((s) => s.resetAllDesign);
  const [query, setQuery] = useState('');
  // v4.32 batch-v8 #4, Derek: sections start COLLAPSED and the state is
  // remembered across close/reopen (store-persisted; null = untouched, which
  // now means every group folded rather than every group open).
  const collapsedIds = useEditorStore((s) => s.designCollapsedGroups);
  const setCollapsedIds = useEditorStore((s) => s.setDesignCollapsedGroups);
  const collapsed = useMemo(
    () => new Set(collapsedIds ?? DESIGN_GROUPS.map((g) => g.id)),
    [collapsedIds],
  );
  const [copied, setCopied] = useState(false);

  const q = query.trim().toLowerCase();
  const groups = DESIGN_GROUPS
    .map((g) => ({
      ...g,
      tokens: q ? g.tokens.filter((t) => t.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)) : g.tokens,
    }))
    .filter((g) => g.tokens.length > 0);

  const overrideCount = Object.keys(designVars).filter((k) => designVars[k] !== undefined).length;

  const copyCss = async () => {
    const css = buildOverrideCss(designVars);
    if (!css) return;
    try {
      await navigator.clipboard.writeText(css);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = css; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* no-op */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const toggleGroup = (id: string) => {
    const next = new Set<string>(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsedIds([...next]);
  };

  return (
    <>
      <div className="dz-search">
        <LuSearch className="dz-search-icon" />
        <input
          className="dz-search-input"
          placeholder="Search settings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="dz-note">A setting only shows an effect while the thing it styles is on screen — open that panel, window, or dialog to watch it change.</div>

      <div className="dz-body">
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.id) && !q;
          return (
            <div className="dz-group" key={g.id}>
              <button className="dz-group-head" onClick={() => toggleGroup(g.id)}>
                {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                <span>{g.label}</span>
              </button>
              {!isCollapsed && g.tokens.map((t) => <TokenRow key={t.id} t={t} />)}
            </div>
          );
        })}
        {groups.length === 0 && <div className="dz-empty">No settings match “{query}”.</div>}
      </div>

      <div className="dz-footer">
        <button className="dz-foot-btn" onClick={resetAllDesign} disabled={overrideCount === 0}>
          <LuRotateCcw /> Reset all
        </button>
        <button className="dz-foot-btn" onClick={copyCss} disabled={overrideCount === 0}>
          {copied ? <><FaCheck /> Copied</> : <><FaCopy /> Copy CSS</>}
        </button>
      </div>
    </>
  );
}

/** The dockable side-panel form of the Design surface (ToolDock 'design'). */
export function DesignPanelDocked() {
  return <div className="dz-embedded"><DesignPanelBody /></div>;
}

export default function DesignPanel() {
  const open = useEditorStore((s) => s.designPanelOpen);
  const setOpen = useEditorStore((s) => s.setDesignPanelOpen);
  const designVars = useEditorStore((s) => s.designVars);

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -1, y: 64 });
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 340, h: 560 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // First open: anchor to the top-right so the editor stays visible on the left.
  useEffect(() => {
    if (open && pos.x < 0) {
      setPos({ x: Math.max(8, window.innerWidth - size.w - 24), y: 64 });
    }
  }, [open, pos.x, size.w]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) {
        setPos({
          x: Math.min(window.innerWidth - 80, Math.max(0, e.clientX - drag.current.dx)),
          y: Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.current.dy)),
        });
      } else if (resize.current) {
        setSize({
          w: Math.max(280, resize.current.w + (e.clientX - resize.current.x)),
          h: Math.max(240, resize.current.h + (e.clientY - resize.current.y)),
        });
      }
    };
    const up = () => { drag.current = null; resize.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  if (!open) return null;

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  };

  const overrideCount = Object.keys(designVars).filter((k) => designVars[k] !== undefined).length;

  return createPortal(
    <div className="dz-panel" style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}>
      <div className="dz-header" onPointerDown={startDrag}>
        <span className="dz-title">Design</span>
        {overrideCount > 0 && <span className="dz-count">{overrideCount} changed</span>}
        <button className="dz-close" title="Close" onClick={() => setOpen(false)}>&times;</button>
      </div>

      <DesignPanelBody />

      <div className="dz-resize" onPointerDown={startResize} title="Resize" />
    </div>,
    document.body,
  );
}
