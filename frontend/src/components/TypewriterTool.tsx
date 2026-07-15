/**
 * Typewriter (v1.68, expanded v1.72) — Tools menu; dockable like any tool.
 *
 * v1.72 ports the option set of the obsidian-typewriter-mode plugin (see
 * TypewriterScroll.ts): a movable typewriter line, "only pin once reached",
 * a current-line highlight, and dimming of everything but the element being
 * edited. Highlight and dim are independent of the scrolling toggle, exactly
 * as in the source plugin. All settings persist like other view state.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { centerCaretLine, refreshTypewriterChrome } from '../editor/extensions/TypewriterScroll';

export default function TypewriterTool({ editor }: { editor: Editor | null }) {
  const {
    typewriterEnabled, setTypewriterEnabled,
    typewriterFollowCursor, setTypewriterFollowCursor,
    typewriterOffset, setTypewriterOffset,
    typewriterOnlyWhenReached, setTypewriterOnlyWhenReached,
    typewriterHighlightLine, setTypewriterHighlightLine,
    typewriterDimOthers, setTypewriterDimOthers,
  } = useEditorStore();

  const live = editor && !editor.isDestroyed ? editor : null;
  const snapToCenter = () => { if (live) centerCaretLine(live); };
  const refreshChrome = () => { if (live) refreshTypewriterChrome(live); };
  /** Dim decorations recompute on the next transaction — force one so the
   *  toggle takes effect immediately, not on the next keystroke. */
  const nudge = () => { if (live) live.view.dispatch(live.state.tr); };

  return (
    <div className="fs-typewriter">
      <p className="fs-tool-intro">
        Typewriter mode keeps the line you're typing on fixed on screen — the
        page scrolls, your eyes don't. Centering happens as you type; clicking
        elsewhere still navigates normally.
      </p>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterEnabled}
          onChange={(e) => {
            setTypewriterEnabled(e.target.checked);
            if (e.target.checked) snapToCenter(); else refreshChrome();
          }}
        />
        <span>Enable Typewriter mode</span>
      </label>

      <label className={`fs-typewriter-toggle fs-typewriter-sub${typewriterEnabled ? '' : ' disabled'}`}>
        <input
          type="checkbox"
          disabled={!typewriterEnabled}
          checked={typewriterFollowCursor}
          onChange={(e) => {
            setTypewriterFollowCursor(e.target.checked);
            if (e.target.checked) snapToCenter();
          }}
        />
        <span>Also center when the cursor moves (clicks, arrow keys)</span>
      </label>

      <label className={`fs-typewriter-toggle fs-typewriter-sub${typewriterEnabled ? '' : ' disabled'}`}>
        <input
          type="checkbox"
          disabled={!typewriterEnabled}
          checked={typewriterOnlyWhenReached}
          onChange={(e) => { setTypewriterOnlyWhenReached(e.target.checked); snapToCenter(); }}
        />
        <span>Only pin once the line is first reached</span>
      </label>

      <div className={`fs-typewriter-offset fs-typewriter-sub${typewriterEnabled ? '' : ' disabled'}`}>
        <span>Line position</span>
        <input
          type="range"
          min={20}
          max={80}
          step={5}
          disabled={!typewriterEnabled}
          value={Math.round(typewriterOffset * 100)}
          onChange={(e) => { setTypewriterOffset(Number(e.target.value) / 100); snapToCenter(); }}
        />
        <span className="fs-typewriter-offset-val">{Math.round(typewriterOffset * 100)}%</span>
      </div>
      <p className="prefs-hint fs-typewriter-sub">
        Where the pinned line sits, measured from the top of the editor.
      </p>

      <div className="fs-typewriter-divider" />

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterHighlightLine}
          onChange={(e) => { setTypewriterHighlightLine(e.target.checked); refreshChrome(); }}
        />
        <span>Highlight the current line</span>
      </label>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterDimOthers}
          onChange={(e) => { setTypewriterDimOthers(e.target.checked); nudge(); }}
        />
        <span>Dim everything but the current element</span>
      </label>
    </div>
  );
}
