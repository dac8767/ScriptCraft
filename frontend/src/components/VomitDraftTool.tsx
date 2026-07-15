/**
 * Vomit Draft (v1.62) — Tools menu; dockable like any other tool.
 *
 * A timed no-editing writing sprint: pick an amount of time (30-minute
 * presets or a custom count) or an end time, hit Start, and until the timer
 * runs out previous text is locked — you can only keep writing (the line
 * you're currently on stays workable; see VomitLock for the exact rule).
 * Saving and exporting work as normal throughout. When time is up, full
 * editing returns.
 *
 * The countdown renders here AND as a floating pill over the editor
 * (VomitTimerPill), so the timer is always visible even with the panel
 * closed. The pill pulses red when a locked edit is rejected.
 */
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useVomitStore } from '../stores/vomitStore';
import { vomitFloorFor } from '../editor/extensions/VomitLock';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import TimeField from './TimeField';
import { showToast } from './Toast';

function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtClock(ms: number): string {
  // v1.73: follows Settings > General > Time format.
  const hour12 = useSettingsStore.getState().timeFormat === '12h';
  return new Date(ms).toLocaleTimeString([], { hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hour12 });
}

/** Ticks once a second while a sprint runs; ends the session when time is up.
 *  Hemingway sessions (endsAt null, v1.74) have no clock and never self-end. */
function useSprintClock(): number {
  const session = useVomitStore((s) => s.session);
  const [, force] = useState(0);
  useEffect(() => {
    if (!session || session.endsAt === null) return;
    const t = setInterval(() => {
      if (Date.now() >= session.endsAt!) {
        useVomitStore.getState().end();
        showToast('Time! Vomit Draft is over — full editing is back.', 'success');
      } else {
        force((x) => x + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [session]);
  return session && session.endsAt !== null ? Math.max(0, session.endsAt - Date.now()) : 0;
}

/**
 * Floating countdown over the editor — mounted once in ScreenplayEditor and
 * self-hiding when no sprint runs. This is what guarantees "the timer should
 * appear": it shows regardless of whether the tool window is open. Clicking
 * it opens the tool. It owns the end-of-sprint tick, so the sprint completes
 * even with the panel closed.
 */
export function VomitTimerPill() {
  const session = useVomitStore((s) => s.session);
  const blockedTick = useVomitStore((s) => s.blockedTick);
  const remaining = useSprintClock();
  const [pulse, setPulse] = useState(false);
  const firstTick = useRef(true);

  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return; }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [blockedTick]);

  if (!session) return null;
  const hemingway = session.endsAt === null;
  return (
    <button
      className={`fs-vomit-pill${pulse ? ' blocked' : ''}`}
      title={hemingway
        ? 'Hemingway mode — previous text is locked until you turn it off (Vomit Draft tool).'
        : 'Vomit Draft is running — previous text is locked. Click to open the tool.'}
      onClick={() => useEditorStore.getState().openTool('vomit')}
    >
      <span className="fs-vomit-pill-icon" aria-hidden="true">🔒</span>
      <span className="fs-vomit-pill-time">{hemingway ? 'Hemingway' : fmtRemaining(remaining)}</span>
    </button>
  );
}

const PRESETS = [30, 60, 90, 120]; // minutes, 30-minute increments

export default function VomitDraftTool({ editor }: { editor: Editor | null }) {
  const session = useVomitStore((s) => s.session);
  const remaining = useSprintClock();

  const [mode, setMode] = useState<'duration' | 'until'>('duration');
  const [customMin, setCustomMin] = useState(45);
  const [untilTime, setUntilTime] = useState('');   // "HH:MM" from <input type=time>
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => { setConfirmEnd(false); }, [session]);

  const start = (endsAt: number) => {
    if (!editor || editor.isDestroyed) return;
    const floor = vomitFloorFor(editor.state.doc);
    useVomitStore.getState().start(endsAt, floor);
    // The only workable spot is the end of the script — put the cursor there.
    editor.commands.focus('end');
  };

  const startMinutes = (min: number) => {
    const m = Math.max(1, Math.min(720, Math.round(min) || 0));
    start(Date.now() + m * 60000);
  };

  const startUntil = () => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(untilTime);
    if (!m) return;
    const end = new Date();
    end.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (end.getTime() <= Date.now()) end.setDate(end.getDate() + 1); // next occurrence
    start(end.getTime());
  };

  if (session) {
    const hemingway = session.endsAt === null;
    const total = hemingway ? 0 : session.endsAt! - session.startedAt;
    const pct = total > 0 ? Math.min(100, 100 - (remaining / total) * 100) : 100;
    return (
      <div className="fs-vomit">
        <div className="fs-vomit-running">
          <div className="fs-vomit-countdown">{hemingway ? '∞' : fmtRemaining(remaining)}</div>
          {!hemingway && <div className="fs-vomit-progress"><div style={{ width: `${pct}%` }} /></div>}
          <div className="fs-vomit-until">
            {hemingway
              ? 'Hemingway mode — no timer; write forwards until you end it'
              : `Editing unlocks at ${fmtClock(session.endsAt!)}`}
          </div>
          <p className="fs-vomit-lockednote">
            Previous text is locked. Keep writing — you can still fix the line
            you're on, and saving works as normal.
          </p>
          {confirmEnd ? (
            <div className="fs-vomit-confirm">
              <span>End the sprint early?</span>
              <button onClick={() => { useVomitStore.getState().end(); showToast('Vomit Draft ended early — full editing is back.', 'info'); }}>
                End it
              </button>
              <button onClick={() => setConfirmEnd(false)}>Keep writing</button>
            </div>
          ) : (
            <button className="fs-vomit-endearly" onClick={() => setConfirmEnd(true)}>
              End early…
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fs-vomit">
      <p className="fs-tool-intro">
        Write without looking back. Pick a time, hit Start, and until the timer
        runs out you can't delete or change anything you've already written —
        you just keep going. Saving and exporting work as normal; when time is
        up, full editing returns.
      </p>

      <div className="fs-vomit-modes">
        <button className={mode === 'duration' ? 'active' : ''} onClick={() => setMode('duration')}>
          Amount of time
        </button>
        <button className={mode === 'until' ? 'active' : ''} onClick={() => setMode('until')}>
          Until a time
        </button>
      </div>

      {/* v1.77: Hemingway mode moved here from Typewriter — it's the same
          lock as a sprint, just without the clock. */}
      <label className="fs-vomit-hemingway">
        <input
          type="checkbox"
          disabled={!editor}
          checked={false}
          onChange={() => {
            if (!editor || editor.isDestroyed) return;
            useVomitStore.getState().start(null, vomitFloorFor(editor.state.doc));
            editor.commands.focus('end');
          }}
        />
        <span>Hemingway mode — no timer, write forwards until you end it</span>
      </label>

      {mode === 'duration' ? (
        <>
          <div className="fs-vomit-presets">
            {PRESETS.map((m) => (
              <button key={m} onClick={() => startMinutes(m)} disabled={!editor}>
                {`${m / 60} hr`}
              </button>
            ))}
          </div>
          <div className="fs-vomit-custom">
            <span>Custom:</span>
            <input
              type="number"
              min={1}
              max={720}
              value={customMin}
              onChange={(e) => setCustomMin(Number(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === 'Enter') startMinutes(customMin); }}
            />
            <span>minutes</span>
            <button className="fs-vomit-start" disabled={!editor || customMin < 1} onClick={() => startMinutes(customMin)}>
              ▶ Start
            </button>
          </div>
        </>
      ) : (
        <div className="fs-vomit-custom">
          <span>Write until</span>
          {/* v1.73: segmented field — two digits of hour jump to minutes,
              two of minutes jump to AM/PM. WebKit's native time input kept
              every keystroke stuck in the hour segment. */}
          <TimeField value={untilTime} onChange={setUntilTime} onEnter={startUntil} />
          <button className="fs-vomit-start" disabled={!editor || !/^\d{2}:\d{2}$/.test(untilTime)} onClick={startUntil}>
            ▶ Start
          </button>
        </div>
      )}
    </div>
  );
}
