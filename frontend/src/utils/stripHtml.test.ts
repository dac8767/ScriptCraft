// @vitest-environment jsdom
/**
 * The single stripHtml (consolidated from two drifted copies — see the module
 * header). Pins the two behaviors the merge exists for: full entity decoding
 * (the fdxExporter copy knew only 6 entities and exported "&mdash;" literally
 * into FDX cast descriptions) and spaced block boundaries (the
 * CharacterProfiles copy collapsed "a</p><p>b" to "ab").
 */
import { describe, it, expect } from 'vitest';
import { stripHtml } from './stripHtml';

describe('stripHtml', () => {
  it('strips tags, keeping inline text intact (no phantom spaces inside words)', () => {
    expect(stripHtml('<p>so<b>br</b>iety</p>')).toBe('sobriety');
  });

  it('spaces out block boundaries and <br>', () => {
    expect(stripHtml('<p>first</p><p>second</p>')).toBe('first second');
    expect(stripHtml('line one<br>line two<br/>line three')).toBe('line one line two line three');
    expect(stripHtml('<div>a</div><div>b</div>')).toBe('a b');
  });

  it('decodes named AND numeric entities — including the ones the old regex missed', () => {
    expect(stripHtml('sharp &amp; wary')).toBe('sharp & wary');
    expect(stripHtml('a&nbsp;beat')).toBe('a beat');
    expect(stripHtml('eyes &mdash; steady')).toBe('eyes — steady');
    expect(stripHtml('it&#8217;s her')).toBe('it’s her');
    expect(stripHtml('&lt;stage&gt; &quot;whisper&quot;')).toBe('<stage> "whisper"');
  });

  it('collapses whitespace and trims', () => {
    expect(stripHtml('  <p>  spaced   out  </p>  ')).toBe('spaced out');
  });

  it('returns empty string for empty/undefined-ish input', () => {
    expect(stripHtml('')).toBe('');
  });
});
