import React from 'react';
/**
 * CustomizePanelsDialog — View → Customize Layout.
 *
 * Panels: each tool can live in the Left panel, the Right panel, or be Hidden.
 * (Defaults: script-structure tools left; notes/analytics/goals right.)
 * Hidden tools stay reachable from the Tools menu, opening as a temporary
 * window.
 *
 * Toolbar: pin any tool as a button (appears right of Production Tags), and
 * deactivate any built-in toolbar item. Ported from FreeDraft v5.5's
 * Customize Toolbar.
 */
import { MENU_BAR_LABELS, useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolConfig } from '../stores/editorStore';
import { ALL_TOOLS, WINDOW_IDS } from './ToolDock';
import { TOOLBAR_COMMANDS } from './toolbarCommands';

/** Built-in toolbar items that can be deactivated (matched by title prefix). */
const TOOLBAR_GROUPS: Array<{ name: string; items: string[] }> = [
  { name: 'History', items: ['Undo', 'Redo', 'Element'] },
  { name: 'Insert', items: ['Insert Section', 'Insert Script Note', 'Insert Checklist Item'] },
  { name: 'Text Style', items: ['Font Family', 'Font Size', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Subscript', 'Superscript', 'Text Color', 'Highlight Color'] },
  { name: 'Alignment', items: ['Align Left', 'Align Center', 'Align Right', 'Justify'] },
  { name: 'Navigation', items: ['Find & Replace', 'Go to Page'] },
  { name: 'Zoom', items: ['Zoom Out', 'Zoom In'] },
  { name: 'View', items: ['Editor View'] },
];
const TOOLBAR_ITEMS: string[] = TOOLBAR_GROUPS.flatMap((g) => g.items);
/** Per-item checkboxes shown under each group row in the combined layout. */
const GROUP_TOKEN_ITEMS: Record<string, string[]> = {
  history: ['Undo', 'Redo', 'Element'],
  insert: ['Insert Section', 'Insert Script Note', 'Insert Checklist Item'],
  font: ['Font Family', 'Font Size'],
  style: ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Subscript', 'Superscript', 'Text Color', 'Highlight Color'],
  align: ['Align Left', 'Align Center', 'Align Right', 'Justify'],
  nav: ['Find & Replace', 'Go to Page'],
  zoom: ['Zoom Out', 'Zoom In'],
  view: ['Editor View'],
  notes: [],
};

interface Props {
  /** When set, render only that category's sections (Settings > Layout tabs). */
  category?: 'menu' | 'toolbar' | 'panels';
  open: boolean;
  onClose: () => void;
  /** Render only the content (no overlay/box) — used inside Preferences. */
  embedded?: boolean;
}

export default function CustomizePanelsDialog({ open, onClose, embedded = false, category }: Props) {
  const {
    toolConfig, setToolConfig,
    toolbarHiddenItems, setToolbarHiddenItems,
    toolbarPinnedTools, setToolbarPinnedTools,
    menuBarOrder, setMenuBarOrder,
    menuBarHidden, setMenuBarHidden,
    navigatorOpen, toggleNavigator, shelfOpen, toggleShelf,
    toolOrder, setToolOrder,
    toolbarMode, setToolbarMode,
    menuMode, setMenuMode,
  } = useEditorStore();

  // ALL hooks must run before this early return — a hook below it crashes
  // React ('Rendered more hooks than during the previous render').
  const { toolbarLeft: tbLeftRaw, toolbarRight: tbRightRaw, setToolbarZones } = useEditorStore();
  const { panelDividers, setPanelDividers } = useEditorStore();

  if (!open) return null;

  const cfgOf = (id: ToolId): ToolConfig =>
    toolConfig[id] ?? DEFAULT_TOOL_CONFIG[id] ?? { side: 'right', enabled: true };

  const setTool = (id: ToolId, patch: Partial<ToolConfig>) =>
    setToolConfig({ ...toolConfig, [id]: { ...cfgOf(id), ...patch } });

  const toggleHidden = (item: string) =>
    setToolbarHiddenItems(
      toolbarHiddenItems.includes(item)
        ? toolbarHiddenItems.filter((x) => x !== item)
        : [...toolbarHiddenItems, item],
    );

  // Ordered tool list for the dialog + docks (unlisted tools keep base order)
  const orderIdx = (id: string) => {
    const i = toolOrder.indexOf(id);
    return i === -1 ? 1000 + ALL_TOOLS.findIndex((t) => t.id === id) : i;
  };
  const orderedTools = [...ALL_TOOLS].sort((a, b) => orderIdx(a.id) - orderIdx(b.id));
  const menuIdx = (l: string) => {
    const i = menuBarOrder.indexOf(l);
    return i === -1 ? 100 + MENU_BAR_LABELS.indexOf(l) : i;
  };
  const orderedMenuLabels = [...MENU_BAR_LABELS].sort((a, b) => menuIdx(a) - menuIdx(b));

  const TB_DEFAULT_LEFT = ['g:history', 'g:element', 'g:insert', 'g:font', 'g:style', 'g:align', 'g:nav', 'g:notes'];
  const TB_DEFAULT_RIGHT = ['g:zoom', 'g:view'];
  const tbReady = tbLeftRaw.length > 0 || tbRightRaw.length > 0;
  const tbLeft = tbReady ? tbLeftRaw : [...TB_DEFAULT_LEFT, ...toolbarPinnedTools.map((id) => `t:${id}`)];
  const tbRight = tbReady ? tbRightRaw : TB_DEFAULT_RIGHT;
  const GROUP_LABELS: Record<string, string> = {
    history: 'Undo / Redo / Element… (editing)', element: 'Element dropdown', insert: 'Insert buttons',
    font: 'Font family & size', style: 'Text style & colors', align: 'Alignment',
    nav: 'Find & Go to Page', notes: 'Notes & Tags buttons', zoom: 'Zoom controls', view: 'Editor View dropdown',
  };
  const tokenLabel = (tok: string): string => {
    if (tok.startsWith('g:')) return GROUP_LABELS[tok.slice(2)] || tok;
    if (tok.startsWith('t:')) return ALL_TOOLS.find((t) => t.id === tok.slice(2))?.label || tok;
    if (tok.startsWith('c:')) return TOOLBAR_COMMANDS.find((c) => c.id === tok.slice(2))?.label || tok;
    return '— Divider —';
  };

  const addPanelDivider = (side: 'left' | 'right') => {
    const id = String(Date.now());
    setPanelDividers([...panelDividers, { id, label: '', side }]);
    setToolOrder([...toolOrder.length ? toolOrder : orderedTools.map((t) => t.id as string), `div:${id}`]);
  };
  const orderedWindows = orderedTools.filter((t) => WINDOW_IDS.includes(t.id));
  const orderedToolsOnly = orderedTools.filter((t) => !WINDOW_IDS.includes(t.id));

  /** Swap a tool with its neighbor within its own category (Windows or
   *  Tools), by swapping the two ids' positions in the global order. */
  const moveWithin = (list: typeof orderedTools, idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx].id as string;
    const b = list[j].id as string;
    const ids = orderedTools.map((t) => t.id as string);
    const ai = ids.indexOf(a);
    const bi = ids.indexOf(b);
    [ids[ai], ids[bi]] = [ids[bi], ids[ai]];
    setToolOrder(ids);
  };

  const togglePinned = (id: ToolId) =>
    setToolbarPinnedTools(
      toolbarPinnedTools.includes(id)
        ? toolbarPinnedTools.filter((x) => x !== id)
        : [...toolbarPinnedTools, id],
    );

  const body = (
        <div className="dialog-body fs-customize-body" style={embedded ? { padding: '4px 0 0', maxHeight: 'none', overflowY: 'visible' } : undefined}>
          {(!category) && <div className="fs-customize-cat">Menu Bar</div>}
          {(!category || category === 'menu') && (<>
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
          {(!category) && <div className="fs-customize-cat">Toolbar</div>}
          {(!category || category === 'toolbar') && (<>
          <section>
            <h3>Toolbar Layout</h3>
            <p className="fs-customize-hint">
              One list for the whole toolbar. Left flows from the left edge;
              Right sits at the far right. Built-in groups can move but not
              hide (Hide is greyed) — untick their individual items instead.
              Pins and dividers can do everything.
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
                const isGroup = tok.startsWith('g:');
                const items = isGroup ? (GROUP_TOKEN_ITEMS[tok.slice(2)] || []) : [];
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
                const hideTok = () => {
                  if (isGroup) return;
                  update(tokens.filter((_, i) => i !== idx));
                };
                return (
                  <React.Fragment key={`${tok}-${zone}-${idx}`}>
                    <div className="fs-customize-row">
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
                        <button disabled={isGroup} title={isGroup ? 'Built-in groups cannot be hidden — untick their items below' : 'Remove from the toolbar'} onClick={hideTok}>Hide</button>
                      </span>
                    </div>
                    {items.length > 0 && (
                      <div className="fs-customize-checks fs-tb-subitems">
                        {items.map((item) => (
                          <label key={item}>
                            <input
                              type="checkbox"
                              checked={!toolbarHiddenItems.includes(item)}
                              onChange={() => toggleHidden(item)}
                            />
                            {item}
                          </label>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
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
                <option value="">+ Pin window / tool / command…</option>
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
          {(!category) && <div className="fs-customize-cat">Side Panels</div>}
          {(!category || category === 'panels') && (<>
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
          <section>
            <h3>Project Windows</h3>
            <p className="fs-customize-hint">
              Project windows summarize your script and project. Pick where each
              one lives — hidden items stay available from the Project menu and
              open in a temporary panel.
            </p>
            <div className="fs-customize-grid">
              {orderedWindows.map((t, idx) => {
                const cfg = cfgOf(t.id);
                const value = cfg.enabled ? cfg.side : 'hidden';
                return (
                  <div key={t.id} className="fs-customize-row">
                    <span className="fs-customize-tool">
                      <span className="fs-customize-order">
                        <button title="Move up" onClick={() => moveWithin(orderedWindows, idx, -1)} disabled={idx === 0}>▲</button>
                        <button title="Move down" onClick={() => moveWithin(orderedWindows, idx, 1)} disabled={idx === orderedWindows.length - 1}>▼</button>
                      </span>
                      <span className="tool-dock-icon">{t.icon}</span>{t.label}
                    </span>
                    <span className="fs-customize-seg">
                      {(['left', 'right', 'hidden'] as const).map((opt) => (
                        <button
                          key={opt}
                          className={value === opt ? 'active' : ''}
                          onClick={() =>
                            setTool(t.id, opt === 'hidden'
                              ? { enabled: false }
                              : { enabled: true, side: opt })}
                        >
                          {opt === 'left' ? 'Left' : opt === 'right' ? 'Right' : 'Hide'}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h3>Tools</h3>
            <p className="fs-customize-hint">
              Everything that edits or manages, rather than summarizes. Hidden
              tools stay available from the Tools menu.
            </p>
            <div className="fs-customize-grid">
              {orderedToolsOnly.map((t, idx) => {
                const cfg = cfgOf(t.id);
                const value = cfg.enabled ? cfg.side : 'hidden';
                return (
                  <div key={t.id} className="fs-customize-row">
                    <span className="fs-customize-tool">
                      <span className="fs-customize-order">
                        <button title="Move up" onClick={() => moveWithin(orderedToolsOnly, idx, -1)} disabled={idx === 0}>▲</button>
                        <button title="Move down" onClick={() => moveWithin(orderedToolsOnly, idx, 1)} disabled={idx === orderedToolsOnly.length - 1}>▼</button>
                      </span>
                      <span className="tool-dock-icon">{t.icon}</span>{t.label}
                    </span>
                    <span className="fs-customize-seg">
                      {(['left', 'right', 'hidden'] as const).map((opt) => (
                        <button
                          key={opt}
                          className={value === opt ? 'active' : ''}
                          onClick={() =>
                            setTool(t.id, opt === 'hidden'
                              ? { enabled: false }
                              : { enabled: true, side: opt })}
                        >
                          {opt === 'left' ? 'Left' : opt === 'right' ? 'Right' : 'Hide'}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h3>Dividers</h3>
            <p className="fs-customize-hint">
              Divider lines for the side panels, with an optional small label.
              Reorder them among the windows and tools with the arrows.
            </p>
            {panelDividers.map((d) => {
              const tok = `div:${d.id}`;
              const order = toolOrder.length ? toolOrder : orderedTools.map((t) => t.id as string);
              const idx = order.indexOf(tok);
              const moveDiv = (dir: -1 | 1) => {
                if (idx === -1) return;
                const j = idx + dir;
                if (j < 0 || j >= order.length) return;
                const next = [...order];
                [next[idx], next[j]] = [next[j], next[idx]];
                setToolOrder(next);
              };
              return (
                <div key={d.id} className="fs-customize-row">
                  <span className="fs-customize-tool">
                    <span className="fs-customize-order">
                      <button title="Move up" onClick={() => moveDiv(-1)} disabled={idx <= 0}>▲</button>
                      <button title="Move down" onClick={() => moveDiv(1)} disabled={idx === -1 || idx === order.length - 1}>▼</button>
                    </span>
                    <input
                      className="fs-divider-label-input"
                      value={d.label}
                      placeholder="Label (optional)"
                      onChange={(e) => setPanelDividers(panelDividers.map((x) => x.id === d.id ? { ...x, label: e.target.value } : x))}
                    />
                  </span>
                  <span className="fs-customize-seg">
                    {(['left', 'right'] as const).map((opt) => (
                      <button
                        key={opt}
                        className={d.side === opt ? 'active' : ''}
                        onClick={() => setPanelDividers(panelDividers.map((x) => x.id === d.id ? { ...x, side: opt } : x))}
                      >{opt === 'left' ? 'Left' : 'Right'}</button>
                    ))}
                    <button onClick={() => {
                      setPanelDividers(panelDividers.filter((x) => x.id !== d.id));
                      setToolOrder((toolOrder.length ? toolOrder : []).filter((t) => t !== tok));
                    }}>Remove</button>
                  </span>
                </div>
              );
            })}
            <div className="fs-tbzone-adders">
              <button className="swn-add-btn" onClick={() => addPanelDivider('left')}>+ Divider in Left panel</button>
              <button className="swn-add-btn" onClick={() => addPanelDivider('right')}>+ Divider in Right panel</button>
            </div>
          </section>
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
