/**
 * nativeMenuSync (v4.86) — the ampersand escape.
 *
 * Derek saw "Spelling  Grammar" in the native Project menu. muda reads a lone
 * `&` in a menu label as a mnemonic marker and strips it, so every label with
 * an ampersand quietly lost it — and only in the NATIVE bar, which is why it
 * survived so long (the in-window menu renders the same labels correctly).
 *
 * The escape lives at the sync boundary, not in the labels, because the labels
 * are shared with the in-window bar. These pin that boundary.
 */
import { describe, it, expect } from 'vitest';
import { nativeText, displayShortcutToAccelerator } from './nativeMenuSync';

describe('nativeText — ampersands survive the native menu bar', () => {
  it('doubles a lone ampersand (muda\'s literal-& escape)', () => {
    expect(nativeText('Spelling & Grammar')).toBe('Spelling && Grammar');
    expect(nativeText('Find & Replace…')).toBe('Find && Replace…');
    expect(nativeText('Grammar & Spelling Settings')).toBe('Grammar && Spelling Settings');
    expect(nativeText('Mores & Continueds')).toBe('Mores && Continueds');
  });

  it('leaves ampersand-free labels exactly as they are', () => {
    for (const label of ['File', 'Show Rulers', 'Working Notes', 'Go to Page…', '']) {
      expect(nativeText(label)).toBe(label);
    }
  });

  it('escapes every ampersand in a label, not just the first', () => {
    expect(nativeText('A & B & C')).toBe('A && B && C');
  });
});

describe('displayShortcutToAccelerator (unchanged by the escape)', () => {
  it('maps the symbol form', () => {
    expect(displayShortcutToAccelerator('⌘⇧S')).toBe('Cmd+Shift+S');
  });
  it('maps the written form', () => {
    expect(displayShortcutToAccelerator('Ctrl+Shift+S')).toBe('Ctrl+Shift+S');
  });
  it('returns undefined when there is no key left', () => {
    expect(displayShortcutToAccelerator(undefined)).toBeUndefined();
    expect(displayShortcutToAccelerator('⌘')).toBeUndefined();
  });
});
