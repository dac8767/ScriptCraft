// v4.24 batch 7 (Derek): Scenes and Index Cards merged into ONE tool.
// "List" is the scene list (SceneNavigator's scenes view); "Cards" is the
// index-card grid (the old Index Cards tool, now embedded-only). The choice
// is store-held and persisted, so it survives unmounts and relaunches.
// v4.27: switching lives in the window's View control (SceneControls) — this
// is just the body.
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import SceneNavigator, { SceneTitleExtra, ScenesReorderControl } from './SceneNavigator';
import IndexCards from './IndexCards';
import { ChromeRow2 } from './ToolControls';

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

/** v4.32 batch-v8 #2: the Scenes fullscreen TAKEOVER — replaces the old
 *  position:fixed overlay that covered the whole app (toolbar, panels, close
 *  button and all) with no way out. Like the Characters takeover it fills
 *  ONLY the editor area (`.editor-center` swaps it in), so the toolbar's
 *  "Return to Editor" stays reachable, and its own header carries a close ×.
 *  The header reuses the window template rows: title + count (the same
 *  SceneTitleExtra the window renders) and the Reorder control — one source
 *  for each, no drift. Fullscreen is definitionally the card wall, so there
 *  is no View switch here. */
export function ScenesFullscreen({ editor, scrollContainer }: {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}) {
  const setFullscreen = useEditorStore((s) => s.setScenesFullscreen);
  return (
    <div className="fs-scenes-takeover">
      <div className="char-profiles-header char-fs-header">
        <span className="tool-window-zone tool-window-zone-l" />
        <span className="tool-window-zone tool-window-zone-c">
          <span className="char-profiles-title">Scenes</span>
          <SceneTitleExtra />
        </span>
        <span className="tool-window-zone tool-window-zone-r">
          <button className="char-profiles-close" onClick={() => setFullscreen(false)} title="Return to editor">&times;</button>
        </span>
      </div>
      <ChromeRow2 tabs={[]} className="tool-chrome-row2">
        <ScenesReorderControl />
      </ChromeRow2>
      <IndexCards editor={editor} scrollContainer={scrollContainer ?? null} />
    </div>
  );
}
