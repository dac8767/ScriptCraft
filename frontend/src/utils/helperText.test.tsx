// @vitest-environment jsdom
/**
 * helperText (v6.20) — the Helper Text override mechanics.
 * The DOM applier must swap title/placeholder attributes wherever the value
 * matches an overridden default, survive React writing the literal back (an
 * attribute mutation re-applies), and RESTORE the original when the override
 * is removed — data-ht-orig-* carries the app's own text.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { ht, installHelperTextDom } from './helperText';

const flush = () => new Promise((r) => setTimeout(r, 0));
let teardown: (() => void) | null = null;

beforeEach(() => {
  useEditorStore.setState({ helperTextOverrides: {} });
  document.body.innerHTML = '';
});
afterEach(() => { teardown?.(); teardown = null; });

describe('ht()', () => {
  it('returns the default until an override exists, then the override', () => {
    expect(ht('Delete')).toBe('Delete');
    useEditorStore.getState().setHelperTextOverride('Delete', 'Remove forever');
    expect(ht('Delete')).toBe('Remove forever');
    useEditorStore.getState().setHelperTextOverride('Delete', null);
    expect(ht('Delete')).toBe('Delete');
  });

  it('setting an override equal to the default clears it instead of storing a no-op', () => {
    useEditorStore.getState().setHelperTextOverride('Close', 'Close');
    expect(useEditorStore.getState().helperTextOverrides).toEqual({});
  });
});

describe('installHelperTextDom', () => {
  it('swaps existing titles and placeholders, and restores on override removal', async () => {
    document.body.innerHTML =
      '<button title="Delete">x</button><input placeholder="Search settings…">';
    teardown = installHelperTextDom();
    useEditorStore.getState().setHelperTextOverride('Delete', 'Remove');
    useEditorStore.getState().setHelperTextOverride('Search settings…', 'Find a knob…');
    await flush();
    const btn = document.querySelector('button')!;
    const inp = document.querySelector('input')!;
    expect(btn.getAttribute('title')).toBe('Remove');
    expect(btn.getAttribute('data-ht-orig-title')).toBe('Delete');
    expect(inp.getAttribute('placeholder')).toBe('Find a knob…');

    useEditorStore.getState().setHelperTextOverride('Delete', null);
    await flush();
    expect(btn.getAttribute('title')).toBe('Delete');
    expect(btn.hasAttribute('data-ht-orig-title')).toBe(false);
  });

  it('covers elements ADDED after install (the app renders constantly)', async () => {
    teardown = installHelperTextDom();
    useEditorStore.getState().setHelperTextOverride('Fullscreen', 'Big mode');
    const el = document.createElement('button');
    el.setAttribute('title', 'Fullscreen');
    document.body.appendChild(el);
    await flush();
    expect(el.getAttribute('title')).toBe('Big mode');
  });

  it('converges when React writes the literal back (attribute mutation)', async () => {
    document.body.innerHTML = '<button title="Close">x</button>';
    teardown = installHelperTextDom();
    useEditorStore.getState().setHelperTextOverride('Close', 'Shut');
    await flush();
    const btn = document.querySelector('button')!;
    expect(btn.getAttribute('title')).toBe('Shut');
    btn.setAttribute('title', 'Close');       // a re-render resetting the JSX literal
    await flush();
    expect(btn.getAttribute('title')).toBe('Shut');
  });

  it('carries line breaks through to the attribute (v6.24 multi-line)', async () => {
    document.body.innerHTML = '<button title="Fullscreen">x</button>';
    teardown = installHelperTextDom();
    useEditorStore.getState().setHelperTextOverride('Fullscreen', 'Big mode\nFills the screen');
    await flush();
    expect(document.querySelector('button')!.getAttribute('title')).toBe('Big mode\nFills the screen');
  });

  it('leaves un-overridden attributes alone', async () => {
    document.body.innerHTML = '<button title="Keep me">x</button>';
    teardown = installHelperTextDom();
    useEditorStore.getState().setHelperTextOverride('Something else', 'Whatever');
    await flush();
    const btn = document.querySelector('button')!;
    expect(btn.getAttribute('title')).toBe('Keep me');
    expect(btn.hasAttribute('data-ht-orig-title')).toBe(false);
  });
});
