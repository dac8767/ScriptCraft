/**
 * Typewriter (v1.68) — Tools menu; dockable like any other tool.
 *
 * One switch: while it's on, the line you're typing on stays fixed at the
 * vertical center of the editor and the page scrolls under it (see
 * TypewriterScroll for the mechanics). The setting persists across restarts
 * like other view state.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { centerCaretLine } from '../editor/extensions/TypewriterScroll';

export default function TypewriterTool({ editor }: { editor: Editor | null }) {
  const typewriterEnabled = useEditorStore((s) => s.typewriterEnabled);
  const setTypewriterEnabled = useEditorStore((s) => s.setTypewriterEnabled);
  const followCursor = useEditorStore((s) => s.typewriterFollowCursor);
  const setFollowCursor = useEditorStore((s) => s.setTypewriterFollowCursor);

  const snapToCenter = () => {
    if (editor && !editor.isDestroyed) centerCaretLine(editor);
  };

  const toggle = (on: boolean) => {
    setTypewriterEnabled(on);
    // Snap to center right away so the mode visibly takes effect.
    if (on) snapToCenter();
  };

  return (
    <div className="fs-typewriter">
      <p className="fs-tool-intro">
        Typewriter mode keeps the line you're typing on fixed at the center of
        the screen — the page scrolls, your eyes don't. Centering happens as
        you type; clicking elsewhere still navigates normally.
      </p>
      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterEnabled}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Enable Typewriter mode</span>
      </label>
      {/* v1.70: sub-option — recenter on any cursor move, not just typing. */}
      <label className={`fs-typewriter-toggle fs-typewriter-sub${typewriterEnabled ? '' : ' disabled'}`}>
        <input
          type="checkbox"
          disabled={!typewriterEnabled}
          checked={followCursor}
          onChange={(e) => {
            setFollowCursor(e.target.checked);
            if (e.target.checked) snapToCenter();
          }}
        />
        <span>Also center when the cursor moves (clicks, arrow keys)</span>
      </label>
    </div>
  );
}
