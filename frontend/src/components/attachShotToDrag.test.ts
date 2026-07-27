// @vitest-environment jsdom
/**
 * attachShotToDrag (v4.97) — Derek: "make the file that appears at the top of
 * the window the actual file so I can drag and drop it into the form".
 *
 * The Feedback form is a cross-origin Airtable iframe, so nothing here can
 * reach its attachment field; a real drag carrying a real File is the only
 * route in. What can silently go wrong:
 *   · the file never attaches and the drag looks fine but drops nothing;
 *   · `text/plain` is set first, the drop target sniffs types, takes the text
 *     branch and ignores the image.
 * Both are pinned here.
 */
import { describe, it, expect, vi } from 'vitest';
import { attachShotToDrag, probeFileDrag } from './FeedbackTool';

const file = () => new File([new Uint8Array([1, 2, 3])], 'scriptcraft-shot.png', { type: 'image/png' });

/** A DataTransfer stub that behaves like an engine which DOES carry files. */
function dtWithFiles() {
  const data: Record<string, string> = {};
  const types: string[] = [];
  const added: File[] = [];
  return {
    dt: {
      types,
      items: { add: (f: File) => { added.push(f); types.push('Files'); } },
      setData: (t: string, v: string) => { data[t] = v; if (!types.includes(t)) types.push(t); },
      effectAllowed: '',
    } as unknown as DataTransfer,
    data, types, added,
  };
}

/** …and one that refuses, the way a webview without outgoing file drags does. */
function dtNoFiles() {
  const data: Record<string, string> = {};
  const types: string[] = [];
  return {
    dt: {
      types,
      items: { add: () => { throw new Error('not supported'); } },
      setData: (t: string, v: string) => { data[t] = v; if (!types.includes(t)) types.push(t); },
      effectAllowed: '',
    } as unknown as DataTransfer,
    data, types,
  };
}

describe('attachShotToDrag', () => {
  it('attaches the File and reports that it took', () => {
    const { dt, added, types } = dtWithFiles();
    const f = file();
    expect(attachShotToDrag(dt, f, 'blob:x')).toBe(true);
    expect(added).toEqual([f]);
    expect(types).toContain('Files');
  });

  it('does NOT set text/plain when the file attached — a text drag wins the sniff', () => {
    const { dt, data } = dtWithFiles();
    attachShotToDrag(dt, file(), 'blob:x');
    expect(data['text/plain']).toBeUndefined();
  });

  it('adds the file BEFORE any other type', () => {
    const { dt, types } = dtWithFiles();
    attachShotToDrag(dt, file(), 'blob:x');
    expect(types[0]).toBe('Files');
  });

  it("carries Blink's DownloadURL descriptor: mime:name:url", () => {
    const { dt, data } = dtWithFiles();
    attachShotToDrag(dt, file(), 'blob:http://localhost/abc');
    expect(data.DownloadURL).toBe('image/png:scriptcraft-shot.png:blob:http://localhost/abc');
  });

  it('an engine that refuses files reports false — the caller can say so', () => {
    const { dt } = dtNoFiles();
    expect(attachShotToDrag(dt, file(), 'blob:x')).toBe(false);
  });

  it('…and still sets something, because WebKit will not start an empty drag', () => {
    const { dt, data } = dtNoFiles();
    attachShotToDrag(dt, file(), 'blob:x');
    expect(data['text/plain']).toBe('scriptcraft-shot.png');
    expect(dt.effectAllowed).toBe('copy');
  });

  it('a setData that throws (DownloadURL unsupported) does not break the drag', () => {
    const { dt } = dtWithFiles();
    const real = dt.setData;
    vi.spyOn(dt, 'setData').mockImplementation((t: string, v: string) => {
      if (t === 'DownloadURL') throw new Error('nope');
      return real.call(dt, t, v);
    });
    expect(() => attachShotToDrag(dt, file(), 'blob:x')).not.toThrow();
  });
});

describe('probeFileDrag — only offer the drag where it can work (v4.99)', () => {
  it('true when the engine reports Files after items.add', () => {
    expect(probeFileDrag(() => dtWithFiles().dt)).toBe(true);
  });

  it('false when items.add throws — WKWebView, per Derek', () => {
    expect(probeFileDrag(() => dtNoFiles().dt)).toBe(false);
  });

  it('false when add is silently ignored — no throw, but no Files either', () => {
    const dt = { types: [] as string[], items: { add: () => {} }, setData: () => {} } as unknown as DataTransfer;
    expect(probeFileDrag(() => dt)).toBe(false);
  });

  it('false when there is no DataTransfer constructor at all', () => {
    expect(probeFileDrag(() => { throw new TypeError('not a constructor'); })).toBe(false);
  });
});
