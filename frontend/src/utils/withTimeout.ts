/**
 * v6.69, Derek: "clicking on 'Snapshots' shows a window that is forever stuck
 * on 'Loading snapshots…'".
 *
 * A screen that waits on the network must never wait FOREVER. Whatever the
 * transport does — a desktop build with no backend, a cloud URL that
 * black-holes packets, a Tauri invoke that never settles — the spinner has to
 * end in something the writer can read and act on.
 *
 * This is deliberately transport-agnostic: it does not abort the request (the
 * caller may not own it), it bounds the WAIT. A late reply is simply ignored,
 * which is the right outcome for a load the user has already been told failed.
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Resolve with `p`, or reject with a TimeoutError after `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** How long any snapshot load may sit on "Loading…" before it must speak. */
export const SNAPSHOT_LOAD_TIMEOUT_MS = 12_000;
