// @vitest-environment jsdom
/**
 * Editor View customization (v4.22) — the toolbar's Editor View dropdown is a
 * hide/reorder list (Customize ▸ Editor). Page can never be hidden.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, EDITOR_VIEWS } from './settingsStore';

const KEY = 'opendraft:editorViews';
const ids = () => useSettingsStore.getState().getEffectiveEditorViews().map((v) => v.id);

beforeEach(() => {
  localStorage.removeItem(KEY);
  useSettingsStore.setState({ editorViewOrder: [], editorViewHidden: [] });
});

describe('editor views', () => {
  it('defaults to all views in canonical order', () => {
    expect(ids()).toEqual(EDITOR_VIEWS.map((v) => v.id));
    expect(ids()).toContain('page');
  });

  it('hides a view and shows it again', () => {
    const s = useSettingsStore.getState();
    s.setEditorViewHidden(['preview']);
    expect(ids()).not.toContain('preview');
    s.setEditorViewHidden([]);
    expect(ids()).toContain('preview');
  });

  it('never hides the required Page view', () => {
    useSettingsStore.getState().setEditorViewHidden(['page', 'preview']);
    expect(useSettingsStore.getState().editorViewHidden).not.toContain('page');
    expect(ids()).toContain('page');
  });

  it('applies a custom order', () => {
    useSettingsStore.getState().setEditorViewOrder(['preview', 'page', 'continuous']);
    expect(ids()[0]).toBe('preview');
  });

  it('reset restores the defaults', () => {
    const s = useSettingsStore.getState();
    s.setEditorViewOrder(['preview', 'page']);
    s.setEditorViewHidden(['continuous']);
    s.resetEditorViews();
    expect(ids()).toEqual(EDITOR_VIEWS.map((v) => v.id));
  });
});
