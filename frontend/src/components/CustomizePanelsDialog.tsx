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
import { MENU_BAR_LABELS, useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolConfig } from '../stores/editorStore';
import { ALL_TOOLS, WINDOW_IDS } from './ToolDock';
import { TOOLBAR_COMMANDS } from './toolbarCommands';
import { TOOLBAR_BUILTINS, BUILTIN_BY_KEY, DEFAULT_TOOLBAR_LEFT, DEFAULT_TOOLBAR_RIGHT } from './toolbarBuiltins';

interface Props {
  /** Initial tab; the dialog always renders its own tab bar. */
  category?: 'menu' | 'toolbar' | 'panels';
  open: boolean;
  onClose: () => void;
  /** Render only the content (no overlay/box) — used inside Preferences. */
  embedded?: boolean;
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
    menuMode, setMenuMode,
  } = useEditorStore();


  const PANEL_PRODUCTION_IDS: ToolId[] = ['tags'];
  // One combined Panels tab (v0.48): every panel item in one list — the
  // Left / Right buttons on each row already choose the side, so separate
  // Left Panel and Right Panel tabs were redundant.
  const renderPanelsTab = () => {
    const order = toolOrder.length ? toolOrder : ALL_TOOLS.map((t) => t.id as string);
    const oIdx = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? 1000 : i;
    };
    type Row =
      | { kind: 'tool'; id: ToolId; label: string; side: 'left' | 'right' }
      | { kind: 'divider'; id: string; label: string; side: 'left' | 'right' };
    const rows: Row[] = [
      ...ALL_TOOLS.filter((t) => cfgOf(t.id).enabled).map((t) => ({
        kind: 'tool' as const, id: t.id, label: t.label, side: cfgOf(t.id).side, ord: oIdx(t.id),
      })),
      ...panelDividers.map((d) => ({
        kind: 'divider' as const, id: d.id, label: d.label, side: d.side, ord: oIdx(`div:${d.id}`),
      })),
    ].sort((a, b) => a.ord - b.ord).map(({ ord: _o, ...r }) => r as Row);

    const orderTokenOf = (r: Row) => r.kind === 'tool' ? r.id : `div:${r.id}`;
    const moveRowTo = (from: number, to: number) => {
      const toks = rows.map(orderTokenOf);
      const full = [...order];
      for (const t of toks) if (!full.includes(t)) full.push(t);
      const newToks = [...toks];
      const [m] = newToks.splice(from, 1);
      newToks.splice(to, 0, m);
      const inRows = new Set(toks);
      let k = 0;
      setToolOrder(full.map((x) => (inRows.has(x) ? newToks[k++] : x)));
    };
    const setRowSide = (r: Row, target: 'left' | 'right' | 'hidden') => {
      if (r.kind === 'divider') {
        if (target === 'hidden') {
          setPanelDividers(panelDividers.filter((x) => x.id !== r.id));
          setToolOrder(order.filter((t) => t !== `div:${r.id}`));
        } else {
          setPanelDividers(panelDividers.map((x) => x.id === r.id ? { ...x, side: target } : x));
        }
        return;
      }
      if (target === 'hidden') setTool(r.id, { enabled: false });
      else setTool(r.id, { enabled: true, side: target });
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
      if (value === 'divider') {
        const id = String(Date.now());
        setPanelDividers([...panelDividers, { id, label: '', side: 'left' }]);
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
      // Defaults: every Project window on the left; every tool + production
      // item on the right. Dividers and custom ordering cleared.
      const next = { ...toolConfig };
      ALL_TOOLS.forEach((t) => {
        next[t.id] = { side: WINDOW_IDS.includes(t.id) ? 'left' : 'right', enabled: true };
      });
      setToolConfig(next);
      setPanelDividers([]);
      setToolOrder([]);
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
          Everything in both panels, in order. Left/Right chooses an item's
          panel; Hide removes it (re-add it from the dropdown below). Divider
          labels are edited here only.
        </p>
        {rows.map((r, idx) => (
          <div
            key={`${r.kind}-${r.id}`}
            className={`fs-customize-row${dragClass('panels', idx)}`}
            {...dragProps('panels', idx, moveRowTo)}
          >
            <span className="fs-customize-tool">
              <span className="fs-customize-drag" title="Drag to reorder">⠿</span>
              {r.kind === 'divider' ? (
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
            <option value="divider">Add divider</option>
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
  const [activeCat, setActiveCat] = React.useState<'menu' | 'toolbar' | 'panels'>(category ?? 'menu');
  // Drag-and-drop reordering (v0.45): one shared source marker; drops are
  // only accepted within the same list.
  const [dragInfo, setDragInfo] = React.useState<{ list: string; idx: number } | null>(null);
  // Warning window shown whenever the View menu (or the whole menu bar)
  // gets hidden — the user must acknowledge where customization lives.
  const [stuckWarnOpen, setStuckWarnOpen] = React.useState(false);
  const dragProps = (list: string, idx: number, moveTo: (from: number, to: number) => void) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDragInfo({ list, idx }); e.dataTransfer.effectAllowed = 'move'; },
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
  const tbAddCategories: Array<{ id: string; label: string; options: Array<{ value: string; label: string }> }> = [
    {
      id: 'toolbar', label: 'Toolbar',
      options: TOOLBAR_BUILTINS
        .filter((b) => b.key !== 'tags' && b.key !== 'scriptNotes')
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
  const tokenLabel = (tok: string): string => {
    if (tok.startsWith('b:')) return BUILTIN_BY_KEY[tok.slice(2)]?.label || tok;
    if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.label || tok;
    return '— Divider —';
  };

  const body = (
        <div className="dialog-body fs-customize-body" style={embedded ? { padding: '4px 0 0', maxHeight: 'none', overflowY: 'visible' } : undefined}>
          <div className="prefs-subtabs">
            {([['menu', 'Menu Bar'], ['toolbar', 'Toolbar'], ['panels', 'Panels']] as const).map(([id, label]) => (
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
                {(['compact', 'comfortable', 'hidden'] as const).map((m) => (
                  <button
                    key={m}
                    className={menuMode === m ? 'active' : ''}
                    onClick={() => {
                      setMenuMode(m);
                      if (m === 'hidden' && menuMode !== 'hidden') setStuckWarnOpen(true);
                    }}
                  >
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </span>
            </div>
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
                {(['compact', 'comfortable', 'hidden'] as const).map((m) => (
                  <button key={m} className={toolbarMode === m ? 'active' : ''} onClick={() => setToolbarMode(m)}>
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </span>
            </div>

            {(['left', 'right'] as const).map((zone) => {
              const tokens = zone === 'left' ? tbLeft : tbRight;
              const other = zone === 'left' ? tbRight : tbLeft;
              const update = (nextSelf: string[], nextOther?: string[]) =>
                zone === 'left'
                  ? setToolbarZones(nextSelf, nextOther ?? other)
                  : setToolbarZones(nextOther ?? other, nextSelf);
              return tokens.map((tok, idx) => {
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
                const hideTok = () => update(tokens.filter((_, i) => i !== idx));
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
                      <button title="Remove from the toolbar" onClick={hideTok}>Hide</button>
                    </span>
                  </div>
                );
              });
            })}
            <div className="fs-tbzone-adders fs-adders-equal">
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  e.target.value = '';
                  if (v === 'divider') { setToolbarZones([...tbLeft, `d:${Date.now()}`], tbRight); return; }
                  if (v.startsWith('all:')) {
                    const cat = tbAddCategories.find((c) => c.id === v.slice(4));
                    if (cat) setToolbarZones([...tbLeft, ...cat.options.map((o) => o.value)], tbRight);
                    return;
                  }
                  setToolbarZones([...tbLeft, v], tbRight);
                }}
              >
                <option value="">+ Add item to toolbar…</option>
                {tbAddCategories.some((cat) => cat.options.length > 0) && (
                  <optgroup label="Show All">
                    {tbAddCategories.filter((cat) => cat.options.length > 0).map((cat) => (
                      <option key={`all-${cat.id}`} value={`all:${cat.id}`}>Show all {cat.label}</option>
                    ))}
                  </optgroup>
                )}
                {tbAddCategories.map((cat) => (
                  <optgroup key={cat.id} label={cat.label}>
                    {cat.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                ))}
                <option value="divider">Add divider</option>
              </select>
              <button
                className="swn-add-btn"
                title="Hide every toolbar item (re-add items from the dropdown)"
                onClick={() => setToolbarZones([], [])}
              >Hide All</button>
              <button
                className="swn-add-btn"
                title="Restore the default toolbar: all toolbar items in default order"
                onClick={() => setToolbarZones([...DEFAULT_TOOLBAR_LEFT], [...DEFAULT_TOOLBAR_RIGHT])}
              >Reset to Default</button>
            </div>
          </section>
          </>)}
          {activeCat === 'panels' && (<>
          <section>
            <h3>Panels</h3>
            <div className="fs-customize-row">
              <span className="fs-customize-tool">Left Panel</span>
              <span className="fs-customize-seg">
                <button className={navigatorOpen ? 'active' : ''} onClick={() => { if (!navigatorOpen) toggleNavigator(); }}>Show</button>
                <button className={!navigatorOpen ? 'active' : ''} onClick={() => { if (navigatorOpen) toggleNavigator(); }}>Hide</button>
              </span>
            </div>
            <div className="fs-customize-row">
              <span className="fs-customize-tool">Right Panel</span>
              <span className="fs-customize-seg">
                <button className={shelfOpen ? 'active' : ''} onClick={() => { if (!shelfOpen) toggleShelf(); }}>Show</button>
                <button className={!shelfOpen ? 'active' : ''} onClick={() => { if (shelfOpen) toggleShelf(); }}>Hide</button>
              </span>
            </div>
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
