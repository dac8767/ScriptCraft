// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import AddMenu from './AddMenu';

const MENU_H = 220;   // pretend the menu is 220px tall

function openMenuAt(rect: { top: number; bottom: number; left: number }) {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  document.body.appendChild(container);
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });
  const origRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('fs-addmenu-trigger')) {
      return { ...rect, right: rect.left + 160, width: 160, height: rect.bottom - rect.top } as DOMRect;
    }
    return origRect.call(this) as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { value: MENU_H, configurable: true });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { value: 240, configurable: true });

  const root = createRoot(container);
  act(() => {
    root.render(<AddMenu groups={[{ label: 'G', options: [{ value: 'a', label: 'A' }] }]} onPick={() => {}} />);
  });
  act(() => { (container.querySelector('.fs-addmenu-trigger') as HTMLButtonElement).click(); });
  const pop = document.querySelector('.fs-addmenu-pop') as HTMLElement;
  HTMLElement.prototype.getBoundingClientRect = origRect;
  return pop;
}

describe('AddMenu placement', () => {
  it('Customize footer: button low on screen -> opens UPWARD with a real top', () => {
    const pop = openMenuAt({ top: 742, bottom: 766, left: 320 });
    console.log('  low button  ->', pop.getAttribute('style'));
    const top = parseInt(pop.style.top, 10);
    expect(pop.style.visibility).toBe('visible');
    expect(pop.style.bottom).toBe('');                 // never anchored by the bottom edge
    expect(top).toBe(742 - 4 - MENU_H);                // sits just above the button
    expect(top).toBeGreaterThan(0);                    // on screen
  });

  it('panel toolbar: button high on screen -> opens DOWNWARD', () => {
    const pop = openMenuAt({ top: 120, bottom: 144, left: 900 });
    console.log('  high button ->', pop.getAttribute('style'));
    expect(parseInt(pop.style.top, 10)).toBe(148);
    expect(pop.style.bottom).toBe('');
  });

  it('cramped: no room either way -> still on screen, scrolls internally', () => {
    const pop = openMenuAt({ top: 430, bottom: 454, left: 1380 });
    console.log('  cramped     ->', pop.getAttribute('style'));
    const top = parseInt(pop.style.top, 10);
    const left = parseInt(pop.style.left, 10);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(left + 240).toBeLessThanOrEqual(1400);      // clamped inside the viewport
    expect(parseInt(pop.style.maxHeight, 10)).toBeGreaterThan(0);
  });
});
