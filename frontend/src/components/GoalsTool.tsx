/**
 * GoalsTool — ported from FreeScript v5.5's Goals (which absorbed the old
 * Write Sprint). Set a target and keep it in view while you write: a word
 * count, a page count, or a timed session. Progress renders here and as a
 * chip in the status bar, and lights up green when you hit it.
 *
 * The active goal persists across reloads (time goals store their wall-clock
 * end, so the countdown survives a refresh).
 */
import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore, type WritingGoal } from '../stores/editorStore';
import { computeOverviewStats } from '../utils/scriptStatistics';

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

  if (!goal) return null;
  if (goal.kind === 'time') {
    const remaining = Math.max(0, (goal.endsAt || 0) - Date.now());
    const done = !!goal.done || remaining <= 0;
    return {
      done,
      pct: done ? 100 : 100 - (remaining / ((goal.total || 1) * 1000)) * 100,
      label: done ? `${goal.target} min done` : `${fmtMs(remaining)} left`,
    };
  }
  const current = goal.kind === 'pages' ? pages : words;
  const done = current >= goal.target;
  return {
    done,
    pct: Math.min(100, (current / goal.target) * 100),
    label: `${current.toLocaleString()} / ${goal.target.toLocaleString()} ${goal.kind}`,
  };
}

interface GoalsToolProps {
  editor: Editor | null;
}

export default function GoalsTool({ editor }: GoalsToolProps) {
  const { goal, setGoal, pageCount } = useEditorStore();
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
  const [kind, setKind] = useState<WritingGoal['kind']>(goal ? goal.kind : 'time');
  const [targets, setTargets] = useState<Record<WritingGoal['kind'], number>>(
    () => ({ ...DEFAULT_TARGETS, ...(goal ? { [goal.kind]: goal.target } : {}) }),
  );
  const target = targets[kind];
  const setTarget = (v: number) => setTargets((t) => ({ ...t, [kind]: v }));

  const startTime = (m: number) =>
    setGoal({ kind: 'time', target: m, total: m * 60, endsAt: Date.now() + m * 60000 });
  const startCount = () =>
    setGoal({ kind, target: Math.max(1, Number(target) || 1) });

  const KINDS: [WritingGoal['kind'], string][] = [['words', 'Words'], ['pages', 'Pages'], ['time', 'Time']];
  const current = kind === 'pages' ? pageCount : words;

  return (
    <div className="fs-goals">
      {goal && progress && (
        <div className={`fs-goal-progress${progress.done ? ' done' : ''}`}>
          <div className="fs-goal-progress-bar">
            <div style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="fs-goal-progress-label">
            {progress.done ? '🎉 ' : ''}{progress.label}
          </div>
          <button className="fs-goal-stop" onClick={() => setGoal(null)}>
            {progress.done ? 'Dismiss' : 'Stop current goal'}
          </button>
        </div>
      )}

      <p className="fs-tool-intro">
        Set a target and keep it in view while you write — a word count, a page count,
        or a timed session. Progress shows here and in the status bar, and lights up
        when you hit it.
      </p>

      <div className="fs-goal-kinds">
        {KINDS.map(([k, label]) => (
          <button
            key={k}
            className={kind === k ? 'active' : ''}
            onClick={() => setKind(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === 'time' ? (
        <>
          <div className="fs-goal-row">
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
            />
            <span>minutes</span>
            <button className="fs-goal-start" onClick={() => startTime(target)}>▶ Start</button>
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
    </div>
  );
}
