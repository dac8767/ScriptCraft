// v4.24 batch 7 (Derek): Scenes and Index Cards merged into ONE tool.
// "List" is the scene list (SceneNavigator's scenes view); "Cards" is the
// index-card grid (the old Index Cards tool, now embedded-only). The choice
// is store-held and persisted, so it survives unmounts and relaunches.
// v4.27: switching lives in the window's View control (SceneControls) — this
// is just the body.
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import SceneNavigator, { ScenesReorderControl } from './SceneNavigator';
import IndexCards from './IndexCards';
import { ToolActionRow } from './ToolControls';

export function ScenesTool({ editor, scrollContainer }: {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}) {
  const mode = useEditorStore((s) => s.scenesViewMode);
  return (
    <div className="scenes-tool">
      {/* v5.01, Derek: Reorder is the Scenes tool's OWN action, so it sits in
          the first row of the body rather than in the shared header cluster.
          Here (not in SceneNavigator) because it drives BOTH views. */}
      <ToolActionRow><ScenesReorderControl /></ToolActionRow>
      <div className="scenes-tool-body">
        {mode === 'cards' ? (
          <IndexCards editor={editor} />
        ) : (
          <SceneNavigator editor={editor} scrollContainer={scrollContainer} view="scenes" />
        )}
      </div>
    </div>
  );
}

// (v4.35 batch-v9 #4: the bespoke ScenesFullscreen takeover is gone — the
// generic ToolFullscreenTakeover in ToolDock renders every tool's fullscreen
// from the same TOOL_CHROME registry and this same ScenesTool body.)
