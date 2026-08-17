/**
 * selectCharacterList — which characters the Characters tool shows, in what
 * order.
 *
 * v7.45: lifted out of CharacterProfiles, where it was a useMemo. It reads no
 * editor and no store — everything it needs is an argument — which is why it
 * can be a util at all, and why it is worth testing: the list a writer sees is
 * assembled from two sources through three filters and five sort modes, and
 * every one of those is a place a name can wrongly appear or wrongly vanish.
 *
 * Not quite side-effect free, and worth knowing: the has-description filter
 * calls stripHtml, which sanitizes through DOMPurify and therefore needs a
 * DOM. Its test file says jsdom for that one line.
 *
 * THE ONE THAT ALREADY BIT. The list is the union of PROFILES and the cues
 * currently in the script. The `characters` store is deliberately NOT a third
 * source: it lags, so including it re-added names the writer had just removed
 * and Remove appeared to do nothing. That is a data-flow decision, not an
 * oversight, and it is now held by a test rather than by a comment alone.
 */
import { stripHtml } from './stripHtml';
import type { CharacterProfile } from '../stores/editorStore';

export type CharacterSortBy = 'name' | 'importance' | 'scenes' | 'dialogues' | 'appearance';

export interface CharStats {
  dialogueCount: number;
  sceneCount: number;
  scenes: string[];
  appearanceOrder: number;
}

export interface CharacterListOptions {
  /** Saved profiles. May include names no longer cued in the script.
   *  Only `name` is required — the filters below already treat a missing
   *  image list or description as "hasn't got one", so demanding them here
   *  would be the type claiming more than the code needs. */
  characterProfiles: (Pick<CharacterProfile, 'name'>
    & Partial<Pick<CharacterProfile, 'images' | 'description'>>)[];
  /** Character cues present in the script RIGHT NOW. */
  scriptCharacterNames: Set<string>;
  /** Header search box. Matched case-insensitively as a substring. */
  searchQuery: string;
  sortBy: CharacterSortBy;
  /** Per-character counts, keyed by name. Absent = zero for every sort. */
  charStats: Map<string, CharStats>;
  filterInScript: boolean;
  filterHasImage: boolean;
  filterHasDesc: boolean;
}

export function selectCharacterList(o: CharacterListOptions): string[] {
  // Union of profiles (which may be orphaned) and the cues present in the
  // script right now. See the header for why the `characters` store is not a
  // third source.
  const nameSet = new Set<string>();
  for (const p of o.characterProfiles) nameSet.add(p.name);
  for (const name of o.scriptCharacterNames) nameSet.add(name);
  let list = Array.from(nameSet);

  if (o.searchQuery) {
    const q = o.searchQuery.toUpperCase();
    list = list.filter((n) => n.includes(q));
  }
  // v6.12, Derek: the header's Filter dimensions.
  if (o.filterInScript) list = list.filter((n) => o.scriptCharacterNames.has(n));
  if (o.filterHasImage || o.filterHasDesc) {
    const byName = new Map(o.characterProfiles.map((p) => [p.name, p]));
    if (o.filterHasImage) list = list.filter((n) => (byName.get(n)?.images?.length ?? 0) > 0);
    if (o.filterHasDesc) {
      list = list.filter((n) => stripHtml(byName.get(n)?.description || '').trim().length > 0);
    }
  }

  list.sort((a, b) => {
    const sa = o.charStats.get(a);
    const sb = o.charStats.get(b);
    switch (o.sortBy) {
      case 'name':
        return a.localeCompare(b);
      case 'importance':
        // scenes + dialogues descending
        return ((sb?.sceneCount ?? 0) + (sb?.dialogueCount ?? 0))
             - ((sa?.sceneCount ?? 0) + (sa?.dialogueCount ?? 0));
      case 'scenes':
        return (sb?.sceneCount ?? 0) - (sa?.sceneCount ?? 0);
      case 'dialogues':
        return (sb?.dialogueCount ?? 0) - (sa?.dialogueCount ?? 0);
      case 'appearance':
        return (sa?.appearanceOrder ?? 999) - (sb?.appearanceOrder ?? 999);
      default:
        return 0;
    }
  });

  return list;
}
