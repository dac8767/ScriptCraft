/**
 * Typewriter (v1.68 → v1.74) — Tools menu; dockable like any tool.
 *
 * v1.74 completes the port of obsidian-typewriter-mode's option set into the
 * panel, per Derek's list: typewriter scrolling, current-line highlighting,
 * keep-N-lines-above-and-below, element/sentence dimming, fullscreen writing
 * focus, line-length limit, restore-cursor-position, and Hemingway mode
 * (which is an untimed Vomit Draft lock under the hood — one enforcement
 * path, two entrances). Everything except Writing Focus persists; a mode
 * that relaunches you into fullscreen would be hostile.
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useVomitStore } from '../stores/vomitStore';
import { vomitFloorFor } from '../editor/extensions/VomitLock';
import { centerCaretLine, refreshTypewriterChrome } from '../editor/extensions/TypewriterScroll';
import { showToast } from './Toast';

export default function TypewriterTool({ editor }: { editor: Editor | null }) {
  const {
    typewriterEnabled, setTypewriterEnabled,
    typewriterFollowCursor, setTypewriterFollowCursor,
    typewriterOffset, setTypewriterOffset,
    typewriterOnlyWhenReached, setTypewriterOnlyWhenReached,
    typewriterHighlightLine, setTypewriterHighlightLine,
    typewriterDimOthers, setTypewriterDimOthers,
    typewriterDimMode, setTypewriterDimMode,
    typewriterKeepLinesEnabled, setTypewriterKeepLinesEnabled,
    typewriterKeepLinesCount, setTypewriterKeepLinesCount,
    typewriterLimitLine, setTypewriterLimitLine,
    typewriterMaxChars, setTypewriterMaxChars,
    typewriterRestoreCursor, setTypewriterRestoreCursor,
    writingFocus, setWritingFocus,
  } = useEditorStore();
  const vomitSession = useVomitStore((s) => s.session);
  const hemingwayOn = !!vomitSession && vomitSession.endsAt === null;
  const timedSprintOn = !!vomitSession && vomitSession.endsAt !== null;

  const live = editor && !editor.isDestroyed ? editor : null;
  const snapToCenter = () => { if (live) centerCaretLine(live); };
  const refreshChrome = () => { if (live) refreshTypewriterChrome(live); };
  /** Dim decorations recompute on the next transaction — force one so a
   *  toggle takes effect immediately, not on the next keystroke. */
  const nudge = () => { if (live) live.view.dispatch(live.state.tr); };

  const toggleHemingway = (on: boolean) => {
    if (!live) return;
    if (on) {
      useVomitStore.getState().start(null, vomitFloorFor(live.state.doc));
      live.commands.focus('end');
    } else {
      useVomitStore.getState().end();
      showToast('Hemingway mode off — full editing is back.', 'info');
    }
  };

  return (
    <div className="fs-typewriter">
      <p className="fs-tool-intro">
        Typewriter mode keeps the line you're typing on fixed on screen — the
        page scrolls, your eyes don't.
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
        <span>Also center when the cursor moves</span>
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

      <label className={`fs-typewriter-toggle${typewriterEnabled ? ' disabled' : ''}`} style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          disabled={typewriterEnabled}
          checked={typewriterKeepLinesEnabled}
          onChange={(e) => setTypewriterKeepLinesEnabled(e.target.checked)}
        />
        <span>Keep lines above and below the cursor</span>
      </label>
      <div className={`fs-typewriter-offset fs-typewriter-sub${!typewriterEnabled && typewriterKeepLinesEnabled ? '' : ' disabled'}`}>
        <span>Lines</span>
        <input
          type="number"
          min={1}
          max={15}
          disabled={typewriterEnabled || !typewriterKeepLinesEnabled}
          value={typewriterKeepLinesCount}
          onChange={(e) => setTypewriterKeepLinesCount(Number(e.target.value))}
          style={{ width: 52, flex: 'none' }}
        />
      </div>
      <p className="prefs-hint fs-typewriter-sub">
        The gentler mode: only scrolls when the cursor nears an edge.
        Typewriter scrolling takes over while it's on.
      </p>

      <div className="fs-typewriter-section">Focus</div>

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
        <span>Dim unfocused text</span>
      </label>
      <div className={`fs-typewriter-offset fs-typewriter-sub${typewriterDimOthers ? '' : ' disabled'}`}>
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

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={writingFocus}
          onChange={(e) => setWritingFocus(e.target.checked)}
        />
        <span>Writing focus (fullscreen, chrome hidden — Esc leaves)</span>
      </label>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterLimitLine}
          onChange={(e) => setTypewriterLimitLine(e.target.checked)}
        />
        <span>Limit line length</span>
      </label>
      <div className={`fs-typewriter-offset fs-typewriter-sub${typewriterLimitLine ? '' : ' disabled'}`}>
        <span>Max</span>
        <input
          type="number"
          min={20}
          max={90}
          disabled={!typewriterLimitLine}
          value={typewriterMaxChars}
          onChange={(e) => setTypewriterMaxChars(Number(e.target.value))}
          style={{ width: 56, flex: 'none' }}
        />
        <span>characters</span>
      </div>
      <p className="prefs-hint fs-typewriter-sub">
        On-screen wrapping only — but page breaks follow what you see while
        it's on.
      </p>

      <div className="fs-typewriter-section">Writing</div>

      <label className="fs-typewriter-toggle">
        <input
          type="checkbox"
          checked={typewriterRestoreCursor}
          onChange={(e) => setTypewriterRestoreCursor(e.target.checked)}
        />
        <span>Restore cursor position when opening a script</span>
      </label>

      <label className={`fs-typewriter-toggle${timedSprintOn ? ' disabled' : ''}`}>
        <input
          type="checkbox"
          disabled={timedSprintOn || !live}
          checked={hemingwayOn}
          onChange={(e) => toggleHemingway(e.target.checked)}
        />
        <span>Hemingway mode (write forwards only, no timer)</span>
      </label>
      <p className="prefs-hint fs-typewriter-sub">
        {timedSprintOn
          ? 'A timed Vomit Draft sprint is running — it owns the lock right now.'
          : 'The same lock as Vomit Draft, without the clock. Turn it off here when you\'re done.'}
      </p>
    </div>
  );
}
