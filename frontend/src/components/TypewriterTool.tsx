/**
 * Typewriter (v1.68 → v1.77) — Tools menu; dockable like any tool.
 *
 * The window stays open when you click into the editor (keepOpenOnEditorClick
 * in ALL_TOOLS): these options are tuned WHILE writing. v1.77 also slimmed
 * the panel per Derek — line-length limit and keep-lines are gone, Hemingway
 * mode lives in Vomit Draft, and restore-cursor moved to Settings > General.
 * The "Dim unfocused text" sub-options (what stays bright + how faint the
 * rest goes) are visually nested under their parent toggle.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { centerCaretLine, refreshTypewriterChrome } from '../editor/extensions/TypewriterScroll';

/** Highlight tints — rendered ~30% over the white page, so mid-brightness
 *  hues read best. The color input at the end covers everything else. */
const HIGHLIGHT_COLORS = ['#4a9eff', '#f5d90a', '#34c759', '#ff9f0a', '#ff6ba9', '#9a9a9a'];

export default function TypewriterTool({ editor }: { editor: Editor | null }) {
  const {
    typewriterEnabled, setTypewriterEnabled,
    typewriterFollowCursor, setTypewriterFollowCursor,
    typewriterOffset, setTypewriterOffset,
    typewriterOnlyWhenReached, setTypewriterOnlyWhenReached,
    typewriterHighlightLine, setTypewriterHighlightLine,
    typewriterHighlightColor, setTypewriterHighlightColor,
    typewriterDimOthers, setTypewriterDimOthers,
    typewriterDimMode, setTypewriterDimMode,
    typewriterDimOpacity, setTypewriterDimOpacity,
    writingFocus, setWritingFocus,
  } = useEditorStore();

  const live = editor && !editor.isDestroyed ? editor : null;
  const snapToCenter = () => { if (live) centerCaretLine(live); };
  const refreshChrome = () => { if (live) refreshTypewriterChrome(live); };
  /** Dim decorations recompute on the next transaction — force one so a
   *  toggle takes effect immediately, not on the next keystroke. */
  const nudge = () => { if (live) live.view.dispatch(live.state.tr); };

  return (
    <div className="fs-typewriter">
      <p className="fs-tool-intro">
        Typewriter mode keeps the line you're typing on fixed on screen — the
        page scrolls, your eyes don't. This window stays open while you write.
      </p>

      <div className="fs-typewriter-section">Scrolling</div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterEnabled}
          onChange={(e) => {
            setTypewriterEnabled(e.target.checked);
            if (e.target.checked) snapToCenter(); else refreshChrome();
          }}
        />
        <span>Typewriter scrolling</span>
      </label>

      <div className={`fs-typewriter-subgroup${typewriterEnabled ? '' : ' disabled'}`}>
        <label className="fs-typewriter-toggle">
          <input
            type="checkbox"
            disabled={!typewriterEnabled}
            checked={typewriterFollowCursor}
            onChange={(e) => {
              setTypewriterFollowCursor(e.target.checked);
              if (e.target.checked) snapToCenter();
            }}
          />
          <span>Also center when the cursor moves</span>
        </label>

        <label className="fs-typewriter-toggle">
          <input
            type="checkbox"
            disabled={!typewriterEnabled}
            checked={typewriterOnlyWhenReached}
            onChange={(e) => { setTypewriterOnlyWhenReached(e.target.checked); snapToCenter(); }}
          />
          <span>Only pin once the line is first reached</span>
        </label>

        <div className="fs-typewriter-offset">
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
      </div>

      <div className="fs-typewriter-section">Focus</div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterHighlightLine}
          onChange={(e) => { setTypewriterHighlightLine(e.target.checked); refreshChrome(); }}
        />
        <span>Highlight the current line</span>
      </label>
      <div className={`fs-typewriter-subgroup${typewriterHighlightLine ? '' : ' disabled'}`}>
        <div className="fs-typewriter-offset">
          <span>Color</span>
          <span className="fs-typewriter-swatches">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                className={`fs-typewriter-swatch${typewriterHighlightColor.toLowerCase() === c ? ' active' : ''}`}
                style={{ background: c }}
                disabled={!typewriterHighlightLine}
                title={c}
                onClick={() => { setTypewriterHighlightColor(c); refreshChrome(); }}
              />
            ))}
            <input
              type="color"
              className="fs-typewriter-swatch-custom"
              disabled={!typewriterHighlightLine}
              value={typewriterHighlightColor}
              title="Custom color"
              onChange={(e) => { setTypewriterHighlightColor(e.target.value); refreshChrome(); }}
            />
          </span>
        </div>
      </div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterDimOthers}
          onChange={(e) => { setTypewriterDimOthers(e.target.checked); nudge(); }}
        />
        <span>Dim unfocused text</span>
      </label>
      <div className={`fs-typewriter-subgroup${typewriterDimOthers ? '' : ' disabled'}`}>
        <div className="fs-typewriter-offset">
          <span>Keep bright</span>
          <select
            disabled={!typewriterDimOthers}
            value={typewriterDimMode}
            onChange={(e) => { setTypewriterDimMode(e.target.value as 'elements' | 'sentences'); nudge(); }}
          >
            <option value="elements">Current element</option>
            <option value="sentences">Current sentence</option>
          </select>
        </div>
        <div className="fs-typewriter-offset">
          <span>Dimmed to</span>
          <input
            type="range"
            min={5}
            max={70}
            step={5}
            disabled={!typewriterDimOthers}
            value={Math.round(typewriterDimOpacity * 100)}
            onChange={(e) => setTypewriterDimOpacity(Number(e.target.value) / 100)}
          />
          <span className="fs-typewriter-offset-val">{Math.round(typewriterDimOpacity * 100)}%</span>
        </div>
      </div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={writingFocus}
          onChange={(e) => setWritingFocus(e.target.checked)}
        />
        <span>Writing focus (fullscreen, chrome hidden — Esc leaves)</span>
      </label>
    </div>
  );
}
