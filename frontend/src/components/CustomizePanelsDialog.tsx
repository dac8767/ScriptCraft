/**
 * CustomizePanelsDialog — View → Customize Toolbar & Panels.
 *
 * Panels: each tool can live in the Left panel, the Right panel, or be Hidden.
 * (Defaults: script-structure tools left; notes/analytics/goals right.)
 * Hidden tools stay reachable from the Tools menu, opening as a temporary
 * window.
 *
 * Toolbar: pin any tool as a button (appears right of Production Tags), and
 * deactivate any built-in toolbar item. Ported from FreeScript v5.5's
 * Customize Toolbar.
 */
import { useEditorStore, DEFAULT_TOOL_CONFIG, type ToolId, type ToolConfig } from '../stores/editorStore';
import { ALL_TOOLS } from './ToolDock';

/** Built-in toolbar items that can be deactivated (matched by title prefix). */
const TOOLBAR_ITEMS: string[] = [
  'Undo', 'Redo', 'Font Size', 'Bold', 'Italic', 'Underline', 'Strikethrough',
  'Subscript', 'Superscript', 'Text Color', 'Highlight Color',
  'Align Left', 'Align Center', 'Align Right', 'Justify',
  'Find & Replace', 'Go to Page', 'Zoom Out', 'Zoom In', 'Zoom',
  'Script Notes', 'Production Tags',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CustomizePanelsDialog({ open, onClose }: Props) {
  const {
    toolConfig, setToolConfig,
    toolbarHiddenItems, setToolbarHiddenItems,
    toolbarPinnedTools, setToolbarPinnedTools,
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

  const togglePinned = (id: ToolId) =>
    setToolbarPinnedTools(
      toolbarPinnedTools.includes(id)
        ? toolbarPinnedTools.filter((x) => x !== id)
        : [...toolbarPinnedTools, id],
    );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog fs-customize-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Customize Toolbar &amp; Panels</h2>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body fs-customize-body">
          <section>
            <h3>Panels</h3>
            <p className="fs-customize-hint">
              Pick where each tool lives. Hidden tools stay available from the Tools
              menu and open in a temporary window.
            </p>
            <div className="fs-customize-grid">
              {ALL_TOOLS.map((t) => {
                const cfg = cfgOf(t.id);
                const value = cfg.enabled ? cfg.side : 'hidden';
                return (
                  <div key={t.id} className="fs-customize-row">
                    <span className="fs-customize-tool">
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
                          {opt === 'left' ? 'Left' : opt === 'right' ? 'Right' : 'Hidden'}
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
              {ALL_TOOLS.map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    checked={toolbarPinnedTools.includes(t.id)}
                    onChange={() => togglePinned(t.id)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3>Toolbar — built-in items</h3>
            <p className="fs-customize-hint">Unchecked items are removed from the toolbar.</p>
            <div className="fs-customize-checks">
              {TOOLBAR_ITEMS.map((item) => (
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
          </section>
        </div>
      </div>
    </div>
  );
}
