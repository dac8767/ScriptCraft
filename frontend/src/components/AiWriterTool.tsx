/**
 * AI Writer (v1.69) — Derek's joke tool. It does exactly one thing,
 * and that thing is not writing your script.
 *
 * v2.75: a footer button removes it from the sidebar — the SAME
 * remove-and-stash hide Customize's Hidden column uses (enabled: false),
 * so it comes back from Customize > Panels like any other tool.
 */
import { useEditorStore } from '../stores/editorStore';

export default function AiWriterTool() {
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
      <div className="fs-aiwriter-footer">
        <button className="fs-aiwriter-remove" onClick={removeFromSidebar}>
          Remove AI Writer from the side bar
        </button>
      </div>
    </div>
  );
}
