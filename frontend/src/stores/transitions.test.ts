// @vitest-environment jsdom
/**
 * Transition customization (v4.22) — the editor's Transition auto-complete list
 * is driven by formattingTemplateStore so the picker and Customize ▸ Script
 * Editor can never drift. These cover the logic: dedupe, hide/show built-ins,
 * remove customs, re-adding a hidden built-in un-hides it, and persistence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useFormattingTemplateStore, DEFAULT_TRANSITIONS } from './formattingTemplateStore';

const KEY = 'opendraft:transitionOverrides';

beforeEach(() => {
  localStorage.removeItem(KEY);
  useFormattingTemplateStore.setState({ customTransitions: [], hiddenTransitions: [], transitionOrder: [] });
});

describe('transition customization', () => {
  it('WIPE TO: ships as a built-in default', () => {
    expect(DEFAULT_TRANSITIONS).toContain('WIPE TO:');
  });

  it('effective list is the defaults by default', () => {
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()).toEqual(DEFAULT_TRANSITIONS);
  });

  it('adds a custom transition and persists it', () => {
    useFormattingTemplateStore.getState().addTransition('MATCH CUT TO:');
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()).toContain('MATCH CUT TO:');
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    expect(raw.custom).toEqual(['MATCH CUT TO:']);
  });

  it('will not add a duplicate (case-insensitive) of a default or custom', () => {
    const s = useFormattingTemplateStore.getState();
    s.addTransition('cut to:');            // dup of the CUT TO: default
    s.addTransition('MATCH CUT TO:');
    s.addTransition('match cut to:');      // dup of the custom
    expect(useFormattingTemplateStore.getState().customTransitions).toEqual(['MATCH CUT TO:']);
  });

  it('hides a built-in without deleting it, and shows it again', () => {
    const s = useFormattingTemplateStore.getState();
    s.setTransitionHidden('FADE TO:', true);
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()).not.toContain('FADE TO:');
    // The built-in is still a default — only hidden.
    expect(DEFAULT_TRANSITIONS).toContain('FADE TO:');
    s.setTransitionHidden('FADE TO:', false);
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()).toContain('FADE TO:');
  });

  it('re-adding a hidden built-in un-hides it rather than creating a custom', () => {
    const s = useFormattingTemplateStore.getState();
    s.setTransitionHidden('DISSOLVE TO:', true);
    s.addTransition('dissolve to:');
    const st = useFormattingTemplateStore.getState();
    expect(st.hiddenTransitions).not.toContain('DISSOLVE TO:');
    expect(st.customTransitions).toEqual([]);
    expect(st.getEffectiveTransitions()).toContain('DISSOLVE TO:');
  });

  it('removes a custom transition', () => {
    const s = useFormattingTemplateStore.getState();
    s.addTransition('SMASH CUT TO:');
    s.removeCustomTransition('SMASH CUT TO:');
    expect(useFormattingTemplateStore.getState().customTransitions).toEqual([]);
  });

  it('orders effective list defaults-first, then customs', () => {
    useFormattingTemplateStore.getState().addTransition('ZZZ TO:');
    const eff = useFormattingTemplateStore.getState().getEffectiveTransitions();
    expect(eff[eff.length - 1]).toBe('ZZZ TO:');
    expect(eff.slice(0, DEFAULT_TRANSITIONS.length)).toEqual(DEFAULT_TRANSITIONS);
  });

  it('applies a drag order over the union', () => {
    const s = useFormattingTemplateStore.getState();
    // Move WIPE TO: to the front, keep the rest after it.
    const rest = DEFAULT_TRANSITIONS.filter((t) => t !== 'WIPE TO:');
    s.setTransitionOrder(['WIPE TO:', ...rest]);
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()[0]).toBe('WIPE TO:');
  });

  it('a hidden built-in keeps its ordered place when shown again', () => {
    const s = useFormattingTemplateStore.getState();
    s.setTransitionOrder(['WIPE TO:', ...DEFAULT_TRANSITIONS.filter((t) => t !== 'WIPE TO:')]);
    s.setTransitionHidden('WIPE TO:', true);
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()).not.toContain('WIPE TO:');
    s.setTransitionHidden('WIPE TO:', false);
    expect(useFormattingTemplateStore.getState().getEffectiveTransitions()[0]).toBe('WIPE TO:');
  });

  it('reset clears customs and un-hides everything', () => {
    const s = useFormattingTemplateStore.getState();
    s.addTransition('MY TO:');
    s.setTransitionHidden('CUT TO:', true);
    s.resetTransitions();
    const st = useFormattingTemplateStore.getState();
    expect(st.customTransitions).toEqual([]);
    expect(st.hiddenTransitions).toEqual([]);
    expect(st.getEffectiveTransitions()).toEqual(DEFAULT_TRANSITIONS);
  });
});
