/**
 * Character-name helpers (v4.22, Derek).
 *
 * In a screenplay every character name is written in ALL CAPS — the full name
 * at the first mention ("SAM VEDU") and the bare first name / cue after that
 * ("SAM"). The Character tool shows them Title Case ("Sam Vedu", "Sam") and can
 * push edits back into the script, so all the parsing lives here where it can
 * be unit-tested away from the editor.
 */

/** ALL-CAPS (or any-case) name → Title Case: "SAM VEDU" → "Sam Vedu". Keeps the
 *  first letter of each word and of hyphen/apostrophe segments ("O'BRIEN" →
 *  "O'Brien", "MARY-JANE" → "Mary-Jane"). */
export function toTitleCaseName(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** First word of a name: "SAM VEDU" → "SAM". */
export function firstNameOf(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** Everything after the first word: "SAM VEDU" → "VEDU", "SAM" → "". */
export function lastNameOf(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

/** Join a first + last back into a full name; drops a blank last. */
export function joinName(first: string, last: string): string {
  const f = (first || '').trim();
  const l = (last || '').trim();
  return l ? `${f} ${l}` : f;
}

/** Escape a literal string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
