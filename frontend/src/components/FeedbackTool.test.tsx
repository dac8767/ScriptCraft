// @vitest-environment jsdom
/**
 * v4.70, Derek: Feedback screenshot chip. The form is a cross-origin Airtable
 * iframe, so the capture can't be injected into its attachment field — it
 * becomes a chip whose thumbnail is DRAGGED in as a real file. These pin the
 * chip's lifecycle and the drag payload: setData MUST be called (WebKit
 * refuses to start a drag without it — CLAUDE.md §4) and items.add must
 * carry the PNG File.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  /* v4.99, Derek ("drag still doesn't work, but copy and pasting screenshots
     work"): the drag is offered ONLY where the engine can carry a File — see
     canDragFiles(). jsdom can't, so the chip here is deliberately not
     draggable, and the hint leads with Copy. The drag PAYLOAD itself is
     covered by attachShotToDrag.test.ts.

     (This replaces a v4.70 case asserting setData('text/plain', name) on
     every drag. That is now the no-file FALLBACK only: setting text up front
     advertises a text drag, and a dropzone that sniffs types then ignores the
     image — which is half of why this never worked.) */
  it('offers no drag where the engine cannot carry a File, and says so', () => {
    act(() => root.render(<FeedbackTool />));
    act(() => publishFeedbackShot(makeShot()));

    const chip = host.querySelector('.feedback-shot-chip') as HTMLElement;
    expect(chip.draggable).toBe(false);
    expect(chip.className).not.toContain('feedback-shot-draggable');
    expect(chip.title).toBe('');
    expect(host.querySelector('.feedback-shot-hint')!.textContent)
      .toContain('Copy it');
  });

  it('the Copy button is present as the route that does not need a drag', () => {
    act(() => root.render(<FeedbackTool />));
    act(() => publishFeedbackShot(makeShot()));
    const titles = [...host.querySelectorAll('.feedback-shot-act')].map((b) => (b as HTMLElement).title);
    expect(titles.some((t) => t.startsWith('Copy the image'))).toBe(true);
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
