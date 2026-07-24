// v4.24 batch 7 (Derek): Scenes and Index Cards merged into ONE tool.
// "List" is the scene list (SceneNavigator's scenes view); "Cards" is the
// index-card grid (the old Index Cards tool, now embedded-only). The choice
// is store-held and persisted, so it survives unmounts and relaunches.
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import SceneNavigator from './SceneNavigator';
import IndexCards from './IndexCards';

export function ScenesTool({ editor, scrollContainer }: {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}) {
  const mode = useEditorStore((s) => s.scenesViewMode);
  const setMode = useEditorStore((s) => s.setScenesViewMode);
  return (
    <div className="scenes-tool">
      {/* Same segmented style the Characters tool uses for Cards/List. */}
      <div className="scenes-view-toggle">
        <button
          className={`char-fs-view-btn${mode === 'list' ? ' active' : ''}`}
          onClick={() => setMode('list')}
        >
          List
        </button>
        <button
          className={`char-fs-view-btn${mode === 'cards' ? ' active' : ''}`}
          onClick={() => setMode('cards')}
        >
          Cards
        </button>
      </div>
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
