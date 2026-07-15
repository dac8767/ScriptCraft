/**
 * VomitTimerPill (v1.62; v1.82: the standalone Vomit Draft tool merged into
 * Goals — this file keeps only the floating lock indicator).
 *
 * Whenever a Vomit Draft Mode lock is active (started from the Goals tool),
 * this pill floats over the editor: a countdown for clocked locks, a plain
 * lock for goal-bound ones. It pulses red when a locked edit is rejected,
 * owns the expiry tick for clocked locks, and clicking it opens Goals.
 */
import { useEffect, useRef, useState } from 'react';
import { useVomitStore } from '../stores/vomitStore';
import { useEditorStore } from '../stores/editorStore';
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

/** Ticks once a second while a clocked lock runs; releases it at zero.
 *  Goal-bound locks (endsAt null) have no clock — the Goals progress
 *  watcher releases them when the goal completes. */
function useLockClock(): number {
  const session = useVomitStore((s) => s.session);
  const [, force] = useState(0);
  useEffect(() => {
    if (!session || session.endsAt === null) return;
    const t = setInterval(() => {
      if (Date.now() >= session.endsAt!) {
        useVomitStore.getState().end();
        showToast('Time! Vomit Draft Mode is over — full editing is back.', 'success');
      } else {
        force((x) => x + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [session]);
  return session && session.endsAt !== null ? Math.max(0, session.endsAt - Date.now()) : 0;
}

export function VomitTimerPill() {
  const session = useVomitStore((s) => s.session);
  const blockedTick = useVomitStore((s) => s.blockedTick);
  const remaining = useLockClock();
  const [pulse, setPulse] = useState(false);
  const firstTick = useRef(true);

  useEffect(() => {
    if (firstTick.current) { firstTick.current = false; return; }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [blockedTick]);

  if (!session) return null;
  const clocked = session.endsAt !== null;
  return (
    <button
      className={`fs-vomit-pill${pulse ? ' blocked' : ''}`}
      title="Vomit Draft Mode — previous text is locked until the goal is done. Click to open Goals."
      onClick={() => useEditorStore.getState().openTool('goals')}
    >
      <span className="fs-vomit-pill-icon" aria-hidden="true">🔒</span>
      <span className="fs-vomit-pill-time">{clocked ? fmtRemaining(remaining) : 'Locked'}</span>
    </button>
  );
}
