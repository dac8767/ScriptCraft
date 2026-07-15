/**
 * TimeField (v1.73) — a segmented time input that types like a clock:
 * two digits of hour auto-jump to minutes, two digits of minutes auto-jump
 * to AM/PM (in 12-hour mode). Built because WebKit's native
 * <input type="time"> keeps every keystroke in the hour segment inside the
 * Tauri shell — Derek typed "1130" and it never left the hours.
 *
 * Smart advance: a first digit that can't start a valid two-digit value
 * completes the segment immediately (hour "9" → "09", jump; minute "7" →
 * "07", jump). Backspace in an empty segment hops back. In the AM/PM
 * segment, A/P (or arrows) pick the half; in 24-hour mode the segment
 * simply isn't there.
 *
 * The `value` prop and onChange payload are canonical 24-hour "HH:MM"
 * ('' while incomplete), so callers never deal with AM/PM math.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

function toCanonical(h: string, m: string, half: 'AM' | 'PM' | '', is12h: boolean): string {
  if (h.length < 2 || m.length < 2 || (is12h && !half)) return '';
  let hour = parseInt(h, 10);
  const minute = parseInt(m, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return '';
  if (is12h) {
    if (hour < 1 || hour > 12) return '';
    if (half === 'AM' && hour === 12) hour = 0;
    if (half === 'PM' && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return '';
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function fromCanonical(v: string, is12h: boolean): { h: string; m: string; half: 'AM' | 'PM' | '' } {
  const match = /^(\d{2}):(\d{2})$/.exec(v);
  if (!match) return { h: '', m: '', half: '' };
  let hour = parseInt(match[1], 10);
  if (!is12h) return { h: match[1], m: match[2], half: '' };
  const half: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return { h: String(hour).padStart(2, '0'), m: match[2], half };
}

export default function TimeField({ value, onChange, onEnter }: {
  /** Canonical 24-hour "HH:MM", or '' while incomplete. */
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  const is12h = useSettingsStore((s) => s.timeFormat) === '12h';
  const init = fromCanonical(value, is12h);
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);
  const [half, setHalf] = useState<'AM' | 'PM' | ''>(init.half);
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const halfRef = useRef<HTMLButtonElement>(null);

  // Re-seed the segments if the format flips or the caller resets the value.
  useEffect(() => {
    const seeded = fromCanonical(value, is12h);
    setH(seeded.h); setM(seeded.m); setHalf(seeded.half);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is12h]);

  const emit = (nh: string, nm: string, nhalf: 'AM' | 'PM' | '') => {
    onChange(toCanonical(nh, nm, nhalf, is12h));
  };

  const onHour = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-2);
    let next = digits;
    if (digits.length === 1) {
      const d = parseInt(digits, 10);
      // A digit that can't START a valid hour IS the hour: 12h → 2-9; 24h → 3-9.
      if (d >= (is12h ? 2 : 3)) next = `0${d}`;
    }
    if (next.length === 2) {
      const hour = parseInt(next, 10);
      if (is12h && (hour < 1 || hour > 12)) return;   // reject e.g. "13" in 12h
      if (!is12h && hour > 23) return;
      setH(next); emit(next, m, half);
      mRef.current?.focus(); mRef.current?.select();
      return;
    }
    setH(next); emit(next, m, half);
  };

  const onMinute = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(-2);
    let next = digits;
    if (digits.length === 1) {
      const d = parseInt(digits, 10);
      if (d >= 6) next = `0${d}`;   // 6-9 can't start a minute — it IS the minute
    }
    setM(next); emit(h, next, half);
    if (next.length === 2 && is12h) {
      halfRef.current?.focus();
    }
  };

  const pickHalf = (v: 'AM' | 'PM') => { setHalf(v); emit(h, m, v); };

  const backHop = (e: React.KeyboardEvent, seg: 'm' | 'half') => {
    if (e.key !== 'Backspace') return;
    if (seg === 'm' && m === '') { hRef.current?.focus(); hRef.current?.select(); }
    if (seg === 'half') { setHalf(''); emit(h, m, ''); mRef.current?.focus(); mRef.current?.select(); }
  };

  const enterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
  };

  return (
    <span className="fs-timefield" role="group" aria-label="Time">
      <input
        ref={hRef}
        className="fs-timefield-seg"
        inputMode="numeric"
        placeholder={is12h ? 'hh' : 'HH'}
        value={h}
        onChange={(e) => onHour(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={enterKey}
        aria-label="Hours"
      />
      <span className="fs-timefield-colon">:</span>
      <input
        ref={mRef}
        className="fs-timefield-seg"
        inputMode="numeric"
        placeholder="mm"
        value={m}
        onChange={(e) => onMinute(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { backHop(e, 'm'); enterKey(e); }}
        aria-label="Minutes"
      />
      {is12h && (
        <button
          ref={halfRef}
          type="button"
          className={`fs-timefield-half${half ? '' : ' empty'}`}
          onKeyDown={(e) => {
            const k = e.key.toLowerCase();
            if (k === 'a') pickHalf('AM');
            else if (k === 'p') pickHalf('PM');
            else if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); pickHalf(half === 'AM' ? 'PM' : 'AM'); }
            else { backHop(e, 'half'); enterKey(e); }
          }}
          onClick={() => pickHalf(half === 'AM' ? 'PM' : 'AM')}
          aria-label="AM or PM"
        >
          {half || '--'}
        </button>
      )}
    </span>
  );
}
