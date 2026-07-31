/**
 * v4.35 batch-v9 #2: the Scenes tool's filter predicate, shared by BOTH views.
 * The list (SceneNavigator) and the card wall (IndexCards) must narrow
 * identically, so the heading parser, the per-scene detail walk, the option
 * lists and the predicate itself live here — one source, no copies.
 */
import type { Node as PmNode } from '@tiptap/pm/model';
import type { SceneFilters, SceneInfo } from '../stores/editorStore';

// ── Scene heading parser ────────────────────────────────────────────────

export interface ParsedHeading {
  preamble: string;
  prefix: string;
  location: string;
  timeOfDay: string;
  raw: string;
}

const TIME_WORDS = 'DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|SUNSET|SUNRISE|LATER|CONTINUOUS|SAME TIME|MOMENTS LATER|SAME|MAGIC HOUR';
const PREFIX_RE = /(INT\.?\/?EXT\.?|EXT\.?\/?INT\.?|INT\.?|EXT\.?|I\/E\.?)\s+/i;

function normalisePrefix(raw: string): string {
  let p = raw.toUpperCase();
  if (p === 'INT/EXT' || p === 'INT/EXT.' || p === 'EXT/INT' || p === 'EXT/INT.' || p === 'I/E' || p === 'I/E.') return 'INT./EXT.';
  if (!p.endsWith('.')) p += '.';
  return p;
}

export function parseHeading(raw: string): ParsedHeading {
  let rest = raw.trim();
  let preamble = '';
  let prefix = '';
  let timeOfDay = '';

  const prefixMatch = rest.match(PREFIX_RE);
  if (prefixMatch && prefixMatch.index !== undefined) {
    preamble = rest.slice(0, prefixMatch.index);
    prefix = normalisePrefix(prefixMatch[1]);
    rest = rest.slice(prefixMatch.index + prefixMatch[0].length);
  }

  const dashTime = rest.match(new RegExp(`\\s+-\\s+(${TIME_WORDS})\\.?$`, 'i'));
  if (dashTime) {
    timeOfDay = dashTime[1].toUpperCase();
    rest = rest.slice(0, -dashTime[0].length);
  } else {
    const dotTime = rest.match(new RegExp(`\\.\\s*(${TIME_WORDS})\\.?$`, 'i'));
    if (dotTime) {
      timeOfDay = dotTime[1].toUpperCase();
      rest = rest.slice(0, -dotTime[0].length);
    }
  }

  const location = rest.replace(/^[\s.]+|[\s.]+$/g, '');
  return { preamble, prefix, location, timeOfDay, raw };
}

// ── Per-scene details the predicate matches against ─────────────────────

export interface SceneFilterDetail {
  characters: string[];
  location: string;
  prefix: string;
  timeOfDay: string;
}

/** Walk the document once, collecting each scene's character cues plus its
 *  parsed heading fields — the store's SceneInfo doesn't carry characters,
 *  only the doc knows them. One entry per sceneHeading, in doc order. */
export function computeSceneFilterDetails(doc: PmNode): SceneFilterDetail[] {
  const details: SceneFilterDetail[] = [];
  let currentChars = new Set<string>();
  let currentHeading = '';
  let inScene = false;

  const push = () => {
    const parsed = parseHeading(currentHeading);
    details.push({
      characters: Array.from(currentChars),
      location: parsed.location,
      prefix: parsed.prefix,
      timeOfDay: parsed.timeOfDay,
    });
  };

  doc.forEach((node) => {
    if (node.type.name === 'sceneHeading') {
      if (inScene) push();
      currentHeading = node.textContent || '';
      currentChars = new Set();
      inScene = true;
    } else if (node.type.name === 'character' && inScene) {
      // "LOLA (V.O.)" and "LOLA" are the same character
      const raw = node.textContent.trim().toUpperCase();
      const base = raw.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (base) currentChars.add(base);
    }
  });
  if (inScene) push();
  return details;
}

/** The Filter popover's dropdown option lists, derived from the same details
 *  the predicate matches — so a value you can pick always exists to match. */
export interface SceneFilterOptions {
  characters: string[];
  locations: string[];
  prefixes: string[];
  times: string[];
}

export function sceneFilterOptions(details: SceneFilterDetail[]): SceneFilterOptions {
  const characters = new Set<string>();
  const locations = new Set<string>();
  const prefixes = new Set<string>();
  const times = new Set<string>();
  for (const d of details) {
    d.characters.forEach((c) => characters.add(c));
    if (d.location) locations.add(d.location.toUpperCase());
    if (d.prefix) prefixes.add(d.prefix);
    if (d.timeOfDay) times.add(d.timeOfDay);
  }
  return {
    characters: Array.from(characters).sort(),
    locations: Array.from(locations).sort(),
    prefixes: Array.from(prefixes).sort(),
    times: Array.from(times).sort(),
  };
}

// ── The predicate ───────────────────────────────────────────────────────

/** One source for "how many filter dimensions are set" — the Filter chip
 *  shows the number; everything else only cares that it's non-zero. Each
 *  picked character counts individually. */
export function countActiveSceneFilters(f: SceneFilters): number {
  return f.characters.length + (f.location ? 1 : 0) + (f.prefix ? 1 : 0) +
    (f.time ? 1 : 0) + (f.color ? 1 : 0) + (f.synopsis ? 1 : 0);
}

/** Does one scene survive the filter panel + search bar? `query` and
 *  `synopsisPhrase` arrive pre-trimmed/lowercased ('' = not set). */
export function sceneMatchesFilters(
  scene: Pick<SceneInfo, 'heading' | 'synopsis' | 'color'>,
  detail: SceneFilterDetail,
  filters: SceneFilters,
  query: string,
  synopsisPhrase: string,
): boolean {
  // Search bar — matches heading or synopsis
  if (query) {
    const headingMatch = scene.heading.toLowerCase().includes(query);
    const synopsisMatch = (scene.synopsis || '').toLowerCase().includes(query);
    if (!headingMatch && !synopsisMatch) return false;
  }
  // Filter panel filters
  if (filters.characters.length > 0 && !filters.characters.every((c) => detail.characters.includes(c))) return false;
  if (filters.location && detail.location.toUpperCase() !== filters.location) return false;
  if (filters.prefix && detail.prefix !== filters.prefix) return false;
  if (filters.time && detail.timeOfDay !== filters.time) return false;
  if (filters.color && (scene.color || '') !== filters.color) return false;
  if (synopsisPhrase && !(scene.synopsis || '').toLowerCase().includes(synopsisPhrase)) return false;
  return true;
}

/** The indices of the scenes surviving `filters` + `search`, in doc order.
 *  A scene whose detail entry hasn't been computed yet (doc walk racing the
 *  store) is dropped, matching the list's original behavior. */
export function filterSceneIndices(
  scenes: SceneInfo[],
  details: SceneFilterDetail[],
  filters: SceneFilters,
  search: string,
): number[] {
  const query = search.trim().toLowerCase();
  const synopsisPhrase = filters.synopsis.trim().toLowerCase();
  if (countActiveSceneFilters(filters) === 0 && !query) return scenes.map((_, i) => i);
  return scenes.reduce((acc, scene, idx) => {
    const detail = details[idx];
    if (!detail) return acc;
    if (sceneMatchesFilters(scene, detail, filters, query, synopsisPhrase)) acc.push(idx);
    return acc;
  }, [] as number[]);
}

// ── Navigator: Scene Headings filter (v5.68) ────────────────────────────

/** v5.68, Derek: the Navigator filter window's "Scene Headings" section —
 *  INT. or EXT., location, and a contains-text field. Distinct from the
 *  Scenes tool's SceneFilters on purpose: the Navigator filters heading
 *  ROWS by the heading text alone (no synopsis/characters/colors there).
 *  The predicate lives here so the chrome popover (chip count) and the
 *  list body (row test) read ONE definition. */
export interface NavSceneFilters {
  intExt: 'all' | 'int' | 'ext';
  /** UPPERCASE location name, '' = all. Compared against parseHeading().location. */
  location: string;
  /** Free text; a heading survives when it contains it (case-insensitive). */
  contains: string;
}

export const EMPTY_NAV_SCENE_FILTERS: NavSceneFilters = { intExt: 'all', location: '', contains: '' };

/** Same INT/EXT reading as the Locations window (visibleLocations): the test
 *  is "does the prefix mention this kind", so "INT./EXT. CAR" passes both. */
export function navSceneHeadingMatch(heading: string, f: NavSceneFilters): boolean {
  if (f.intExt !== 'all') {
    const p = parseHeading(heading).prefix.toUpperCase();
    if (!p.includes(f.intExt === 'int' ? 'INT' : 'EXT')) return false;
  }
  if (f.location && parseHeading(heading).location.toUpperCase() !== f.location) return false;
  const q = f.contains.trim().toLowerCase();
  if (q && !heading.toLowerCase().includes(q)) return false;
  return true;
}

export function countActiveNavSceneFilters(f: NavSceneFilters): number {
  return (f.intExt !== 'all' ? 1 : 0) + (f.location ? 1 : 0) + (f.contains.trim() ? 1 : 0);
}

/** The distinct locations among `headings`, UPPERCASE, A–Z — the Navigator
 *  filter's location dropdown options. */
export function sceneHeadingLocations(headings: string[]): string[] {
  const set = new Set<string>();
  for (const h of headings) {
    const loc = parseHeading(h).location.toUpperCase();
    if (loc) set.add(loc);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
