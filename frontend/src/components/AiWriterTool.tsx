/**
 * AI Writer (v1.69) — Derek's joke tool. It does exactly one thing,
 * and that thing is not writing your script.
 *
 * v2.75: a footer button removes it from the sidebar — the SAME
 * remove-and-stash hide Customize's Hidden column uses (enabled: false),
 * so it comes back from Customize > Panels like any other tool.
 * v5.45, Derek: the button shows ONLY while the tool sits in a side
 * panel ("Remove AI Writer from side panel"); popped out as a floating
 * window there's no button — the panel is what it removes from.
 */
import { useEditorStore } from '../stores/editorStore';

export default function AiWriterTool() {
  // ToolContent renders this body in the dock AND in floating windows —
  // the mode (plus the no-dock-home temp float) says which one this is.
  const inPanel = useEditorStore(
    (s) => (s.toolMode.aiwriter ?? 'docked') === 'docked' && s.tempTool !== 'aiwriter',
  );
  const removeFromSidebar = () => {
    const s = useEditorStore.getState();
    s.setToolConfig({
      ...s.toolConfig,
      aiwriter: { ...(s.toolConfig.aiwriter ?? { side: 'right', enabled: true }), enabled: false },
    });
    // If it's the open tool anywhere, close that window too.
    if (s.activeTool === 'aiwriter') s.setActiveTool(null);
    if (s.activeToolRight === 'aiwriter') s.setActiveToolRight(null);
    if (s.tempTool === 'aiwriter') s.setTempTool(null);
  };

  return (
    <div className="fs-aiwriter">
      <p>Write your own damn script.</p>
      {inPanel && (
        <div className="fs-aiwriter-footer">
          <button className="fs-aiwriter-remove" onClick={removeFromSidebar}>
            Remove AI Writer from side panel
          </button>
        </div>
      )}
    </div>
  );
}
