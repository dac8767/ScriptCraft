// @vitest-environment jsdom
/**
 * Shortcut combos (v2.84) — pins eventToCombo's normalization. The zoom
 * bindings are Mod+= / Mod+-, but the key most people PRESS for "plus" is
 * Shift+=: the Shift that produced the '+' must be dropped with it, or
 * Cmd+'+' yields Mod+Shift+= and never matches.
 */
import { describe, it, expect } from 'vitest';
import { eventToCombo } from './shortcuts';

const ev = (key: string, opts: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, ...opts });

describe('eventToCombo', () => {
  it('zoom keys: plain and shifted forms land on the same binding', () => {
    expect(eventToCombo(ev('=', { metaKey: true }))).toBe('Mod+=');
    expect(eventToCombo(ev('+', { metaKey: true, shiftKey: true }))).toBe('Mod+=');   // the v2.84 fix
    expect(eventToCombo(ev('-', { metaKey: true }))).toBe('Mod+-');
    expect(eventToCombo(ev('_', { metaKey: true, shiftKey: true }))).toBe('Mod+-');
    expect(eventToCombo(ev('0', { metaKey: true }))).toBe('Mod+0');
  });

  it('deliberate Shift combos keep their Shift', () => {
    expect(eventToCombo(ev('S', { metaKey: true, shiftKey: true }))).toBe('Mod+Shift+S');
    expect(eventToCombo(ev('Z', { ctrlKey: true, shiftKey: true }))).toBe('Mod+Shift+Z');
  });

  it('rejects bare keys and lone modifiers', () => {
    expect(eventToCombo(ev('a'))).toBeNull();
    expect(eventToCombo(ev('Shift', { shiftKey: true }))).toBeNull();
    expect(eventToCombo(ev('F7'))).toBe('F7');   // function keys stand alone
  });
});
