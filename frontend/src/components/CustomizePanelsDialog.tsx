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
import { useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolConfig } from '../stores/editorStore';
import { ALL_TOOLS, WINDOW_IDS } from './ToolDock';

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

interface Props {
  open: boolean;
  onClose: () => void;
  /** Render only the content (no overlay/box) — used inside Preferences. */
  embedded?: boolean;
}

export default function CustomizePanelsDialog({ open, onClose, embedded = false }: Props) {
  const {
    toolConfig, setToolConfig,
    toolbarHiddenItems, setToolbarHiddenItems,
    toolbarPinnedTools, setToolbarPinnedTools,
    navigatorOpen, toggleNavigator, shelfOpen, toggleShelf,
    toolOrder, setToolOrder,
    toolbarMode, setToolbarMode,
  } = useEditorStore();

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
          <section>
            <h3>Layout</h3>
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
            <div className="fs-customize-row">
              <span className="fs-customize-tool">Menu &amp; toolbar mode</span>
              <span className="fs-customize-seg">
                {(['compact', 'comfortable', 'hidden'] as const).map((m) => (
                  <button key={m} className={toolbarMode === m ? 'active' : ''} onClick={() => setToolbarMode(m)}>
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </span>
            </div>
          </section>

          <section>
            <h3>Project</h3>
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
            <h3>Toolbar — pinned tools</h3>
            <p className="fs-customize-hint">
              Pinned tools appear as buttons to the right of Production Tags.
            </p>
            <div className="fs-customize-checks">
              {[
                ...toolbarPinnedTools.map((id) => ALL_TOOLS.find((t) => t.id === id)).filter(Boolean) as typeof ALL_TOOLS,
                ...ALL_TOOLS.filter((t) => !toolbarPinnedTools.includes(t.id)),
              ].map((t) => {
                const pinnedIdx = toolbarPinnedTools.indexOf(t.id);
                const movePinned = (dir: -1 | 1) => {
                  const j = pinnedIdx + dir;
                  if (pinnedIdx < 0 || j < 0 || j >= toolbarPinnedTools.length) return;
                  const next = [...toolbarPinnedTools];
                  [next[pinnedIdx], next[j]] = [next[j], next[pinnedIdx]];
                  setToolbarPinnedTools(next);
                };
                return (
                  <label key={t.id} className="fs-customize-pin-row">
                    <input
                      type="checkbox"
                      checked={pinnedIdx >= 0}
                      onChange={() => togglePinned(t.id)}
                    />
                    <span style={{ flex: 1 }}>{t.label}</span>
                    {pinnedIdx >= 0 && (
                      <span className="fs-pin-order">
                        <button type="button" title="Move left on the toolbar" disabled={pinnedIdx === 0} onClick={(e) => { e.preventDefault(); movePinned(-1); }}>▲</button>
                        <button type="button" title="Move right on the toolbar" disabled={pinnedIdx === toolbarPinnedTools.length - 1} onClick={(e) => { e.preventDefault(); movePinned(1); }}>▼</button>
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Toolbar — built-in items</h3>
            <p className="fs-customize-hint">Unchecked items are removed from the toolbar.</p>
            <div className="fs-customize-boxes">
              {TOOLBAR_GROUPS.map((group) => (
                <div className="fs-customize-box" key={group.name}>
                  {group.items.map((item) => (
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
              ))}
            </div>
          </section>
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
