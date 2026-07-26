// @vitest-environment jsdom
/**
 * v4.77, Derek: squiggles by default. The load-time rule the cloud AND local
 * paths share — an explicit stored choice wins; a legacy true was deliberate
 * (the old default was off); the legacy stamped-on-every-save `false` is
 * noise and falls through to the Settings default.
 */
import { describe, it, expect } from 'vitest';
import { resolveSpellCheckOnLoad } from './screenplaySaveContent';

describe('resolveSpellCheckOnLoad', () => {
  it('explicit choice wins over everything', () => {
    expect(resolveSpellCheckOnLoad({ _spellCheckChoice: 'off', _spellCheckEnabled: true }, true))
      .toEqual({ enabled: false, choice: 'off' });
    expect(resolveSpellCheckOnLoad({ _spellCheckChoice: 'on', _spellCheckEnabled: false }, false))
      .toEqual({ enabled: true, choice: 'on' });
  });

  it('legacy true counts as on (the old default was off, so it was chosen)', () => {
    expect(resolveSpellCheckOnLoad({ _spellCheckEnabled: true }, false))
      .toEqual({ enabled: true, choice: null });
  });

  it('legacy false is save-stamp noise — the Settings default applies', () => {
    expect(resolveSpellCheckOnLoad({ _spellCheckEnabled: false }, true))
      .toEqual({ enabled: true, choice: null });
    expect(resolveSpellCheckOnLoad({ _spellCheckEnabled: false }, false))
      .toEqual({ enabled: false, choice: null });
  });

  it('nothing stored — the Settings default applies', () => {
    expect(resolveSpellCheckOnLoad({}, true)).toEqual({ enabled: true, choice: null });
    expect(resolveSpellCheckOnLoad({}, false)).toEqual({ enabled: false, choice: null });
  });
});
