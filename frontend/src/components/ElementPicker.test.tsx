// @vitest-environment jsdom
/**
 * ElementPicker ordering (v4.56, Derek).
 *
 * The list is the user's order with ONE context suggestion lifted to the
 * top. A caller-supplied suggestType (an empty dialogue under a character
 * name suggests Parenthetical) wins over the ELEMENT_ORDER-derived pick;
 * without it, behavior is unchanged (empty dialogue leads with Action).
 * Character must never appear — it is not pickable (v4.54).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ElementPicker from './ElementPicker';

let host: HTMLElement;
let root: Root;

// jsdom has no scrollIntoView; the picker calls it on the selected item.
beforeEach(() => {
  (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView ??= () => {};
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const labels = () =>
  [...host.querySelectorAll('.element-picker-label')].map((e) => e.textContent);

function render(props: Partial<React.ComponentProps<typeof ElementPicker>>) {
  act(() => {
    root.render(
      <ElementPicker
        position={{ top: 0, left: 0 }}
        defaultType={'dialogue' as never}
        onSelect={() => {}}
        onDismiss={() => {}}
        {...props}
      />,
    );
  });
}

describe('ElementPicker ordering', () => {
  it('suggestType leads the list (empty dialogue under a name → Parenthetical)', () => {
    render({ suggestType: 'parenthetical' as never });
    expect(labels()[0]).toBe('Parenthetical');
  });

  it('without suggestType an empty dialogue leads with Action', () => {
    render({});
    expect(labels()[0]).toBe('Action');
  });

  it('never offers Character', () => {
    render({ suggestType: 'parenthetical' as never });
    expect(labels()).not.toContain('Character');
  });

  // v4.58: grammar filter by the element above the line being chosen.
  it('after a scene heading the list is exactly Action, Dialogue, Dual Dialogue', () => {
    render({ prevScriptType: 'sceneHeading' });
    expect(labels().sort()).toEqual(['Action', 'Dialogue', 'Dual Dialogue']);
  });

  it('parenthetical appears only when the previous element is a character', () => {
    render({ prevScriptType: 'character', suggestType: 'parenthetical' as never });
    expect(labels()[0]).toBe('Parenthetical');
    render({ prevScriptType: 'dialogue' });
    expect(labels()).not.toContain('Parenthetical');
  });

  it('transition appears after dialogue but not after a character or at the top', () => {
    render({ prevScriptType: 'dialogue' });
    expect(labels()).toContain('Transition');
    render({ prevScriptType: 'character' });
    expect(labels()).not.toContain('Transition');
    render({ prevScriptType: null });
    expect(labels()).not.toContain('Transition');
  });
});
