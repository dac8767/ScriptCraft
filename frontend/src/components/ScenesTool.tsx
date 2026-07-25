// v4.24 batch 7 (Derek): Scenes and Index Cards merged into ONE tool.
// "List" is the scene list (SceneNavigator's scenes view); "Cards" is the
// index-card grid (the old Index Cards tool, now embedded-only). The choice
// is store-held and persisted, so it survives unmounts and relaunches.
// v4.27: switching lives in the window's View control (SceneControls) — this
// is just the body.
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import SceneNavigator from './SceneNavigator';
import IndexCards from './IndexCards';

export function ScenesTool({ editor, scrollContainer }: {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}) {
  const mode = useEditorStore((s) => s.scenesViewMode);
  return (
    <div className="scenes-tool">
      <div className="scenes-tool-body">
        {mode === 'cards' ? (
          <IndexCards editor={editor} scrollContainer={scrollContainer ?? null} />
        ) : (
          <SceneNavigator editor={editor} scrollContainer={scrollContainer} view="scenes" />
        )}
      </div>
    </div>
  );
}
