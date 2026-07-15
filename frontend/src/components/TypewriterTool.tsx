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
    typewriterHighlightLine, setTypewriterHighlightLine,
    typewriterHighlightColor, setTypewriterHighlightColor,
    typewriterDimOthers, setTypewriterDimOthers,
    typewriterDimMode, setTypewriterDimMode,
    typewriterDimOpacity, setTypewriterDimOpacity,
    writingFocus, setWritingFocus,
    typewriterMasterEnabled, setTypewriterMasterEnabled,
  } = useEditorStore();
  const off = !typewriterMasterEnabled;

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

      {/* v1.84: the master switch. Sub-options keep their checked state, so
          flipping this back on restores exactly the setup you had. */}
      <label className="fs-typewriter-toggle fs-typewriter-master">
        <input
          type="checkbox"
          checked={typewriterMasterEnabled}
          onChange={(e) => {
            setTypewriterMasterEnabled(e.target.checked);
            if (!e.target.checked) setWritingFocus(false);
            refreshChrome();
            nudge();
            if (e.target.checked && typewriterEnabled) snapToCenter();
          }}
        />
        <span>Enable Typewriter tool</span>
      </label>

      <div className="fs-typewriter-section">Scrolling</div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          disabled={off}
          checked={typewriterEnabled}
          onChange={(e) => {
            setTypewriterEnabled(e.target.checked);
            if (e.target.checked) snapToCenter(); else refreshChrome();
          }}
        />
        <span>Typewriter scrolling</span>
      </label>

      <div className={`fs-typewriter-subgroup${typewriterEnabled && !off ? '' : ' disabled'}`}>
        <label className="fs-typewriter-toggle">
          <input
            type="checkbox"
            disabled={off || !typewriterEnabled}
            checked={typewriterFollowCursor}
            onChange={(e) => {
              setTypewriterFollowCursor(e.target.checked);
              if (e.target.checked) snapToCenter();
            }}
          />
          <span>Also center when the cursor moves</span>
        </label>

        <div className="fs-typewriter-offset">
          <span>Line position</span>
          <input
            type="range"
            min={20}
            max={80}
            step={5}
            disabled={off || !typewriterEnabled}
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
          disabled={off}
          checked={typewriterHighlightLine}
          onChange={(e) => { setTypewriterHighlightLine(e.target.checked); refreshChrome(); }}
        />
        <span>Highlight the current line</span>
      </label>
      <div className={`fs-typewriter-subgroup${typewriterHighlightLine && !off ? '' : ' disabled'}`}>
        <div className="fs-typewriter-offset">
          <span>Color</span>
          <span className="fs-typewriter-swatches">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                className={`fs-typewriter-swatch${typewriterHighlightColor.toLowerCase() === c ? ' active' : ''}`}
                style={{ background: c }}
                disabled={off || !typewriterHighlightLine}
                title={c}
                onClick={() => { setTypewriterHighlightColor(c); refreshChrome(); }}
              />
            ))}
            <input
              type="color"
              className="fs-typewriter-swatch-custom"
              disabled={off || !typewriterHighlightLine}
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
          disabled={off}
          checked={typewriterDimOthers}
          onChange={(e) => { setTypewriterDimOthers(e.target.checked); nudge(); }}
        />
        <span>Dim unfocused text</span>
      </label>
      <div className={`fs-typewriter-subgroup${typewriterDimOthers && !off ? '' : ' disabled'}`}>
        <div className="fs-typewriter-offset">
          <span>Keep bright</span>
          <select
            disabled={off || !typewriterDimOthers}
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
            disabled={off || !typewriterDimOthers}
            value={Math.round(typewriterDimOpacity * 100)}
            onChange={(e) => setTypewriterDimOpacity(Number(e.target.value) / 100)}
          />
          <span className="fs-typewriter-offset-val">{Math.round(typewriterDimOpacity * 100)}%</span>
        </div>
      </div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          disabled={off}
          checked={writingFocus}
          onChange={(e) => setWritingFocus(e.target.checked)}
        />
        <span>Extreme focus (fullscreen, everything hidden)</span>
      </label>
    </div>
  );
}
