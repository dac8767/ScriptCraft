/**
 * errText — get a human-readable message out of whatever was thrown.
 *
 * WHY THIS EXISTS. Tauri's plugin commands reject with a plain STRING, not an Error.
 * So `(err as Error).message` is `undefined`, and the code that did that produced:
 *
 *     ScriptCraft can't write to that folder … (undefined)
 *
 * The real reason — the thing that would have told us exactly which permission or
 * path was refused — was thrown away by the code trying to report it. An error
 * handler that loses the error is worse than no handler: it costs a round trip and
 * teaches you nothing.
 */
export function errText(err: unknown): string {
  if (typeof err === 'string') return err;                    // Tauri does this
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    for (const key of ['message', 'error', 'reason', 'description']) {
      const v = o[key];
      if (typeof v === 'string' && v) return v;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json;
    } catch { /* circular — fall through */ }
  }
  return String(err ?? 'unknown error');
}
