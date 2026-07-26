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
import { useEditorStore } from '../stores/editorStore';

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

  it('never shows a plain "Character" label — the name line is "Dialogue (character)"', () => {
    render({});
    expect(labels()).not.toContain('Character');
    expect(labels()).toContain('Dialogue (character)');
  });

  // v4.58/61: grammar filter by the element above the line being chosen.
  it('after a scene heading: exactly Action, Dialogue (character), Dual Dialogue', () => {
    render({ prevScriptType: 'sceneHeading' });
    expect(labels().sort()).toEqual(['Action', 'Dialogue (character)', 'Dual Dialogue']);
  });

  it('after a name line: Parenthetical (leading) and plain Dialogue', () => {
    render({ prevScriptType: 'character', suggestType: 'parenthetical' as never });
    expect(labels()).toEqual(['Parenthetical', 'Dialogue']);
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

  // v4.59: Customize ▸ Editor ▸ Element Suggestions.
  it("'all' mode switches the grammar filter off", () => {
    useEditorStore.setState({ suggestionMode: 'all' });
    try {
      render({ prevScriptType: 'sceneHeading' });
      expect(labels()).toContain('Transition');
      expect(labels()).toContain('General');
    } finally {
      useEditorStore.setState({ suggestionMode: 'smart' });
    }
  });

  it('user-edited rules drive the filter', () => {
    useEditorStore.setState({ suggestionRules: { sceneHeading: ['shot', 'action'] } });
    try {
      render({ prevScriptType: 'sceneHeading' });
      expect(labels().sort()).toEqual(['Action', 'Shot']);
    } finally {
      useEditorStore.setState({ suggestionRules: null });
    }
  });
});
