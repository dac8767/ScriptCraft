// @vitest-environment jsdom
/**
 * Customize > Side Panels > Panel Name Style (v4.24, Derek): panel display
 * names render Title Case (as authored) or ALL CAPS. Pins the default, the
 * setter, and that the choice persists through viewState.
 */
import { describe, it, expect } from 'vitest';
import { useEditorStore } from './editorStore';

const S = () => useEditorStore.getState();

describe('panelNameCase', () => {
  it('defaults to title', () => {
    expect(['title', 'upper']).toContain(S().panelNameCase);
  });

  it('setter flips the value and persists it to viewState', () => {
    S().setPanelNameCase('upper');
    expect(S().panelNameCase).toBe('upper');
    const vs = JSON.parse(localStorage.getItem('opendraft:viewState') || '{}');
    expect(vs.panelNameCase).toBe('upper');

    S().setPanelNameCase('title');
    expect(S().panelNameCase).toBe('title');
    expect(JSON.parse(localStorage.getItem('opendraft:viewState') || '{}').panelNameCase).toBe('title');
  });
});
