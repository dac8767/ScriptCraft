/**
 * v6.69, Derek: "clicking on 'Snapshots' shows a window that is forever stuck
 * on 'Loading snapshots…'". The wait is what has to be bounded — the loader
 * can't know whether the transport will ever answer.
 */
import { describe, it, expect, vi } from 'vitest';
import { withTimeout, TimeoutError, SNAPSHOT_LOAD_TIMEOUT_MS } from './withTimeout';

describe('withTimeout', () => {
  it('passes a value straight through when it arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, 'late')).resolves.toBe(7);
  });

  it('passes the original error through — a real failure must not read as a timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'late')).rejects.toThrow('boom');
  });

  /* THE bug: a promise that never settles left the spinner up for ever. */
  it('rejects with the given message when the promise never settles', async () => {
    vi.useFakeTimers();
    const forever = new Promise(() => {});
    const p = withTimeout(forever, 5000, 'the server never answered');
    const seen = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await seen;
    expect(err).toBeInstanceOf(TimeoutError);
    expect((err as Error).message).toBe('the server never answered');
    vi.useRealTimers();
  });

  it('does not fire once the promise has already answered', async () => {
    vi.useFakeTimers();
    const p = withTimeout(Promise.resolve('ok'), 5000, 'late');
    await expect(p).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(10_000);   // the timer must be dead
    vi.useRealTimers();
  });

  it('the snapshot budget is a real, human-scale wait', () => {
    expect(SNAPSHOT_LOAD_TIMEOUT_MS).toBeGreaterThan(2000);
    expect(SNAPSHOT_LOAD_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
