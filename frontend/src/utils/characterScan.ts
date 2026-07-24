// v4.23, Derek: "Scan Script" — the discovery step behind the Character tool's
// "From Script" tab. Given the script's action lines, find where each character
// is introduced and pull a one-sentence description + an age hint from it.
//
// This is the logic-heavy part of the scan, so it lives here as pure functions
// (no editor / no store) that a test can drive directly — the repo's habit of
// "feed it text and read back what it produced" is how the worst bugs get caught.

export interface ScannedCharacter {
  /** Uppercase canonical name (as it appears as a cue, or in ALL CAPS in action). */
  name: string;
  /** One-sentence description pulled from the introducing action line ('' if none). */
  description: string;
  /** Age hint pulled from just after the name, e.g. "30s", "40", "25" ('' if none). */
  age: string;
  /** `cue` = speaks in the script (has a Character element); `referred` = only
   *  mentioned in ALL CAPS in an action line (a non-speaking / off-screen name). */
  source: 'cue' | 'referred';
}

/**
 * Index of the first occurrence of `name` in `text` where it stands alone as an
 * ALL-CAPS token — i.e. not glued to a letter on either side, so "SARAH" matches
 * "SARAH (30s)" but not "SARAHS" (plural) or lowercase "sarah". Returns -1 if
 * there is no standalone occurrence.
 */
function indexOfStandalone(text: string, name: string): number {
  if (!name) return -1;
  let from = 0;
  while (from <= text.length - name.length) {
    const idx = text.indexOf(name, from);
    if (idx === -1) return -1;
    const before = idx > 0 ? text[idx - 1] : ' ';
    const after = idx + name.length < text.length ? text[idx + name.length] : ' ';
    if (!/[a-zA-Z]/.test(before) && !/[a-zA-Z]/.test(after)) return idx;
    from = idx + 1;
  }
  return -1;
}

/**
 * Find where `name` is introduced across `actionTexts` (document order) and
 * extract the sentence containing it plus an age hint. Screenwriters introduce
 * characters like: "SARAH CHEN (30s, sharp eyes) sits alone." — so we grab the
 * whole sentence as the description and the parenthetical/number right after the
 * name as the age. Returns empty strings when nothing usable is found.
 */
export function extractCharacterIntro(
  actionTexts: string[],
  name: string,
): { description: string; age: string } {
  for (const text of actionTexts) {
    const idx = indexOfStandalone(text, name);
    if (idx === -1) continue;

    // Sentence boundaries around the name (stop at '.' or a line break).
    let sentStart = idx;
    while (sentStart > 0 && text[sentStart - 1] !== '.' && text[sentStart - 1] !== '\n') sentStart--;
    let sentEnd = idx + name.length;
    while (sentEnd < text.length && text[sentEnd] !== '.' && text[sentEnd] !== '\n') sentEnd++;
    if (sentEnd < text.length && text[sentEnd] === '.') sentEnd++;

    const sentence = text.slice(sentStart, sentEnd).trim();
    // Too short to say anything — keep looking in later action lines.
    if (sentence.length <= 10) continue;

    // Age from the parenthetical / number right after the name:
    // "SARAH (30s, ...)", "MARCUS, 40s,", "(25)".
    const afterName = text.slice(idx + name.length, idx + name.length + 60);
    const ageMatch = afterName.match(/\(?(\d{1,2}0?s?|\d{1,2})\)?[,\s]/);
    return { description: sentence, age: ageMatch ? ageMatch[1] : '' };
  }
  return { description: '', age: '' };
}

/**
 * Build the reviewable "Scan Script" list: speaking cue characters first (in the
 * order given), then referred names, each enriched with a description + age from
 * `actionTexts`. Names are de-duplicated across both groups (a cue wins over a
 * referred mention of the same name).
 */
export function buildScanList(
  actionTexts: string[],
  cueNames: string[],
  referredNames: string[],
): ScannedCharacter[] {
  const results: ScannedCharacter[] = [];
  const seen = new Set<string>();
  const add = (name: string, source: 'cue' | 'referred') => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    results.push({ name, source, ...extractCharacterIntro(actionTexts, name) });
  };
  for (const name of cueNames) add(name, 'cue');
  for (const name of referredNames) add(name, 'referred');
  return results;
}

/**
 * v4.24 (Derek): the From Script tab shows only names that still need action —
 * referred names the writer already classified drop off, and ANY name that has
 * a character profile drops off (it has an entry; nothing left to add).
 */
export function filterScanList(
  results: ScannedCharacter[] | null,
  referredTags: Record<string, unknown>,
  profileNames: ReadonlySet<string>,
): ScannedCharacter[] {
  if (!results) return [];
  return results.filter(
    (r) => !(r.source === 'referred' && referredTags[r.name]) && !profileNames.has(r.name),
  );
}
