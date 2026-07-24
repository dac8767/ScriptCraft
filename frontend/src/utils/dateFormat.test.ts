/**
 * dateFormat — the app-wide date display registry (Settings > General) and the
 * stored-date parser. These pin: the exact output of every deterministic
 * DATE_FORMATS entry against fixed dates (including zero-padding, which is what
 * separates 'short'/'iso' from 'us'/'european'), the registry's id/name order
 * (it IS the Settings dropdown), formatAppDate's silent fallback to 'short' for
 * an unknown id (persisted settings could carry a stale id), and parseISODate's
 * local-midnight construction plus its strict-shape / loose-range behavior.
 *
 * 'local' and 'friendly' delegate to toLocaleDateString, whose output depends on
 * the runtime's locale/ICU data — those get stable-property assertions only
 * (non-empty, contains the year), never exact strings.
 */
import { describe, it, expect } from 'vitest';
import type { DateFormatId } from './dateFormat';
import { DATE_FORMATS, formatAppDate, parseISODate } from './dateFormat';

// Local-time constructors, so getMonth()/getDate() in the formatters see exactly
// these components regardless of the machine's time zone.
const july4 = new Date(2026, 6, 4);      // single-digit month + day → shows padding
const dec31 = new Date(1999, 11, 31);    // double-digit month + day, century edge

const fmt = (id: DateFormatId, d: Date) => DATE_FORMATS.find((f) => f.id === id)!.format(d);

describe('DATE_FORMATS registry', () => {
  it('keeps the ids and display names in Settings-dropdown order', () => {
    expect(DATE_FORMATS.map((f) => f.id)).toEqual(['short', 'local', 'friendly', 'us', 'european', 'iso']);
    expect(DATE_FORMATS.map((f) => f.name)).toEqual(['Short', 'Local', 'Friendly', 'US', 'European', 'ISO']);
  });

  it('short → zero-padded MM/DD/YY with a two-digit year', () => {
    expect(fmt('short', july4)).toBe('07/04/26');
    expect(fmt('short', dec31)).toBe('12/31/99');
  });

  it('us → unpadded M/D/YYYY', () => {
    expect(fmt('us', july4)).toBe('7/4/2026');
    expect(fmt('us', dec31)).toBe('12/31/1999');
  });

  it('european → unpadded D/M/YYYY', () => {
    expect(fmt('european', july4)).toBe('4/7/2026');
    expect(fmt('european', dec31)).toBe('31/12/1999');
  });

  it('iso → zero-padded YYYY-MM-DD', () => {
    expect(fmt('iso', july4)).toBe('2026-07-04');
    expect(fmt('iso', dec31)).toBe('1999-12-31');
  });

  // 'local' and 'friendly' call toLocaleDateString — exact output varies by
  // locale/ICU build, so only stable aspects are asserted (see header).
  it('local → some non-empty locale rendering that mentions the year', () => {
    const out = fmt('local', july4);
    expect(out.length).toBeGreaterThan(0);
    // Two-digit-year locales exist, so accept either '2026' or '26'.
    expect(out).toMatch(/26/);
  });

  it('friendly → some non-empty long-form rendering with the 4-digit year', () => {
    const out = fmt('friendly', july4);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain('2026'); // year: 'numeric' always yields the full year
  });
});

describe('formatAppDate', () => {
  it('dispatches to the entry matching the id', () => {
    expect(formatAppDate(july4, 'iso')).toBe('2026-07-04');
    expect(formatAppDate(july4, 'european')).toBe('4/7/2026');
  });

  it('falls back to Short for an id not in the registry', () => {
    // TypeScript forbids this at compile time, but a stale persisted setting
    // can still deliver one at runtime — the `?? DATE_FORMATS[0]` catches it.
    expect(formatAppDate(july4, 'bogus' as DateFormatId)).toBe('07/04/26');
  });
});

describe('parseISODate', () => {
  it('parses YYYY-MM-DD into a LOCAL date at midnight (not UTC-shifted)', () => {
    const d = parseISODate('2026-07-04')!;
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);   // 0-based July
    expect(d.getDate()).toBe(4);
    // Local midnight in every time zone — the whole reason this helper exists
    // instead of new Date('2026-07-04'), which is UTC and shifts the day
    // west of Greenwich.
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('rejects anything that is not exactly \\d{4}-\\d{2}-\\d{2}', () => {
    expect(parseISODate('')).toBeNull();
    expect(parseISODate('2026-7-04')).toBeNull();      // unpadded month
    expect(parseISODate('2026-07-4')).toBeNull();      // unpadded day
    expect(parseISODate('26-07-04')).toBeNull();       // two-digit year
    expect(parseISODate('2026/07/04')).toBeNull();     // wrong separator
    expect(parseISODate('2026-07-04T00:00:00')).toBeNull(); // trailing time part
    expect(parseISODate(' 2026-07-04')).toBeNull();    // leading whitespace
    expect(parseISODate('not a date')).toBeNull();
  });

  it('rejects impossible dates instead of letting the Date constructor roll them over', () => {
    expect(parseISODate('2026-13-45')).toBeNull();   // month 13, day 45
    expect(parseISODate('2026-02-30')).toBeNull();   // Feb has no 30th
    expect(parseISODate('2026-00-00')).toBeNull();   // month 0, day 0
    // Real leap-day still parses; the same day in a non-leap year does not.
    const leap = parseISODate('2028-02-29')!;
    expect([leap.getFullYear(), leap.getMonth(), leap.getDate()]).toEqual([2028, 1, 29]);
    expect(parseISODate('2026-02-29')).toBeNull();
  });
});
