/**
 * GoalsTool — ported from ScriptCraft v5.5's Goals (which absorbed the old
 * Write Sprint). Set a target and keep it in view while you write: a word
 * count, a page count, or a timed session. Progress renders here and as a
 * chip in the status bar, and lights up green when you hit it.
 *
 * v1.82: Goals also absorbed VOMIT DRAFT. Any goal can be started with
 * "Vomit Draft Mode" on — until the goal is reached (or the time is up),
 * previous text is locked and you can only write forward (the VomitLock
 * transaction filter, unchanged underneath). Time goals can run for an
 * amount of minutes OR until a clock time. Hemingway mode is gone.
 *
 * The active goal persists across reloads (time goals store their wall-clock
 * end, so the countdown survives a refresh). The LOCK does not persist —
 * an app restart releases it, same as the old Vomit Draft.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaRegQuestionCircle } from 'react-icons/fa';
import type { Editor } from '@tiptap/react';
import { useEditorStore, type WritingGoal } from '../stores/editorStore';
import { useVomitStore } from '../stores/vomitStore';
import { vomitFloorFor } from '../editor/extensions/VomitLock';
import { computeOverviewStats } from '../utils/scriptStatistics';
import { useSettingsStore } from '../stores/settingsStore';
import TimeField from './TimeField';
import { showToast } from './Toast';

function fmtMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Progress readout for the active goal — shared with the StatusBar chip. */
export function useGoalProgress(words: number, pages: number) {
  const { goal, setGoal } = useEditorStore();
  const [, force] = useState(0);

  useEffect(() => {
    if (!goal || goal.kind !== 'time' || goal.done) return;
    const t = setInterval(() => {
      if (Date.now() >= (goal.endsAt || 0)) {
        setGoal((g) => (g && g.kind === 'time' ? { ...g, done: true } : g));
      } else {
        force((x) => x + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [goal, setGoal]);

  let result: { done: boolean; pct: number; label: string } | null = null;
  if (goal && goal.kind === 'time') {
    const remaining = Math.max(0, (goal.endsAt || 0) - Date.now());
    const done = !!goal.done || remaining <= 0;
    result = {
      done,
      pct: done ? 100 : 100 - (remaining / ((goal.total || 1) * 1000)) * 100,
      label: done ? `${goal.target} min done` : `${fmtMs(remaining)} left`,
    };
  } else if (goal) {
    const current = goal.kind === 'pages' ? pages : words;
    const done = current >= goal.target;
    result = {
      done,
      pct: Math.min(100, (current / goal.target) * 100),
      label: `${current.toLocaleString()} / ${goal.target.toLocaleString()} ${goal.kind}`,
    };
  }

  // v1.82: a completed goal releases Vomit Draft Mode's lock. Lives in this
  // shared hook so it fires even with the Goals window closed (the StatusBar
  // chip keeps it mounted). Timed locks also expire on their own clock; this
  // covers word/page goals, whose lock has no clock (endsAt null).
  const releasedRef = useRef(false);
  const done = !!result?.done;
  useEffect(() => {
    if (!done) { releasedRef.current = false; return; }
    if (releasedRef.current) return;
    releasedRef.current = true;
    const s = useVomitStore.getState();
    if (s.session) {
      s.end();
      showToast('Goal reached — Vomit Draft Mode off, full editing is back.', 'success');
    }
  }, [done]);

  return result;
}


/** v1.85: the window-header controls — the Words/Pages/Time tabs and the ?
 *  helper. Rendered by the chrome (TOOL_HEADER_EXTRAS), so the state lives
 *  in the store (goalKind). The helper popover PORTALS to document.body and
 *  positions from the button — a child of the header row could never escape
 *  the panel's overflow (the AddMenu lesson). */
export function GoalsHeaderExtra() {
  const kind = useEditorStore((s) => s.goalKind);
  const setKind = useEditorStore((s) => s.setGoalKind);
  // v1.92: while Vomit Draft locks the script, the window is JUST the lock
  // readout — the kind tabs and helper hide with everything else.
  const locked = useVomitStore((s) => !!s.session);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!helpOpen) return;
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.fs-help-pop') && t !== helpBtnRef.current) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [helpOpen]);

  const toggleHelp = () => {
    if (!helpOpen && helpBtnRef.current) {
      const r = helpBtnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 120, window.innerWidth - 288)) });
    }
    setHelpOpen((v) => !v);
  };

  // After every hook — an early return above them is the documented crash.
  if (locked) return null;

  return (
    <span className="fs-goal-headerctl">
      <span className="fs-goal-tabs">
        {(['words', 'pages', 'time'] as const).map((k) => (
          <button
            key={k}
            className={kind === k ? 'active' : ''}
            onClick={() => setKind(k)}
          >{k[0].toUpperCase() + k.slice(1)}</button>
        ))}
      </span>
      <button ref={helpBtnRef} className="fs-help-btn" title="About Goals" onClick={toggleHelp}><FaRegQuestionCircle /></button>
      {helpOpen && pos && createPortal(
        <div className="fs-help-pop" style={{ top: pos.top, left: pos.left }}>
          Set a target and keep it in view while you write — a word count, a
          page count, or a timed session. Progress shows here and in the
          status bar, and lights up when you hit it. Vomit Draft Mode locks
          previous text until the goal is done.
        </div>,
        document.body,
      )}
    </span>
  );
}

interface GoalsToolProps {
  editor: Editor | null;
}

export default function GoalsTool({ editor }: GoalsToolProps) {
  const { goal, setGoal, pageCount } = useEditorStore();
  const vomitSession = useVomitStore((s) => s.session);
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  const words = useMemo(() => {
    if (!editor) return 0;
    try { return computeOverviewStats(editor.getJSON(), pageCount).totalWords; }
    catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docTick, pageCount]);

  const progress = useGoalProgress(words, pageCount);

  const DEFAULT_TARGETS: Record<WritingGoal['kind'], number> = { words: 500, pages: 2, time: 60 };
  // v1.85: the kind is store state — the header tabs set it.
  const kind = useEditorStore((s) => s.goalKind);
  const [targets, setTargets] = useState<Record<WritingGoal['kind'], number>>(
    () => ({ ...DEFAULT_TARGETS, ...(goal ? { [goal.kind]: goal.target } : {}) }),
  );
  const target = targets[kind];
  const setTarget = (v: number) => setTargets((t) => ({ ...t, [kind]: v }));

  // v1.82: Vomit Draft Mode — checked when the goal starts, it locks previous
  // text until the goal is done (any goal kind). Timed goals get a clocked
  // lock; word/page goals a clockless one released by the progress watcher.
  const [vomitMode, setVomitMode] = useState(false);
  const [untilTime, setUntilTime] = useState('');   // canonical "HH:MM"
  // v1.93: the Time tab is an either/or — write FOR an amount, or UNTIL a
  // clock time — with ONE Start button (two competing Starts read as noise).
  const [timeMode, setTimeMode] = useState<'for' | 'until'>('for');

  const startLock = (endsAt: number | null) => {
    if (!vomitMode || !editor || editor.isDestroyed) return;
    useVomitStore.getState().start(endsAt, vomitFloorFor(editor.state.doc));
    editor.commands.focus('end');
  };

  const startTime = (m: number) => {
    const endsAt = Date.now() + m * 60000;
    setGoal({ kind: 'time', target: m, total: m * 60, endsAt });
    startLock(endsAt);
  };
  const startUntil = () => {
    const match = /^(\d{2}):(\d{2})$/.exec(untilTime);
    if (!match) return;
    const end = new Date();
    end.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (end.getTime() <= Date.now()) end.setDate(end.getDate() + 1); // next occurrence
    const m = Math.max(1, Math.round((end.getTime() - Date.now()) / 60000));
    setGoal({ kind: 'time', target: m, total: m * 60, endsAt: end.getTime() });
    startLock(end.getTime());
  };
  const startCount = () => {
    setGoal({ kind, target: Math.max(1, Number(target) || 1) });
    startLock(null);   // no clock — the progress watcher releases it
  };

  const stopGoal = () => {
    if (progress?.done) useEditorStore.getState().incrementGoalsCompleted();
    setGoal(null);
    if (useVomitStore.getState().session) {
      useVomitStore.getState().end();
      showToast('Vomit Draft Mode off — full editing is back.', 'info');
    }
  };

  const current = kind === 'pages' ? pageCount : words;
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  void timeFormat; // TimeField reads the setting itself; subscribing re-renders us on change

  // v1.92: while the lock runs, the window is ONLY the lock readout (the
  // upper-right pill is gone — this panel is where the lock lives now).
  const blockedTick = useVomitStore((s) => s.blockedTick);
  const [pulse, setPulse] = useState(false);
  const firstTick = useRef(true);
  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return; }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [blockedTick]);

  const progressBlock = goal && progress && (
    <div className={`fs-goal-progress${progress.done ? ' done' : ''}`}>
      <div className="fs-goal-progress-bar">
        <div style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="fs-goal-progress-label">
        {progress.done ? '🎉 ' : ''}{progress.label}
      </div>
      {vomitSession && (
        <div className={`fs-goal-vomit-note${pulse ? ' blocked' : ''}`}>
          🔒 Vomit Draft Mode — previous text is locked until the goal is done.
        </div>
      )}
      <button className="fs-goal-stop" onClick={stopGoal}>
        {progress.done ? 'Dismiss' : 'Stop current goal'}
      </button>
    </div>
  );

  if (vomitSession) {
    return (
      <div className="fs-goals fs-goals-locked">
        {progressBlock || (
          // Shouldn't happen (locks only start with a goal), but never
          // trap the user with an empty locked window.
          <div className="fs-goal-progress">
            <div className={`fs-goal-vomit-note${pulse ? ' blocked' : ''}`}>
              🔒 Vomit Draft Mode — previous text is locked.
            </div>
            <button className="fs-goal-stop" onClick={stopGoal}>End Vomit Draft Mode</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fs-goals">
      {progressBlock}

      {kind === 'time' ? (
        <>
          {/* v1.93: pick ONE of the two timed shapes, then one Start.
              (v1.85 kept Write-until first; that order survives.) */}
          <label className={`fs-goal-timemode${timeMode === 'until' ? ' active' : ''}`}>
            <input
              type="radio"
              name="fs-goal-timemode"
              checked={timeMode === 'until'}
              onChange={() => setTimeMode('until')}
            />
            <span className="fs-goal-timemode-label">Write until</span>
            <span onPointerDown={() => setTimeMode('until')}>
              <TimeField value={untilTime} onChange={setUntilTime} onEnter={startUntil} />
            </span>
          </label>
          <label className={`fs-goal-timemode${timeMode === 'for' ? ' active' : ''}`}>
            <input
              type="radio"
              name="fs-goal-timemode"
              checked={timeMode === 'for'}
              onChange={() => setTimeMode('for')}
            />
            <span className="fs-goal-timemode-label">Write for</span>
            <input
              type="number"
              min={1}
              value={target}
              onFocus={() => setTimeMode('for')}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
            />
            <span>minutes</span>
          </label>
          <div className="fs-goal-row fs-goal-startrow">
            <button
              className="fs-goal-start"
              disabled={timeMode === 'until' && !/^\d{2}:\d{2}$/.test(untilTime)}
              onClick={() => (timeMode === 'until' ? startUntil() : startTime(target))}
            >▶ Start</button>
          </div>
          <b className="fs-goal-quick-label">Quick start</b>
          <div className="fs-goal-quick">
            {[5, 15, 30, 120].map((m) => (
              <button key={m} onClick={() => startTime(m)}>{m} min</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="fs-goal-row">
            <span>Reach</span>
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
            />
            <span>{kind}</span>
            <button className="fs-goal-start" onClick={startCount}>▶ Start</button>
          </div>
          <p className="fs-goal-current">
            Counts the document total — currently {current.toLocaleString()} {kind}.
          </p>
        </>
      )}

      {/* v1.82: the old Vomit Draft tool lives here now — one checkbox that
          applies to whatever goal you start next. */}
      <label className="fs-goal-vomit">
        <input
          type="checkbox"
          disabled={!editor}
          checked={vomitMode}
          onChange={(e) => setVomitMode(e.target.checked)}
        />
        <span>Vomit Draft Mode — lock previous text until the goal is done</span>
      </label>
    </div>
  );
}
