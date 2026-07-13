import { describe, it, expect } from 'vitest';
import { errText } from './errText';

/**
 * The bug this exists to prevent:
 *   "FreeDraft can't write to that folder … (undefined)"
 * Tauri rejects with a plain string, so `(err as Error).message` was undefined and
 * the actual reason — the one thing that would have explained the failure — was
 * discarded by the code reporting it.
 */
describe('errText', () => {
  it('keeps a plain string, which is what Tauri actually throws', () => {
    const tauri = 'forbidden path: /Users/dcarl/Downloads/x.odraft.json, maybe it is not allowed on the scope';
    expect(errText(tauri)).toBe(tauri);
    expect(errText(tauri)).not.toBe('undefined');
  });

  it('reads a real Error', () => {
    expect(errText(new Error('disk full'))).toBe('disk full');
  });

  it('digs a message out of a plain object', () => {
    expect(errText({ message: 'nope' })).toBe('nope');
    expect(errText({ error: 'also nope' })).toBe('also nope');
  });

  it('never returns the string "undefined" — the failure that started this', () => {
    for (const v of [undefined, null, {}, 0, false]) {
      expect(errText(v)).not.toBe('undefined');
    }
  });
});
