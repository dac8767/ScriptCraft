// @vitest-environment jsdom
/**
 * copyCanvasToClipboard (v4.98) — Derek: "screenshot dragging is not working".
 *
 * Pasting doesn't depend on the webview carrying a file in a drag, so this is
 * the route that survives when the drag doesn't. Two things can silently go
 * wrong, and both are pinned:
 *   · the blob is AWAITED before the ClipboardItem is built — that spends the
 *     user activation and WebKit refuses the write. The value must be the
 *     pending promise.
 *   · a refusal throws, and an unhandled rejection would leave the button
 *     looking like it worked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyCanvasToClipboard } from './screenshot';

type CIArg = Record<string, Blob | Promise<Blob>>;

/** A canvas stub whose toBlob resolves on a later tick, like the real one. */
const canvasStub = (blob: Blob | null = new Blob([new Uint8Array([1])], { type: 'image/png' })) => ({
  toBlob: (cb: (b: Blob | null) => void) => { setTimeout(() => cb(blob), 0); },
}) as unknown as HTMLCanvasElement;

const install = (write: (items: unknown[]) => Promise<void>) => {
  const seen: CIArg[] = [];
  class FakeClipboardItem {
    items: CIArg;
    constructor(items: CIArg) { this.items = items; seen.push(items); }
  }
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
  return seen;
};

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('copyCanvasToClipboard', () => {
  it('writes an image/png clipboard item and reports success', async () => {
    const seen = install(async () => {});
    await expect(copyCanvasToClipboard(canvasStub())).resolves.toBe(true);
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0])).toEqual(['image/png']);
  });

  it('hands the ClipboardItem a PENDING promise, not an awaited blob', async () => {
    // The WebKit rule: awaiting the encode before constructing the item spends
    // the user activation, and the write is refused. If this ever regresses to
    // `await canvas.toBlob(...)` the value here stops being a thenable.
    const seen = install(async () => {});
    await copyCanvasToClipboard(canvasStub());
    const value = seen[0]['image/png'];
    expect(typeof (value as Promise<Blob>).then).toBe('function');
    await expect(value).resolves.toBeInstanceOf(Blob);
  });

  it('a refused write is false, not an exception', async () => {
    install(async () => { throw new Error('NotAllowedError'); });
    await expect(copyCanvasToClipboard(canvasStub())).resolves.toBe(false);
  });

  it('an engine without ClipboardItem is false, and never touches the clipboard', async () => {
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    vi.stubGlobal('ClipboardItem', undefined);
    await expect(copyCanvasToClipboard(canvasStub())).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('an engine without clipboard.write is false too', async () => {
    vi.stubGlobal('ClipboardItem', class {});
    Object.defineProperty(navigator, 'clipboard', { value: {}, configurable: true });
    await expect(copyCanvasToClipboard(canvasStub())).resolves.toBe(false);
  });

  it('an encode failure rejects the promise but still resolves false', async () => {
    install(async (items) => { await (items[0] as { items: CIArg }).items['image/png']; });
    await expect(copyCanvasToClipboard(canvasStub(null))).resolves.toBe(false);
  });
});
