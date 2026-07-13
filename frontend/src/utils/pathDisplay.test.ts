import { describe, it, expect } from 'vitest';
import { shortenPathToFit } from './pathDisplay';

// A fits-predicate with a plain character budget stands in for pixel
// measurement — the function only ever asks "does this string fit?".
const maxChars = (n: number) => (s: string) => s.length <= n;

describe('shortenPathToFit — paths shorten at "/" boundaries, never mid-segment', () => {
  const path = '/Users/dcarl/Downloads/';

  it('returns the path untouched when it fits', () => {
    expect(shortenPathToFit(path, maxChars(80))).toBe('/Users/dcarl/Downloads/');
  });

  it('the screenshot bug: "…s/dcarl/Downloads/" must be "…/dcarl/Downloads/"', () => {
    // 19 chars is exactly enough for the mid-segment cut the CSS used to
    // produce — the correct answer drops the whole "Users" segment instead.
    const out = shortenPathToFit(path, maxChars(19));
    expect(out).toBe('…/dcarl/Downloads/');
    expect(out).not.toMatch(/…[^/]/); // nothing but "/" may follow the ellipsis
  });

  it('keeps dropping segments until it fits', () => {
    expect(shortenPathToFit(path, maxChars(12))).toBe('…/Downloads/');
  });

  it('never returns a bare "…/" — the last segment survives even when too long', () => {
    expect(shortenPathToFit(path, maxChars(3))).toBe('…/Downloads/');
  });

  it('handles paths without a trailing slash', () => {
    expect(shortenPathToFit('/Users/dcarl/Desktop/Scripts', maxChars(17))).toBe('…/Desktop/Scripts');
  });

  it('a path with no slashes at all comes back whole behind the ellipsis', () => {
    expect(shortenPathToFit('OneBigName', maxChars(4))).toBe('…OneBigName');
  });
});
