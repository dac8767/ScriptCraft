import React from 'react';
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

interface Props {
  /** Initial tab; the dialog always renders its own tab bar. */
  category?: 'menu' | 'toolbar' | 'panels' | 'elements';
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
      | { kind: 'divider'; id: string; label: string; side: 'left' | 'right'; spacer?: boolean };
    const rows: Row[] = [
      ...ALL_TOOLS.filter((t) => cfgOf(t.id).enabled).map((t) => ({
        kind: 'tool' as const, id: t.id, label: t.label, side: cfgOf(t.id).side, ord: oIdx(t.id),
      })),
      ...panelDividers.map((d) => ({
        kind: 'divider' as const, id: d.id, label: d.label, side: d.side, spacer: d.spacer, ord: oIdx(`div:${d.id}`),
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
    const moveWithinSide = (side: 'left' | 'right') => (from: number, to: number) => {
      const sideRows = side === 'left' ? leftRows : rightRows;
      const sideToks = sideRows.map(orderTokenOf);
      const next = [...sideToks];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      const inSide = new Set(sideToks);
      let k = 0;
      setToolOrder(fullOrder().map((x) => (inSide.has(x) ? next[k++] : x)));
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
                  {...dragProps(`panels-${side}`, idx, moveWithinSide(side))}
                >
                  <span className="fs-customize-tool">
                    <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                    {r.kind === 'divider' && r.spacer ? (
                      <span className="fs-spacer-row-label">— Spacer —</span>
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
          <select value="" onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = ''; } }}>
            <option value="">+ Add item to Panels…</option>
            {(['Project Windows', 'Tools', 'Production'] as const).some((g) => addOptions.some((o) => o.group === g)) && (
              <optgroup label="Show All">
                {(['Project Windows', 'Tools', 'Production'] as const)
                  .filter((g) => addOptions.some((o) => o.group === g))
                  .map((g) => <option key={`all-${g}`} value={`all:${g}`}>Show all {g}</option>)}
              </optgroup>
            )}
            {(['Project Windows', 'Tools', 'Production'] as const).map((group) => {
              const opts = addOptions.filter((o) => o.group === group);
              if (opts.length === 0) return null;
              return (
                <optgroup key={group} label={group}>
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              );
            })}
            <optgroup label="Utility">
              <option value="divider">Add divider</option>
              <option value="spacer">Spacer</option>
            </optgroup>
          </select>
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
  const [activeCat, setActiveCat] = React.useState<'menu' | 'toolbar' | 'panels' | 'elements'>(category ?? 'menu');
  // Drag-and-drop reordering (v0.45): one shared source marker; drops are
  // only accepted within the same list.
  const [dragInfo, setDragInfo] = React.useState<{ list: string; idx: number } | null>(null);
  // Warning window shown whenever the View menu (or the whole menu bar)
  // gets hidden — the user must acknowledge where customization lives.
  const [stuckWarnOpen, setStuckWarnOpen] = React.useState(false);
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

  const tbReady = toolbarZonesSet;
  const tbLeft = tbReady ? tbLeftRaw : [...DEFAULT_TOOLBAR_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)];
  const tbRight = tbReady ? tbRightRaw : DEFAULT_TOOLBAR_RIGHT;

  // ── Add-dropdown categories (v0.44): Toolbar / Production / Tools / Project,
  //    mirroring the menu bar taxonomy. Script Notes and Production Tags live
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
        { value: 'b:scriptNotes', label: 'Script Notes' },
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
        { value: 'divider', label: 'Add divider' },
        { value: 'spacer', label: 'Spacer' },
      ],
    },
  ];
  const tokenLabel = (tok: string): string => {
    if (tok.startsWith('b:')) return BUILTIN_BY_KEY[tok.slice(2)]?.label || tok;
    if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('s:')) return '— Spacer —';
    return '— Divider —';
  };

  const body = (
        <div className="dialog-body fs-customize-body" style={embedded ? { padding: '4px 0 0', maxHeight: 'none', overflowY: 'visible' } : undefined}>
          <div className="prefs-subtabs">
            {([['menu', 'Menu Bar'], ['toolbar', 'Toolbar'], ['panels', 'Side Panels'], ['elements', 'Elements']] as const).map(([id, label]) => (
              <button key={id} className={activeCat === id ? 'active' : ''} onClick={() => setActiveCat(id)}>{label}</button>
            ))}
          </div>
          {activeCat === 'menu' && (<>
          <section>
            <h3>Menus</h3>
            <p className="fs-customize-hint">
              Hide menus you never use and put the rest in your order. File
              always stays visible.
            </p>
            <div className="fs-customize-row">
              <span className="fs-customize-tool">Menu bar mode</span>
              <span className="fs-customize-seg">
                {(['compact', 'comfortable', 'custom', 'hidden'] as const).map((m) => (
                  <button
                    key={m}
                    className={menuMode === m ? 'active' : ''}
                    onClick={() => {
                      setMenuMode(m);
                      if (m === 'hidden' && menuMode !== 'hidden') setStuckWarnOpen(true);
                    }}
                  >
                    {m === 'hidden' ? 'Hide' : m[0].toUpperCase() + m.slice(1)}
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
            {(menuMode === 'hidden' || menuBarHidden.includes('View')) && (
              <p className="fs-customize-hint fs-customize-stuck-hint">
                You can still customize the menu bar, toolbar, and side panels by going to Settings {'>'} Layout.
              </p>
            )}
            <div className="fs-customize-grid">
              {orderedMenuLabels.map((label, idx) => {
                const hidden = menuBarHidden.includes(label);
                const moveMenuTo = (from: number, to: number) => {
                  const next = [...orderedMenuLabels];
                  const [m] = next.splice(from, 1);
                  next.splice(to, 0, m);
                  setMenuBarOrder(next);
                };
                return (
                  <div
                    key={label}
                    className={`fs-customize-row${dragClass('menu', idx)}`}
                    {...dragProps('menu', idx, moveMenuTo)}
                  >
                    <span className="fs-customize-tool">
                      <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                      {label}
                    </span>
                    <span className="fs-customize-seg">
                      <button
                        className={!hidden ? 'active' : ''}
                        onClick={() => setMenuBarHidden(menuBarHidden.filter((l: string) => l !== label))}
                      >Show</button>
                      <button
                        className={hidden ? 'active' : ''}
                        disabled={label === 'File'}
                        onClick={() => {
                          if (label === 'File' || hidden) return;
                          setMenuBarHidden([...menuBarHidden, label]);
                          // View hosts this Customize dialog — tell the user
                          // where the other way in lives so they aren't stuck.
                          if (label === 'View') setStuckWarnOpen(true);
                        }}
                      >Hide</button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="fs-tbzone-adders fs-adders-equal">
              <button
                className="swn-add-btn"
                title="Show every menu"
                onClick={() => setMenuBarHidden([])}
              >Show All</button>
              <button
                className="swn-add-btn"
                title="Hide every menu except File"
                onClick={() => {
                  setMenuBarHidden(MENU_BAR_LABELS.filter((l) => l !== 'File'));
                  setStuckWarnOpen(true);
                }}
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
              <span className="fs-customize-tool">Toolbar mode</span>
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
                const moveTokTo = (from: number, to: number) => {
                  const next = [...tokens];
                  const [m] = next.splice(from, 1);
                  next.splice(to, 0, m);
                  update(next);
                };
                const toZone = (target: 'left' | 'right') => {
                  if (target === zone) return;
                  update(tokens.filter((_, i) => i !== idx), [...other, tok]);
                };
                // Permanent items (Customize) reorder and switch zones freely,
                // but can't be removed from the toolbar.
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
                    {...dragProps(`tb-${zone}`, idx, moveTokTo)}
                  >
                    <span className="fs-customize-tool">
                      <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
                      {tokenLabel(tok)}
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
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  e.target.value = '';
                  if (v === 'divider') { setToolbarZones([...tbLeft, `d:${Date.now()}`], tbRight); return; }
                  if (v === 'spacer') { setToolbarZones([...tbLeft, `s:${Date.now()}`], tbRight); return; }
                  if (v.startsWith('all:')) {
                    const cat = tbAddCategoriesAll.find((c) => c.id === v.slice(4) && !c.utility);
                    if (cat) setToolbarZones([...tbLeft, ...cat.options.map((o) => o.value)], tbRight);
                    return;
                  }
                  setToolbarZones([...tbLeft, v], tbRight);
                }}
              >
                <option value="">+ Add item to toolbar…</option>
                {tbAddCategoriesAll.some((cat) => !cat.utility && cat.options.length > 0) && (
                  <optgroup label="Show All">
                    {tbAddCategoriesAll.filter((cat) => !cat.utility && cat.options.length > 0).map((cat) => (
                      <option key={`all-${cat.id}`} value={`all:${cat.id}`}>Show all {cat.label}</option>
                    ))}
                  </optgroup>
                )}
                {tbAddCategoriesAll.filter((cat) => cat.options.length > 0).map((cat) => (
                  <optgroup key={cat.id} label={cat.label}>
                    {cat.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
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
          {activeCat === 'panels' && (<>
          <section>
            <h3>Panels</h3>
            <p className="fs-customize-hint">
              Compact and Comfortable set the panel's width; Hide closes it.
              Windows docked inside a panel resize to fit it.
            </p>
            {([
              ['left', 'Left Panel', navigatorOpen, toggleNavigator] as const,
              ['right', 'Right Panel', shelfOpen, toggleShelf] as const,
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
          {stuckWarnOpen && (
            <div className="dialog-overlay fs-stuck-warn-overlay" onClick={() => setStuckWarnOpen(false)}>
              <div className="dialog-box fs-stuck-warn-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">Heads Up</div>
                <div className="dialog-body">
                  <p>
                    You can still customize the menu bar, toolbar, and side panels
                    by going to Settings {'>'} Layout.
                  </p>
                </div>
                <div className="dialog-footer">
                  <button className="dialog-btn-primary" autoFocus onClick={() => setStuckWarnOpen(false)}>OK</button>
                </div>
              </div>
            </div>
          )}
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
