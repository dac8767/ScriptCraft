import React from 'react';
import AddMenu from './AddMenu';
import { MENU_ICONS, TOOLBAR_ICONS } from './uiIcons';
/**
 * CustomizePanelsDialog — View → Customize Layout.
 *
 * Panels: each tool can live in the Left panel, the Right panel, or be Hidden.
 * (Defaults: script-structure tools left; notes/analytics/goals right.)
 * Hidden tools stay reachable from the Tools menu, opening as a temporary
 * window.
 *
 * Toolbar: a single flat list of items (v0.42) — every built-in control,
 * pinned tool/window, pinned command, and divider is individually placeable
 * with Left / Right / Hide. The old fixed groups and per-item deactivation
 * checkboxes (a FreeDraft v5.5 holdover) are gone; hidden items are re-added
 * from the Add dropdown. Item registry: toolbarBuiltins.ts.
 */
import { MENU_BAR_LABELS, useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolConfig, DEFAULT_TOOL_ORDER } from '../stores/editorStore';
import { ALL_TOOLS, WINDOW_IDS } from './ToolDock';
import { TOOLBAR_COMMANDS } from './toolbarCommands';
import { TOOLBAR_BUILTINS, BUILTIN_BY_KEY, DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT } from './toolbarBuiltins';
import { CHROME_SCALES, chromeMin, chromeMax, chromePx, type ChromeSurface } from './chromeSizes';
import EditElementsDialog from './EditElementsDialog';
import KeyboardShortcutsTab from './KeyboardShortcutsTab';
import ThemesTab from './ThemesTab';
import ContextMenuTab from './ContextMenuTab';

interface Props {
  /** Initial tab; the dialog always renders its own tab bar. */
  category?: 'menu' | 'toolbar' | 'panels' | 'elements' | 'keys' | 'themes' | 'context';
  open: boolean;
  onClose: () => void;
  /** Render only the content (no overlay/box) — used inside Preferences. */
  embedded?: boolean;
}

/** Size slider shown when a surface is in Custom mode (v0.72).
 *  Runs from half of Compact to double of Comfortable.
 *
 *  MUST live at module scope: when this was declared inside
 *  CustomizePanelsDialog, every parent render produced a new component type,
 *  so React unmounted and remounted the <input> on each change. A click still
 *  worked (single event), but dragging died the moment the first onChange
 *  fired — the element under the pointer was destroyed mid-gesture (v0.75 fix).
 */
function ChromeSlider({
  surface, value, onChange,
}: {
  surface: ChromeSurface;
  value: number;
  onChange: (px: number) => void;
}) {
  return (
    <div className="fs-chrome-slider-row">
      <input
        type="range"
        min={chromeMin(surface)}
        max={chromeMax(surface)}
        step={1}
        value={value}
        aria-label={`Custom ${CHROME_SCALES[surface].axis}`}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
      <span className="fs-chrome-slider-val">{value}px</span>
    </div>
  );
}

/** Default spacer sizes — match the CSS so an unsized spacer doesn't jump when
 *  the slider is first touched. */
/** Title Case for every user-visible label (v0.84). Small words stay lowercase
 *  unless they lead — standard title case, not naive capitalization. */
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in',
  'of', 'on', 'or', 'the', 'to', 'up', 'via', 'with']);
export function titleCase(s: string): string {
  return s.split(/(\s+|\/)/).map((w, i) => {
    if (/^\s+$/.test(w) || w === '/') return w;
    const lower = w.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lower)) return lower;
    // Leave words that are already deliberately cased (To-Do, PDF, FDX).
    if (/[A-Z]/.test(w.slice(1))) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('');
}

const CUSTOMIZE_SIZE_KEY = 'opendraft:customizeSize';

const DEFAULT_TOOLBAR_SPACER = 50;   // v0.86
const DEFAULT_PANEL_SPACER = 50;   // v0.86

/**
 * v0.86: was a slider, which couldn't be dragged — the whole ROW is draggable
 * (HTML5 drag-and-drop, for reordering), and that swallows the pointer before
 * the slider ever sees it. A number field has no drag gesture to steal, so it
 * just works. Declared at module scope (a component defined inside another
 * remounts on every render).
 */
function SpacerSize({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (px: number) => void;
}) {
  // v0.95: the minimum was enforced on EVERY keystroke, so typing "10" clamped
  // the "1" to 8 the instant it was typed and you could never get below 80. The
  // field now holds what you type as text and only commits — and clamps — when
  // you're done: Enter, or clicking away. Escape puts it back.
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(value);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (!Number.isFinite(n) || draft.trim() === '') return;      // junk: keep the old size
    onChange(Math.max(min, Math.min(max, Math.round(n))));
  };

  return (
    <span
      className="fs-spacer-size"
      // Typing inside a draggable row: stop the row's drag from stealing the
      // caret while the field has focus.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="fs-spacer-label">Size:</label>
      <input
        type="number"
        className="fs-spacer-input"
        min={min}
        max={max}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
        }}
        title={`Spacer size in pixels (${min}–${max})`}
      />
      <span className="fs-spacer-px">px</span>
    </span>
  );
}


export default function CustomizePanelsDialog({ open, onClose, embedded = false, category }: Props) {
  const {
    toolConfig, setToolConfig,
    toolbarPinnedTools,
    menuBarOrder, setMenuBarOrder,
    menuBarHidden, setMenuBarHidden,
    navigatorOpen, toggleNavigator, shelfOpen, toggleShelf,
    toolOrder, setToolOrder,
    toolbarMode, setToolbarMode,
    panelSizeMode, setPanelSizeMode,
    chromeCustomPx, setChromeCustomPx,
    menuMode, setMenuMode,
  } = useEditorStore();


  const PANEL_PRODUCTION_IDS: ToolId[] = ['tags'];
  // One combined Panels tab (v0.48): every panel item in one list — the
  // Left / Right buttons on each row already choose the side, so separate
  // Left Panel and Right Panel tabs were redundant.
  const renderPanelsTab = () => {
    const order = toolOrder.length ? toolOrder : [...DEFAULT_TOOL_ORDER];
    const oIdx = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? 1000 : i;
    };
    type Row =
      | { kind: 'tool'; id: ToolId; label: string; side: 'left' | 'right' }
      | { kind: 'divider'; id: string; label: string; side: 'left' | 'right'; spacer?: boolean; size?: number };
    const rows: Row[] = [
      ...ALL_TOOLS.filter((t) => cfgOf(t.id).enabled).map((t) => ({
        kind: 'tool' as const, id: t.id, label: t.label, side: cfgOf(t.id).side, ord: oIdx(t.id),
      })),
      ...panelDividers.map((d) => ({
        kind: 'divider' as const, id: d.id, label: d.label, side: d.side, spacer: d.spacer, size: d.size, ord: oIdx(`div:${d.id}`),
      })),
    ].sort((a, b) => a.ord - b.ord).map(({ ord: _o, ...r }) => r as Row);

    const orderTokenOf = (r: Row) => r.kind === 'tool' ? r.id : `div:${r.id}`;

    // v0.65: rows are grouped by side — all Left items, a separator, then all
    // Right items. Because the grouping is a STABLE partition of the flat
    // toolOrder, "last in toolOrder" is also "last within its side's group",
    // which is what lets a side switch land at the bottom of the target list.
    const leftRows = rows.filter((r) => r.side === 'left');
    const rightRows = rows.filter((r) => r.side === 'right');

    /** Full token order, materialized (toolOrder may be empty = defaults). */
    const fullOrder = () => {
      const toks = rows.map(orderTokenOf);
      const full = [...order];
      for (const t of toks) if (!full.includes(t)) full.push(t);
      return full;
    };

    /** Reorder within ONE side; the other side is untouched. */
    /**
     * Drop a panel row: reorder within a side, or move it to the OTHER side at
     * the exact position it was dropped — its side switches to match, because
     * the side is just which list it sits in. Dividers and spacers move too.
     */
    const dropRow = (
      srcSide: 'left' | 'right', srcIdx: number,
      dstSide: 'left' | 'right', dstIdx: number,
    ) => {
      const row = (srcSide === 'left' ? leftRows : rightRows)[srcIdx];
      if (!row) return;
      const tok = orderTokenOf(row);

      let left = leftRows.map(orderTokenOf).filter((t) => t !== tok);
      let right = rightRows.map(orderTokenOf).filter((t) => t !== tok);
      const dst = dstSide === 'left' ? left : right;
      dst.splice(Math.min(dstIdx, dst.length), 0, tok);
      if (dstSide === 'left') left = dst; else right = dst;
      setToolOrder([...left, ...right]);

      if (srcSide !== dstSide) {
        if (row.kind === 'tool') setTool(row.id as ToolId, { side: dstSide });
        else setPanelDividers(panelDividers.map((d) => (d.id === row.id ? { ...d, side: dstSide } : d)));
      }
    };

    const setRowSide = (r: Row, target: 'left' | 'right' | 'hidden') => {
      if (r.kind === 'divider') {
        if (target === 'hidden') {
          setPanelDividers(panelDividers.filter((x) => x.id !== r.id));
          setToolOrder(order.filter((t) => t !== `div:${r.id}`));
        } else {
          const changed = r.side !== target;
          setPanelDividers(panelDividers.map((x) => x.id === r.id ? { ...x, side: target } : x));
          if (changed) sendToBottom(`div:${r.id}`);
        }
        return;
      }
      if (target === 'hidden') { setTool(r.id, { enabled: false }); return; }
      if (cfgOf(r.id).side === target && cfgOf(r.id).enabled) return;   // no-op
      setTool(r.id, { enabled: true, side: target });
      sendToBottom(r.id);
    };

    /** Move a token to the end of the flat order = bottom of its side's group. */
    const sendToBottom = (token: string) => {
      const full = fullOrder().filter((t) => t !== token);
      setToolOrder([...full, token]);
    };
    /** Default side for a tool coming back from hidden. */
    const homeSide = (id: ToolId): 'left' | 'right' =>
      DEFAULT_TOOL_CONFIG[id]?.side ?? (WINDOW_IDS.includes(id) ? 'left' : 'right');
    const addOptions = [
      ...ALL_TOOLS.filter((t) => WINDOW_IDS.includes(t.id) && !cfgOf(t.id).enabled).map((t) => ({ group: 'Project Windows', value: `t:${t.id}`, label: t.label })),
      ...ALL_TOOLS.filter((t) => !WINDOW_IDS.includes(t.id) && !PANEL_PRODUCTION_IDS.includes(t.id) && !cfgOf(t.id).enabled).map((t) => ({ group: 'Tools', value: `t:${t.id}`, label: t.label })),
      ...ALL_TOOLS.filter((t) => PANEL_PRODUCTION_IDS.includes(t.id) && !cfgOf(t.id).enabled).map((t) => ({ group: 'Production', value: `t:${t.id}`, label: t.label })),
    ];
    const onAdd = (value: string) => {
      if (value === 'divider' || value === 'spacer') {
        // Spacers share the dividers list — a divider with spacer: true (v0.69).
        const id = String(Date.now());
        setPanelDividers([
          ...panelDividers,
          { id, label: '', side: 'left', ...(value === 'spacer' ? { spacer: true } : {}) },
        ]);
        setToolOrder([...order, `div:${id}`]);
      } else if (value.startsWith('all:')) {
        const group = value.slice(4);
        const next = { ...toolConfig };
        addOptions
          .filter((o) => o.group === group && o.value.startsWith('t:'))
          .forEach((o) => {
            const id = o.value.slice(2) as ToolId;
            next[id] = { ...cfgOf(id), enabled: true, side: homeSide(id) };
          });
        setToolConfig(next);
      } else if (value.startsWith('t:')) {
        const id = value.slice(2) as ToolId;
        setTool(id, { enabled: true, side: homeSide(id) });
      }
    };
    const resetPanels = () => {
      // Restore the canonical default layout (DEFAULT_TOOL_CONFIG /
      // DEFAULT_TOOL_ORDER) rather than re-deriving one here — a second,
      // divergent definition of "default" is how the v0.63 mismatch happened.
      const next: Record<string, ToolConfig> = {};
      ALL_TOOLS.forEach((t) => {
        next[t.id] = { ...(DEFAULT_TOOL_CONFIG[t.id] ?? { side: 'right', enabled: true }) };
      });
      setToolConfig(next);
      setPanelDividers([]);
      setToolOrder([...DEFAULT_TOOL_ORDER]);
    };
    const removeAll = () => {
      const next = { ...toolConfig };
      ALL_TOOLS.forEach((t) => {
        const c = cfgOf(t.id);
        if (c.enabled) next[t.id] = { ...c, enabled: false };
      });
      setToolConfig(next);
      const divTokens = panelDividers.map((d) => `div:${d.id}`);
      setPanelDividers([]);
      if (divTokens.length) setToolOrder(order.filter((t) => !divTokens.includes(t)));
    };
    return (
      <section>
        <h3>Panel Items</h3>
        <p className="fs-customize-hint">
          Left items first, then Right. Left/Right moves an item to the bottom of
          that panel's list; Hide removes it (re-add it from the dropdown below).
          Drag to reorder within a panel. Divider labels are edited here only.
        </p>
        {(['left', 'right'] as const).map((side) => {
          const sideRows = side === 'left' ? leftRows : rightRows;
          return (
            <React.Fragment key={side}>
              {side === 'right' && leftRows.length > 0 && rightRows.length > 0 && (
                <div className="fs-customize-side-sep" />
              )}
              {sideRows.map((r, idx) => (
                <div
                  key={`${r.kind}-${r.id}`}
                  className={`fs-customize-row${dragClass(`panels-${side}`, idx)}`}
                  {...zoneDragProps('panels', side, idx, dropRow)}
                >
                  <span className="fs-customize-tool">
                    <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                    {iconSlot(r.kind === 'tool'
                      ? (ALL_TOOLS.find((t) => t.id === r.id)?.icon ?? null)
                      : null)}
                    {r.kind === 'divider' && r.spacer ? (
                      <>
                        <span className="fs-spacer-row-label">— Spacer —</span>
                        <SpacerSize
                          value={r.size ?? DEFAULT_PANEL_SPACER}
                          min={8}
                          max={240}
                          onChange={(px) => setPanelDividers(
                            panelDividers.map((x) => (x.id === r.id ? { ...x, size: px } : x)),
                          )}
                        />
                      </>
                    ) : r.kind === 'divider' ? (
                      <input
                        className="fs-divider-label-input"
                        value={r.label}
                        placeholder="Divider label (optional)"
                        onChange={(e) => setPanelDividers(panelDividers.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))}
                      />
                    ) : r.label}
                  </span>
                  <span className="fs-customize-seg">
                    <button className={r.side === 'left' ? 'active' : ''} onClick={() => setRowSide(r, 'left')}>Left</button>
                    <button className={r.side === 'right' ? 'active' : ''} onClick={() => setRowSide(r, 'right')}>Right</button>
                    <button onClick={() => setRowSide(r, 'hidden')}>Hide</button>
                  </span>
                </div>
              ))}
            </React.Fragment>
          );
        })}
        <div className="fs-tbzone-adders fs-adders-equal">
          <AddMenu
            onPick={onAdd}
            groups={[
              {
                label: 'Show All',
                options: (['Project Windows', 'Tools', 'Production'] as const)
                  .filter((g) => addOptions.some((o) => o.group === g))
                  .map((g) => ({ value: `all:${g}`, label: `Show All - ${titleCase(g)}` })),
              },
              ...(['Project Windows', 'Tools', 'Production'] as const).map((group) => ({
                label: group,
                options: addOptions.filter((o) => o.group === group)
                  .map((o) => ({ value: o.value, label: o.label, icon: tokenIcon(o.value) })),
              })),
              {
                label: 'Utility',
                options: [
                  { value: 'divider', label: 'Add Divider' },
                  { value: 'spacer', label: 'Spacer' },
                ],
              },
            ]}
          />
          <button
            className="swn-add-btn"
            title="Hide everything in both panels (re-add items from the dropdown)"
            onClick={removeAll}
          >Hide All</button>
          <button
            className="swn-add-btn"
            title="Restore the defaults: all Project windows left, all tool and production items right"
            onClick={resetPanels}
          >Reset to Default</button>
        </div>
      </section>
    );
  };

  // ALL hooks must run before this early return — a hook below it crashes
  // React ('Rendered more hooks than during the previous render').
  const { toolbarLeft: tbLeftRaw, toolbarRight: tbRightRaw, setToolbarZones, toolbarZonesSet } = useEditorStore();
  const { panelDividers, setPanelDividers } = useEditorStore();
  const [activeCat, setActiveCat] = React.useState<'menu' | 'toolbar' | 'panels' | 'elements' | 'keys' | 'themes' | 'context'>(category ?? 'menu');

  // v0.84: the window forgot any size you gave it and snapped back to the
  // default on reopen. CSS `resize` writes inline width/height on the element,
  // so a ResizeObserver captures the size the user drags to; we persist it and
  // restore it on open. (Modal only — a docked panel is sized by its dock, and a
  // stored width would fight it.)
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (embedded || !open) return;
    const el = dialogRef.current;
    if (!el) return;

    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMIZE_SIZE_KEY) || 'null');
      if (saved && saved.w > 0 && saved.h > 0) {
        // Never restore a size bigger than the current screen — a window sized
        // on a large monitor would otherwise open off-screen on a laptop.
        el.style.width = `${Math.min(saved.w, window.innerWidth - 40)}px`;
        el.style.height = `${Math.min(saved.h, window.innerHeight - 40)}px`;
      }
    } catch { /* corrupt entry — keep the default */ }

    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {          // a drag fires this continuously
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          try {
            localStorage.setItem(CUSTOMIZE_SIZE_KEY,
              JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }));
          } catch { /* quota */ }
        }
      }, 250);
    });
    ro.observe(el);
    return () => { window.clearTimeout(t); ro.disconnect(); };
  }, [open, embedded]);

  // `category` seeds useState only on first mount, but this dialog stays mounted
  // and merely toggles `open` — so without this, opening it from "Customize
  // Themes" would land on whatever tab was used last.
  React.useEffect(() => {
    if (open && category) setActiveCat(category);
  }, [open, category]);
  // Drag-and-drop reordering (v0.45): one shared source marker; drops are
  // only accepted within the same list.
  const [dragInfo, setDragInfo] = React.useState<{ list: string; idx: number } | null>(null);
  // Warning window shown whenever the View menu (or the whole menu bar)
  // gets hidden — the user must acknowledge where customization lives.
  const dragProps = (list: string, idx: number, moveTo: (from: number, to: number) => void) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragInfo({ list, idx });
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: React.DragEvent) => { if (dragInfo && dragInfo.list === list) e.preventDefault(); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragInfo && dragInfo.list === list && dragInfo.idx !== idx) moveTo(dragInfo.idx, idx);
      setDragInfo(null);
    },
    onDragEnd: () => setDragInfo(null),
  });
  const dragClass = (list: string, idx: number) =>
    dragInfo && dragInfo.list === list && dragInfo.idx === idx ? ' dragging' : '';

  /**
   * v0.95 — drag ACROSS zones. Left and Right are separate lists, and dragProps
   * only accepted a drop when the source and target lists matched, so an item
   * could never be dragged from one side to the other; you had to use the toggle,
   * which dumps it at the bottom.
   *
   * Now a row accepts a drop from either zone of the same GROUP (the toolbar's
   * two zones, or the panels' two sides). Where you drop it decides both the
   * position AND the side — the toggle follows the drag, because the zone the
   * item lands in IS its side. `group` keeps the toolbar and panels apart, so a
   * toolbar item can't be dropped into a panel.
   */
  const zoneDragProps = (
    group: string,
    zone: 'left' | 'right',
    idx: number,
    onDrop: (srcZone: 'left' | 'right', srcIdx: number, dstZone: 'left' | 'right', dstIdx: number) => void,
  ) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragInfo({ list: `${group}-${zone}`, idx });
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragInfo?.list.startsWith(`${group}-`)) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragInfo?.list.startsWith(`${group}-`)) return;
      const srcZone = dragInfo.list.slice(group.length + 1) as 'left' | 'right';
      if (!(srcZone === zone && dragInfo.idx === idx)) {
        onDrop(srcZone, dragInfo.idx, zone, idx);
      }
      setDragInfo(null);
    },
    onDragEnd: () => setDragInfo(null),
  });

  if (!open) return null;

  const cfgOf = (id: ToolId): ToolConfig =>
    toolConfig[id] ?? DEFAULT_TOOL_CONFIG[id] ?? { side: 'right', enabled: true };

  const setTool = (id: ToolId, patch: Partial<ToolConfig>) =>
    setToolConfig({ ...toolConfig, [id]: { ...cfgOf(id), ...patch } });

  const menuIdx = (l: string) => {
    const i = menuBarOrder.indexOf(l);
    return i === -1 ? 100 + MENU_BAR_LABELS.indexOf(l) : i;
  };
  const orderedMenuLabels = [...MENU_BAR_LABELS].sort((a, b) => menuIdx(a) - menuIdx(b));

  /** Menus still ON the bar. Hidden ones leave the list and live in + Add Item. */
  const visibleMenuLabels = orderedMenuLabels.filter((l) => !menuBarHidden.includes(l));

  const tbReady = toolbarZonesSet;
  const tbLeft = tbReady ? tbLeftRaw : [...DEFAULT_TOOLBAR_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)];
  const tbRight = tbReady ? tbRightRaw : DEFAULT_TOOLBAR_RIGHT;

  // ── Add-dropdown categories (v0.44): Toolbar / Production / Tools / Project,
  //    mirroring the menu bar taxonomy. Notes and Production Tags live
  //    under Tools and Production (not Toolbar); c:productionTags is excluded
  //    as a duplicate of the smarter b:tags button. Only absent items listed.
  const tbPlaced = (v: string) => tbLeft.includes(v) || tbRight.includes(v);
  const PRODUCTION_CMDS = ['titlePage', 'setDraft', 'addSceneNumbers', 'removeSceneNumbers', 'lockSceneNumbers', 'revisionMode'];
  const TOOLS_CMDS = ['spellCheck', 'writingSuggestions', 'takeSnapshot', 'snapshots', 'trackChanges', 'compareSnapshot'];
  const PROJECT_CMDS = ['rename'];
  const cmdOpt = (id: string) => {
    const c = TOOLBAR_COMMANDS.find((x) => x.id === id);
    return c ? [{ value: `c:${c.id}`, label: c.label }] : [];
  };
  const toolOpt = (id: string) => {
    const t = ALL_TOOLS.find((x) => x.id === id);
    return t ? [{ value: `t:${t.id}`, label: t.label }] : [];
  };
  const tbAddCategories: Array<{ id: string; label: string; options: Array<{ value: string; label: string }>; utility?: boolean }> = [
    {
      id: 'toolbar', label: 'Toolbar',
      options: TOOLBAR_BUILTINS
        .filter((b) => b.key !== 'tags' && b.key !== 'scriptNotes' && !b.permanent)
        .map((b) => ({ value: `b:${b.key}`, label: b.label })),
    },
    {
      id: 'production', label: 'Production',
      options: [
        { value: 'b:tags', label: 'Production Tags' },
        ...PRODUCTION_CMDS.flatMap(cmdOpt),
      ],
    },
    {
      id: 'tools', label: 'Tools',
      options: [
        ...ALL_TOOLS.filter((t) => !WINDOW_IDS.includes(t.id) && t.id !== 'tags').flatMap((t) => toolOpt(t.id)),
        { value: 'b:scriptNotes', label: 'Notes' },
        ...TOOLS_CMDS.flatMap(cmdOpt),
      ],
    },
    {
      id: 'project', label: 'Project',
      options: [
        ...ALL_TOOLS.filter((t) => WINDOW_IDS.includes(t.id)).flatMap((t) => toolOpt(t.id)),
        ...PROJECT_CMDS.flatMap(cmdOpt),
      ],
    },
  ].map((cat) => ({ ...cat, options: cat.options.filter((o) => !tbPlaced(o.value)) }));

  // Utility (v0.69): structural items, added AFTER the "already placed" filter
  // above — Divider and Spacer are repeatable, so they must never be filtered
  // out as already present. `utility` marks them so "Show all …" skips them.
  const tbAddCategoriesAll: typeof tbAddCategories = [
    ...tbAddCategories,
    {
      id: 'utility',
      label: 'Utility',
      utility: true,
      options: [
        { value: 'divider', label: 'Add Divider' },
        { value: 'spacer', label: 'Spacer' },
      ],
    },
  ];
  const spacerPx = (tok: string) => {
    const n = Number(tok.split(':')[2]);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TOOLBAR_SPACER;
  };
  /**
   * v0.99 — the icon a row's item wears in the real UI. Resolved from the SAME
   * sources the UI itself draws from (MENU_ICONS, TOOLBAR_ICONS, and a tool's own
   * ToolDef.icon), so a Customize row can't end up showing an icon the button
   * doesn't have. Dividers and spacers have none, and get a blank of the same
   * width so every label still lines up.
   */
  const tokenIcon = (tok: string): React.ReactNode => {
    if (tok.startsWith('b:')) return TOOLBAR_ICONS[tok.slice(2)] ?? null;
    if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.icon ?? null;
    if (tok.startsWith('c:')) return TOOLBAR_ICONS[tok.slice(2)] ?? null;
    return null;   // spacer / divider
  };

  /** Icon slot: fixed width whether or not there's an icon, so labels align. */
  const iconSlot = (node: React.ReactNode) => (
    <span className="fs-customize-icon">{node}</span>
  );

  const tokenLabel = (tok: string): string => {
    if (tok.startsWith('b:')) return BUILTIN_BY_KEY[tok.slice(2)]?.label || tok;
    if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('s:')) return '— Spacer —';
    return '— Divider —';
  };

  // v0.76: embedded (docked / Settings) previously forced overflowY: 'visible',
  // so a list longer than the window just ran off with no scrollbar. It now
  // scrolls like the modal does, and keeps side padding so the drag handles
  // aren't clipped.
  const body = (
      // v0.83: tabs live in a LEFT SIDEBAR, the same shape as Settings
      // (.prefs-layout + .prefs-tabs). Across the top, seven tabs couldn't fit
      // the default width and forced a horizontal scrollbar; down the side they
      // simply stack, and adding an eighth costs no width at all.
      <div className="prefs-layout fs-customize-layout">
        <div className="prefs-tabs fs-customize-tabs">
          {([['menu', 'Menu Bar'], ['toolbar', 'Toolbar'], ['panels', 'Side Panels'], ['context', 'Context Menu'], ['elements', 'Elements'], ['themes', 'Themes'], ['keys', 'Keyboard Shortcuts']] as const).map(([id, label]) => (
            <button
              key={id}
              className={`prefs-tab${activeCat === id ? ' active' : ''}`}
              onClick={() => setActiveCat(id)}
            >{label}</button>
          ))}
        </div>
        <div className="dialog-body fs-customize-body">
          {activeCat === 'menu' && (<>
          <section>
            <h3>Menus</h3>
            <p className="fs-customize-hint">
              Hide menus you never use and put the rest in your order. File
              always stays visible.
            </p>
            <div className="fs-customize-row">
              <span className="fs-customize-tool">Menu Bar Size</span>
              <span className="fs-customize-seg">
                {/* v0.97: no Hide. Hiding the menu bar took File off screen with
                    it, and File has to stay reachable. Individual menus can still
                    be hidden below — except File, for the same reason. */}
                {(['compact', 'comfortable', 'custom'] as const).map((m) => (
                  <button
                    key={m}
                    className={menuMode === m ? 'active' : ''}
                    onClick={() => setMenuMode(m)}
                  >
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </span>
            </div>
            {menuMode === 'custom' && (
              <ChromeSlider
                surface="menu"
                value={chromePx('menu', 'custom', chromeCustomPx.menu)}
                onChange={(px) => setChromeCustomPx('menu', px)}
              />
            )}
            {/* v1.1: ONE Hide model everywhere. Hide REMOVES the row and stashes
                the item in + Add Item, exactly as the Toolbar, Side Panels and
                Context Menu tabs already did. A greyed-out row that stays put and
                a row that disappears are two different mental models, and the same
                word was on both buttons. */}
            <div className="fs-customize-grid">
              {visibleMenuLabels.map((label, idx) => {
                const moveMenuTo = (from: number, to: number) => {
                  const next = [...visibleMenuLabels];
                  const [m] = next.splice(from, 1);
                  next.splice(to, 0, m);
                  // Keep hidden menus in the stored order so re-adding one puts it
                  // back near where it was rather than at the end.
                  setMenuBarOrder([...next, ...orderedMenuLabels.filter((l) => menuBarHidden.includes(l))]);
                };
                return (
                  <div
                    key={label}
                    className={`fs-customize-row${dragClass('menu', idx)}`}
                    {...dragProps('menu', idx, moveMenuTo)}
                  >
                    <span className="fs-customize-tool">
                      <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                      {iconSlot(MENU_ICONS[label] ?? null)}
                      {label}
                    </span>
                    <span className="fs-customize-seg">
                      {/* v1.3: Show is kept for consistency across the tabs, even
                          though a row you can see is by definition shown — it's
                          the active state, and Hide is the move. */}
                      <button className="active" title="This menu is on the menu bar">Show</button>
                      <button
                        disabled={label === 'File'}
                        title={label === 'File'
                          ? 'File always stays on screen'
                          : 'Remove from the menu bar (re-add it from + Add Item)'}
                        onClick={() => {
                          if (label === 'File') return;
                          setMenuBarHidden([...menuBarHidden, label]);
                        }}
                      >Hide</button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="fs-tbzone-adders fs-adders-equal">
              <AddMenu
                onPick={(v) => {
                  if (v === 'all') { setMenuBarHidden([]); return; }
                  setMenuBarHidden(menuBarHidden.filter((l: string) => l !== v));
                }}
                groups={[
                  {
                    label: 'Show All',
                    options: menuBarHidden.length > 0
                      ? [{ value: 'all', label: 'Show All - Menus' }]
                      : [],
                  },
                  {
                    label: 'Menus',
                    options: orderedMenuLabels
                      .filter((l) => menuBarHidden.includes(l))
                      .map((l) => ({ value: l, label: l, icon: MENU_ICONS[l] ?? null })),
                  },
                ]}
              />
              <button
                className="swn-add-btn"
                title="Remove every menu except File"
                onClick={() => setMenuBarHidden(MENU_BAR_LABELS.filter((l) => l !== 'File'))}
              >Hide All</button>
              <button
                className="swn-add-btn"
                title="Restore the default menu bar: all menus, default order"
                onClick={() => { setMenuBarOrder([...MENU_BAR_LABELS]); setMenuBarHidden([]); }}
              >Reset to Default</button>
            </div>
          </section>
          </>)}
          {activeCat === 'toolbar' && (<>
          <section>
            <h3>Toolbar Layout</h3>
            <p className="fs-customize-hint">
              One list for the whole toolbar — every item on its own row.
              Left flows from the left edge; Right sits at the far right;
              Hide removes an item (re-add it from the dropdown below).
            </p>
            <div className="fs-customize-row">
              <span className="fs-customize-tool">Toolbar Size</span>
              <span className="fs-customize-seg">
                {(['compact', 'comfortable', 'custom', 'hidden'] as const).map((m) => (
                  <button key={m} className={toolbarMode === m ? 'active' : ''} onClick={() => setToolbarMode(m)}>
                    {m === 'hidden' ? 'Hide' : m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </span>
            </div>
            {toolbarMode === 'custom' && (
              <ChromeSlider
                surface="toolbar"
                value={chromePx('toolbar', 'custom', chromeCustomPx.toolbar)}
                onChange={(px) => setChromeCustomPx('toolbar', px)}
              />
            )}

            {(['left', 'right'] as const).map((zone) => {
              const tokens = zone === 'left' ? tbLeft : tbRight;
              const other = zone === 'left' ? tbRight : tbLeft;
              const update = (nextSelf: string[], nextOther?: string[]) =>
                zone === 'left'
                  ? setToolbarZones(nextSelf, nextOther ?? other)
                  : setToolbarZones(nextOther ?? other, nextSelf);
              // Zones are already separate arrays, so Left/Right items are
              // grouped by construction and a side switch appends to the
              // target zone's end (bottom). Only the divider line was missing.
              const sep = zone === 'right' && tbLeft.length > 0 && tbRight.length > 0
                ? [<div className="fs-customize-side-sep" key="tb-side-sep" />]
                : [];
              return [...sep, ...tokens.map((tok, idx) => {
                // Drop handler covering BOTH cases: reorder inside a zone, or
                // move to the other zone at exactly the row you dropped on — the
                // Left/Right toggle simply follows, since the zone IS the side.
                const dropTok = (
                  srcZone: 'left' | 'right', srcIdx: number,
                  dstZone: 'left' | 'right', dstIdx: number,
                ) => {
                  let nextLeft = [...tbLeft];
                  let nextRight = [...tbRight];
                  const src = srcZone === 'left' ? nextLeft : nextRight;
                  const [moved] = src.splice(srcIdx, 1);
                  if (moved === undefined) return;
                  const dst = dstZone === 'left' ? nextLeft : nextRight;
                  dst.splice(Math.min(dstIdx, dst.length), 0, moved);
                  if (dstZone === 'left') nextLeft = dst; else nextRight = dst;
                  setToolbarZones(nextLeft, nextRight);
                };
                const toZone = (target: 'left' | 'right') => {
                  if (target === zone) return;
                  update(tokens.filter((_, i) => i !== idx), [...other, tok]);
                };
                // v0.91: nothing is permanent in the toolbar any more — Customize
                // moved out to the chrome. The mechanism stays for any future item
                // that needs it; today it simply never fires.
                const isPermanent = tok.startsWith('b:')
                  && !!BUILTIN_BY_KEY[tok.slice(2)]?.permanent;
                const hideTok = () => {
                  if (isPermanent) return;
                  update(tokens.filter((_, i) => i !== idx));
                };
                return (
                  <div
                    className={`fs-customize-row${dragClass(`tb-${zone}`, idx)}`}
                    key={`${tok}-${zone}-${idx}`}
                    {...zoneDragProps('tb', zone, idx, dropTok)}
                  >
                    <span className="fs-customize-tool">
                      <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                      {iconSlot(tokenIcon(tok))}
                      {tokenLabel(tok)}
                      {tok.startsWith('s:') && (
                        <SpacerSize
                          value={spacerPx(tok)}
                          min={8}
                          max={240}
                          onChange={(px) => {
                            // The size rides in the token itself (s:<id>:<px>),
                            // so it persists with the layout it belongs to.
                            const [, id] = tok.split(':');
                            const next = `s:${id}:${px}`;
                            const swap = (arr: string[]) => arr.map((t) => (t === tok ? next : t));
                            setToolbarZones(swap(tbLeft), swap(tbRight));
                          }}
                        />
                      )}
                    </span>
                    <span className="fs-customize-seg">
                      <button className={zone === 'left' ? 'active' : ''} onClick={() => toZone('left')}>Left</button>
                      <button className={zone === 'right' ? 'active' : ''} onClick={() => toZone('right')}>Right</button>
                      <button
                        title={isPermanent ? 'Customize can’t be hidden' : 'Remove from the toolbar'}
                        disabled={isPermanent}
                        onClick={hideTok}
                      >Hide</button>
                    </span>
                  </div>
                );
              })];
            })}
            <div className="fs-tbzone-adders fs-adders-equal">
              <AddMenu
                onPick={(v) => {
                  if (v === 'divider') { setToolbarZones([...tbLeft, `d:${Date.now()}`], tbRight); return; }
                  if (v === 'spacer') { setToolbarZones([...tbLeft, `s:${Date.now()}`], tbRight); return; }
                  if (v.startsWith('all:')) {
                    const cat = tbAddCategoriesAll.find((c) => c.id === v.slice(4) && !c.utility);
                    if (cat) setToolbarZones([...tbLeft, ...cat.options.map((o) => o.value)], tbRight);
                    return;
                  }
                  setToolbarZones([...tbLeft, v], tbRight);
                }}
                groups={[
                  {
                    label: 'Show All',
                    options: tbAddCategoriesAll
                      .filter((cat) => !cat.utility && cat.options.length > 0)
                      .map((cat) => ({ value: `all:${cat.id}`, label: `Show All - ${titleCase(cat.label)}` })),
                  },
                  ...tbAddCategoriesAll.map((cat) => ({
                    label: cat.label,
                    options: cat.options.map((o) => ({ value: o.value, label: o.label, icon: tokenIcon(o.value) })),
                  })),
                ]}
              />
              <button
                className="swn-add-btn"
                title="Hide every toolbar item (re-add items from the dropdown)"
                onClick={() => setToolbarZones(
                  TOOLBAR_BUILTINS.filter((b) => b.permanent).map((b) => `b:${b.key}`),
                  [],
                )}
              >Hide All</button>
              <button
                className="swn-add-btn"
                title="Restore the default toolbar: all toolbar items in default order"
                onClick={() => setToolbarZones([...DEFAULT_TOOLBAR_LEFT], [...DEFAULT_TOOLBAR_RIGHT])}
              >Reset to Default</button>
            </div>
          </section>
          </>)}
          {activeCat === 'elements' && <EditElementsDialog embedded />}
          {activeCat === 'keys' && <KeyboardShortcutsTab />}
          {activeCat === 'themes' && <ThemesTab />}
          {activeCat === 'context' && <ContextMenuTab />}
          {activeCat === 'panels' && (<>
          <section>
            <h3>Panels</h3>
            <p className="fs-customize-hint">
              Compact and Comfortable set the panel's width; Hide closes it.
              Windows docked inside a panel resize to fit it.
            </p>
            {([
              ['left', 'Left Panel Size', navigatorOpen, toggleNavigator] as const,
              ['right', 'Right Panel Size', shelfOpen, toggleShelf] as const,
            ]).map(([side, label, isOpen, toggle]) => (
              <React.Fragment key={side}>
                <div className="fs-customize-row">
                  <span className="fs-customize-tool">{label}</span>
                  <span className="fs-customize-seg">
                    {(['compact', 'comfortable', 'custom'] as const).map((m) => (
                      <button
                        key={m}
                        className={isOpen && panelSizeMode[side] === m ? 'active' : ''}
                        onClick={() => {
                          setPanelSizeMode(side, m);
                          if (!isOpen) toggle();     // choosing a width also reveals it
                        }}
                      >{m[0].toUpperCase() + m.slice(1)}</button>
                    ))}
                    <button
                      className={!isOpen ? 'active' : ''}
                      onClick={() => { if (isOpen) toggle(); }}
                    >Hide</button>
                  </span>
                </div>
                {isOpen && panelSizeMode[side] === 'custom' && (() => {
                  const sf = side === 'left' ? 'panelLeft' : 'panelRight';
                  return (
                    <ChromeSlider
                      surface={sf}
                      value={chromePx(sf, 'custom', chromeCustomPx[sf])}
                      onChange={(px) => setChromeCustomPx(sf, px)}
                    />
                  );
                })()}
              </React.Fragment>
            ))}
          </section>
          {renderPanelsTab()}
          </>)}
        </div>
      </div>
  );

  if (embedded) return body;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box fs-customize-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          Customize
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>
        {body}
      </div>
    </div>
  );
}
