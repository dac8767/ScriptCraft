// @vitest-environment jsdom
/**
 * v4.70, Derek: Feedback screenshot chip. The form is a cross-origin Airtable
 * iframe, so the capture can't be injected into its attachment field — it
 * becomes a chip whose thumbnail is DRAGGED in as a real file. These pin the
 * chip's lifecycle and the drag payload: setData MUST be called (WebKit
 * refuses to start a drag without it — CLAUDE.md §4) and items.add must
 * carry the PNG File.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import FeedbackTool, { FeedbackShotControls, publishFeedbackShot, type FeedbackShot } from './FeedbackTool';

// jsdom lacks rAF (the tool's rect loop) and object-URL revocation.
window.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
  setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
window.cancelAnimationFrame ??= ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;
(URL as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL ??= () => {};

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  act(() => publishFeedbackShot(null));   // shared module state — reset between tests
  host.remove();
});

function makeShot(name = 'shot.png'): FeedbackShot {
  return {
    file: new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' }),
    url: 'blob:test-shot',
    canvas: document.createElement('canvas'),
  };
}

describe('FeedbackTool capture chip', () => {
  it('no chip without a capture; publishing one shows it above the form placeholder', () => {
    act(() => root.render(<FeedbackTool />));
    expect(host.querySelector('.feedback-shot-chip')).toBeNull();

    act(() => publishFeedbackShot(makeShot('bug.png')));
    const chip = host.querySelector('.feedback-shot-chip');
    expect(chip).not.toBeNull();
    expect(chip!.querySelector('.feedback-shot-name')!.textContent).toBe('bug.png');
    // chip precedes the placeholder, so the iframe host shrinks under it
    const wrap = host.querySelector('.feedback-tool-wrap')!;
    expect(wrap.firstElementChild!.className).toContain('feedback-shot-chip');
    expect(wrap.lastElementChild!.className).toContain('feedback-tool');
  });

  it('dragging the thumbnail calls setData (WebKit) and attaches the File', () => {
    const shot = makeShot();
    act(() => root.render(<FeedbackTool />));
    act(() => publishFeedbackShot(shot));

    const dt = {
      setData: vi.fn(),
      items: { add: vi.fn() },
      effectAllowed: '',
    };
    const thumb = host.querySelector('.feedback-shot-thumb')!;
    const ev = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    act(() => { thumb.dispatchEvent(ev); });

    expect(dt.setData).toHaveBeenCalledWith('text/plain', shot.file.name);
    expect(dt.items.add).toHaveBeenCalledWith(shot.file);
    expect(dt.effectAllowed).toBe('copy');
  });

  it('discard removes the chip', () => {
    act(() => root.render(<FeedbackTool />));
    act(() => publishFeedbackShot(makeShot()));
    const discard = [...host.querySelectorAll<HTMLButtonElement>('.feedback-shot-act')]
      .find((b) => b.title.includes('Discard'))!;
    act(() => { discard.click(); });
    expect(host.querySelector('.feedback-shot-chip')).toBeNull();
  });

  it('header controls offer full-window and area capture', () => {
    act(() => root.render(<FeedbackShotControls />));
    const btns = [...host.querySelectorAll<HTMLButtonElement>('.feedback-shot-btns .tool-ctl')];
    expect(btns).toHaveLength(2);
    expect(btns[0].title).toContain('whole window');
    expect(btns[1].title).toContain('selected area');
  });
});
