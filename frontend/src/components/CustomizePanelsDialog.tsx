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
  category?: 'menu' | 'toolbar' | 'leftpanel' | 'rightpanel';
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
  const renderPanelTab = (side: 'left' | 'right') => {
    const order = toolOrder.length ? toolOrder : ALL_TOOLS.map((t) => t.id as string);
    const oIdx = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? 1000 : i;
    };
    type Row = { kind: 'tool'; id: ToolId; label: string } | { kind: 'divider'; id: string; label: string };
    const rows: Row[] = [
      ...ALL_TOOLS.filter((t) => {
        const cfg = cfgOf(t.id);
        return cfg.enabled && cfg.side === side;
      }).map((t) => ({ kind: 'tool' as const, id: t.id, label: t.label, ord: oIdx(t.id) })),
      ...panelDividers.filter((d) => d.side === side).map((d) => ({ kind: 'divider' as const, id: d.id, label: d.label, ord: oIdx(`div:${d.id}`) })),
    ].sort((a, b) => a.ord - b.ord).map(({ ord: _o, ...r }) => r as Row);

    const orderTokenOf = (r: Row) => r.kind === 'tool' ? r.id : `div:${r.id}`;
    const moveRow = (idx: number, dir: -1 | 1) => {
      const j = idx + dir;
      if (j < 0 || j >= rows.length) return;
      const a = orderTokenOf(rows[idx]);
      const b = orderTokenOf(rows[j]);
      const full = order.includes(a) && order.includes(b) ? [...order] : [...order, ...[a, b].filter((x) => !order.includes(x))];
      const ai = full.indexOf(a), bi = full.indexOf(b);
      [full[ai], full[bi]] = [full[bi], full[ai]];
      setToolOrder(full);
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
    const addOptions = [
      ...ALL_TOOLS.filter((t) => WINDOW_IDS.includes(t.id) && !(cfgOf(t.id).enabled && cfgOf(t.id).side === side)).map((t) => ({ group: 'Project Windows', value: `t:${t.id}`, label: t.label })),
      ...ALL_TOOLS.filter((t) => !WINDOW_IDS.includes(t.id) && !PANEL_PRODUCTION_IDS.includes(t.id) && !(cfgOf(t.id).enabled && cfgOf(t.id).side === side)).map((t) => ({ group: 'Tools', value: `t:${t.id}`, label: t.label })),
      ...ALL_TOOLS.filter((t) => PANEL_PRODUCTION_IDS.includes(t.id) && !(cfgOf(t.id).enabled && cfgOf(t.id).side === side)).map((t) => ({ group: 'Production', value: `t:${t.id}`, label: t.label })),
    ];
    const onAdd = (value: string) => {
      if (value === 'divider') {
        const id = String(Date.now());
        setPanelDividers([...panelDividers, { id, label: '', side }]);
        setToolOrder([...order, `div:${id}`]);
      } else if (value.startsWith('t:')) {
        setTool(value.slice(2) as ToolId, { enabled: true, side });
      }
    };
    return (
      <section>
        <h3>{side === 'left' ? 'Left Panel' : 'Right Panel'}</h3>
        <p className="fs-customize-hint">
          Everything currently in this panel, top to bottom. Left/Right moves an
          item to the other panel; Hide removes it (re-add it from the dropdown
          below). Divider labels are edited here only.
        </p>
        {rows.map((r, idx) => (
          <div key={`${r.kind}-${r.id}`} className="fs-customize-row">
            <span className="fs-customize-tool">
              <span className="fs-customize-order">
                <button title="Move up" onClick={() => moveRow(idx, -1)} disabled={idx === 0}>▲</button>
                <button title="Move down" onClick={() => moveRow(idx, 1)} disabled={idx === rows.length - 1}>▼</button>
              </span>
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
              <button className={side === 'left' ? 'active' : ''} onClick={() => setRowSide(r, 'left')}>Left</button>
              <button className={side === 'right' ? 'active' : ''} onClick={() => setRowSide(r, 'right')}>Right</button>
              <button onClick={() => setRowSide(r, 'hidden')}>Hide</button>
            </span>
          </div>
        ))}
        <div className="fs-tbzone-adders">
          <select value="" onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = ''; } }}>
            <option value="">Add item to {side === 'left' ? 'Left' : 'Right'} Panel…</option>
            <optgroup label="Project Windows">
              {addOptions.filter((o) => o.group === 'Project Windows').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Tools">
              {addOptions.filter((o) => o.group === 'Tools').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Production">
              {addOptions.filter((o) => o.group === 'Production').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <option value="divider">Divider</option>
          </select>
        </div>
      </section>
    );
  };

  // ALL hooks must run before this early return — a hook below it crashes
  // React ('Rendered more hooks than during the previous render').
  const { toolbarLeft: tbLeftRaw, toolbarRight: tbRightRaw, setToolbarZones } = useEditorStore();
  const { panelDividers, setPanelDividers } = useEditorStore();
  const [activeCat, setActiveCat] = React.useState<'menu' | 'toolbar' | 'leftpanel' | 'rightpanel'>(category ?? 'menu');

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

  const tbReady = tbLeftRaw.length > 0 || tbRightRaw.length > 0;
  const tbLeft = tbReady ? tbLeftRaw : [...DEFAULT_TOOLBAR_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)];
  const tbRight = tbReady ? tbRightRaw : DEFAULT_TOOLBAR_RIGHT;
  const tokenLabel = (tok: string): string => {
    if (tok.startsWith('b:')) return BUILTIN_BY_KEY[tok.slice(2)]?.label || tok;
    if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.label || tok;
    return '— Divider —';
  };

  const body = (
        <div className="dialog-body fs-customize-body" style={embedded ? { padding: '4px 0 0', maxHeight: 'none', overflowY: 'visible' } : undefined}>
          <div className="prefs-subtabs">
            {([['menu', 'Menu Bar'], ['toolbar', 'Toolbar'], ['leftpanel', 'Left Panel'], ['rightpanel', 'Right Panel']] as const).map(([id, label]) => (
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
                  <button key={m} className={menuMode === m ? 'active' : ''} onClick={() => setMenuMode(m)}>
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </span>
            </div>
            <div className="fs-customize-grid">
              {orderedMenuLabels.map((label, idx) => {
                const hidden = menuBarHidden.includes(label);
                const moveMenu = (dir: -1 | 1) => {
                  const j = idx + dir;
                  if (j < 0 || j >= orderedMenuLabels.length) return;
                  const next = [...orderedMenuLabels];
                  [next[idx], next[j]] = [next[j], next[idx]];
                  setMenuBarOrder(next);
                };
                return (
                  <div key={label} className="fs-customize-row">
                    <span className="fs-customize-tool">
                      <span className="fs-customize-order">
                        <button title="Move left in the menu bar" onClick={() => moveMenu(-1)} disabled={idx === 0}>▲</button>
                        <button title="Move right in the menu bar" onClick={() => moveMenu(1)} disabled={idx === orderedMenuLabels.length - 1}>▼</button>
                      </span>
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
                        onClick={() => { if (label !== 'File' && !hidden) setMenuBarHidden([...menuBarHidden, label]); }}
                      >Hide</button>
                    </span>
                  </div>
                );
              })}
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
                const moveTok = (dir: -1 | 1) => {
                  const j = idx + dir;
                  if (j < 0 || j >= tokens.length) return;
                  const next = [...tokens];
                  [next[idx], next[j]] = [next[j], next[idx]];
                  update(next);
                };
                const toZone = (target: 'left' | 'right') => {
                  if (target === zone) return;
                  update(tokens.filter((_, i) => i !== idx), [...other, tok]);
                };
                const hideTok = () => update(tokens.filter((_, i) => i !== idx));
                return (
                  <div className="fs-customize-row" key={`${tok}-${zone}-${idx}`}>
                    <span className="fs-customize-tool">
                      <span className="fs-customize-order">
                        <button title="Move up within its zone" onClick={() => moveTok(-1)} disabled={idx === 0}>▲</button>
                        <button title="Move down within its zone" onClick={() => moveTok(1)} disabled={idx === tokens.length - 1}>▼</button>
                      </span>
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
            <div className="fs-tbzone-adders">
              <button className="swn-add-btn" onClick={() => setToolbarZones([...tbLeft, `d:${Date.now()}`], tbRight)}>+ Divider (Left)</button>
              <button className="swn-add-btn" onClick={() => setToolbarZones(tbLeft, [...tbRight, `d:${Date.now()}`])}>+ Divider (Right)</button>
              <select
                value=""
                onChange={(e) => { if (e.target.value) { setToolbarZones([...tbLeft, e.target.value], tbRight); e.target.value = ''; } }}
              >
                <option value="">+ Add toolbar item / window / command…</option>
                <optgroup label="Toolbar Items">
                  {TOOLBAR_BUILTINS.filter((b) => !tbLeft.includes(`b:${b.key}`) && !tbRight.includes(`b:${b.key}`)).map((b) => (
                    <option key={b.key} value={`b:${b.key}`}>{b.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Windows & Tools">
                  {ALL_TOOLS.filter((t) => !tbLeft.includes(`t:${t.id}`) && !tbRight.includes(`t:${t.id}`)).map((t) => (
                    <option key={t.id} value={`t:${t.id}`}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Commands">
                  {TOOLBAR_COMMANDS.filter((c) => !tbLeft.includes(`c:${c.id}`) && !tbRight.includes(`c:${c.id}`)).map((c) => (
                    <option key={c.id} value={`c:${c.id}`}>{c.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </section>
          </>)}
          {activeCat === 'leftpanel' && (<>
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
          {renderPanelTab('left')}
          </>)}
          {activeCat === 'rightpanel' && (<>
          {renderPanelTab('right')}
          </>)}
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
