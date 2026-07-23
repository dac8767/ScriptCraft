/**
 * Script timing — the per-scene runtime estimator and its display formatters
 * (SceneNavigator timing column, total-runtime readout). Untested until now;
 * these pin the element-rate model, the per-scene override, cumulative totals,
 * and the formatting so a rate tweak can't silently skew every estimate.
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { computeSceneTiming, formatRuntime, formatSceneDuration, getTimingColor } from './scriptTiming';

const words = (n: number) => Array(n).fill('w').join(' ');
const el = (type: string, text: string, attrs?: Record<string, unknown>): JSONContent =>
  ({ type, content: [{ type: 'text', text }], ...(attrs ? { attrs } : {}) });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

describe('computeSceneTiming', () => {
  // dialogue 50w → 50/250*50 = 10s; action 50w → 50/250*65 = 13s.
  const script = doc(
    el('sceneHeading', 'INT. A - DAY'),
    el('character', 'SARAH'),          // character cues take no screen time
    el('dialogue', words(50)),
    el('action', words(50)),
    el('sceneHeading', 'EXT. B - NIGHT', { timingOverride: 100 }),
    el('dialogue', words(50)),
  );

  const result = computeSceneTiming(script);

  it('estimates a scene from element-type rates', () => {
    expect(result.scenes[0]).toMatchObject({
      heading: 'INT. A - DAY',
      autoEstimateSeconds: 23,        // round(10 + 13)
      overrideSeconds: null,
      finalSeconds: 23,
      breakdown: { dialogueSeconds: 10, actionSeconds: 13, otherSeconds: 0 },
    });
  });

  it('lets a per-scene override win over the estimate', () => {
    expect(result.scenes[1]).toMatchObject({
      heading: 'EXT. B - NIGHT',
      autoEstimateSeconds: 10,        // it would auto-estimate 10s...
      overrideSeconds: 100,
      finalSeconds: 100,              // ...but the override takes over
    });
  });

  it('accumulates cumulative + total from finalSeconds', () => {
    expect(result.scenes[0].cumulativeSeconds).toBe(23);
    expect(result.scenes[1].cumulativeSeconds).toBe(123);   // 23 + 100
    expect(result.totalSeconds).toBe(123);
  });

  it('returns empty for a doc with no content', () => {
    expect(computeSceneTiming({ type: 'doc' })).toEqual({ scenes: [], totalSeconds: 0 });
  });
});

describe('timing formatters', () => {
  it('formatRuntime → hours/minutes', () => {
    expect(formatRuntime(0)).toBe('0m');
    expect(formatRuntime(90)).toBe('2m');       // 1.5 min rounds to 2
    expect(formatRuntime(3600)).toBe('1h');
    expect(formatRuntime(6420)).toBe('1h 47m');
    expect(formatRuntime(7200)).toBe('2h');
  });

  it('formatSceneDuration → M:SS', () => {
    expect(formatSceneDuration(5)).toBe('0:05');
    expect(formatSceneDuration(60)).toBe('1:00');
    expect(formatSceneDuration(135)).toBe('2:15');
  });

  it('getTimingColor → banded by length, at the boundaries', () => {
    expect(getTimingColor(30)).toBe('#94a3b8');   // < 60 grey
    expect(getTimingColor(60)).toBe('#10b981');   // [60,180) green
    expect(getTimingColor(180)).toBe('#f59e0b');  // [180,300) yellow
    expect(getTimingColor(300)).toBe('#ef4444');  // >= 300 red
  });
});
