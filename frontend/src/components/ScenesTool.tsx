// v4.24 batch 7 (Derek): Scenes and Index Cards merged into ONE tool.
// "List" is the scene list (SceneNavigator's scenes view); "Cards" is the
// index-card grid (the old Index Cards tool, now embedded-only). The choice
// is store-held and persisted, so it survives unmounts and relaunches.
// v4.27: switching lives in the window's View control (SceneControls) — this
// is just the body.
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { CARDS_PER_ROW_MAX, CARDS_PER_ROW_MIN } from '../stores/slices/sceneNavSlice';
import SceneNavigator, { ScenesReorderControl } from './SceneNavigator';
import IndexCards from './IndexCards';
import { ToolActionRow } from './ToolControls';
import { CircleMinusIcon, CirclePlusIcon } from './uiIcons';

export function ScenesTool({ editor, scrollContainer }: {
  editor: Editor | null;
  scrollContainer?: HTMLDivElement | null;
}) {
  const mode = useEditorStore((s) => s.scenesViewMode);
  const cardsPerRow = useEditorStore((s) => s.cardsPerRow);
  const setCardsPerRow = useEditorStore((s) => s.setCardsPerRow);
  return (
    <div className="scenes-tool">
      {/* v5.01, Derek: Reorder is the Scenes tool's OWN action, so it sits in
          the first row of the body rather than in the shared header cluster.
          Here (not in SceneNavigator) because it drives BOTH views.
          v5.23, Derek: every "x per row" stepper is RIGHT-aligned and the
          row's former right occupant swaps left — so Reorder leads and the
          card view's stepper holds the right edge. */}
      <ToolActionRow>
        <ScenesReorderControl />
        {mode === 'cards' && (
          <span className="tool-action-group tool-action-right">
            <span className="tool-action-label" id="scenes-cardsrow-label">Cards per row:</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="Fewer cards per row (bigger cards)"
              disabled={cardsPerRow <= CARDS_PER_ROW_MIN}
              onClick={() => setCardsPerRow(cardsPerRow - 1)}
            ><CircleMinusIcon /></button>
            <span className="tool-action-count" aria-labelledby="scenes-cardsrow-label">{cardsPerRow}</span>
            <button
              className="tool-action-btn tool-action-icon"
              title="More cards per row (smaller cards)"
              disabled={cardsPerRow >= CARDS_PER_ROW_MAX}
              onClick={() => setCardsPerRow(cardsPerRow + 1)}
            ><CirclePlusIcon /></button>
          </span>
        )}
      </ToolActionRow>
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
