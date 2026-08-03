// @vitest-environment jsdom
/**
 * Each of these locks a rule that exists because of a real bug, and that
 * most of the app's popups were missing when this hook was written.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { usePopup } from './usePopup';

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });
beforeEach(() => { vi.spyOn(performance, 'now').mockReturnValue(0); });

function mount(opts = {}) {
  const ref = { current: null as unknown as ReturnType<typeof usePopup> };
  const Probe = () => {
    const p = usePopup(opts);
    ref.current = p;
    return React.createElement('div', null,
      React.createElement('button', { ref: (el: HTMLButtonElement) => { p.triggerRef.current = el; }, id: 'trig' }, 'open'),
      p.isOpen ? React.createElement('div', { ref: (el: HTMLDivElement) => { p.popupRef.current = el; }, id: 'pop' }, 'menu') : null);
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(React.createElement(Probe)));
  return ref;
}
const press = (el: Node) => act(() => {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
});

describe('usePopup', () => {
  it('opens anchored below the trigger, by top/left — never bottom', () => {
    const p = mount();
    act(() => p.current.openAt());
    expect(p.current.pos).not.toBeNull();
    expect(p.current.pos).toHaveProperty('top');
    expect(p.current.pos).toHaveProperty('left');
  });

  it('closes on an outside press even when the presser stops propagation', () => {
    const p = mount();
    act(() => p.current.openAt());
    const outside = document.createElement('button');
    // the window-drag guard every sibling control has — this is what defeated
    // a bubble-phase listener and left two menus open (v5.20)
    outside.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(outside);
    press(outside);
    expect(p.current.isOpen).toBe(false);
    outside.remove();
  });

  it('does NOT close on a press inside itself', () => {
    const p = mount();
    act(() => p.current.openAt());
    press(host!.querySelector('#pop')!);
    expect(p.current.isOpen).toBe(true);
  });

  it('does NOT close on a press on its own trigger — that toggles', () => {
    const p = mount();
    act(() => p.current.openAt());
    press(host!.querySelector('#trig')!);
    expect(p.current.isOpen).toBe(true);
  });

  it('survives the scroll the opening click itself emits', () => {
    const p = mount();
    act(() => p.current.openAt());
    act(() => { window.dispatchEvent(new Event('scroll')); });   // same instant
    expect(p.current.isOpen).toBe(true);
  });

  it('closes on genuine scrolling, once the grace window has passed', () => {
    const p = mount();
    act(() => p.current.openAt());
    vi.spyOn(performance, 'now').mockReturnValue(500);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    expect(p.current.isOpen).toBe(false);
  });

  it('closes on Escape', () => {
    const p = mount();
    act(() => p.current.openAt());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(p.current.isOpen).toBe(false);
  });

  it('keeps itself inside the viewport', () => {
    const p = mount({ width: 200 });
    const trig = host!.querySelector('#trig') as HTMLElement;
    trig.getBoundingClientRect = () => ({ left: 5000, right: 5100, bottom: 20 }) as DOMRect;
    act(() => p.current.openAt());
    expect(p.current.pos!.left).toBeLessThanOrEqual(window.innerWidth - 200 - 8);
  });
});
