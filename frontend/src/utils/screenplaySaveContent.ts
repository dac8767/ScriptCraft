// v4.24: Save-payload + header/footer field composition, lifted out of the
// 4.5k-line ScreenplayEditor so the one critical function here — composeSaveContent
// — can be unit-tested in isolation (it had zero coverage, and a forked copy of
// its extras list once shipped a bug that wiped Outline beats on collab teardown).
import { useEditorStore } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { spellChecker } from '../editor/spellchecker';
import { grammarIgnore } from '../editor/grammar/grammarIgnore';

/** Resolve dynamic field placeholders in header/footer text. */
export function resolveHFFields(
  text: string,
  pageNum: number,
  totalPages: number,
  title: string,
  revisionColor: string,
): string {
  if (!text) return '';
  return text
    .replace(/\{page\}/gi, String(pageNum))
    .replace(/\{pages\}/gi, String(totalPages))
    .replace(/\{title\}/gi, title)
    .replace(/\{date\}/gi, new Date().toLocaleDateString())
    .replace(/\{revision\}/gi, revisionColor);
}

/**
 * Drop every underscore extra from a saved payload, leaving only the
 * ProseMirror doc. The inverse of composeSaveContent — use this instead of
 * hand-listing the extras at each load site: five hand-forked destructuring
 * lists used to exist, each missing different keys, and every new extra
 * meant updating all of them (or, in practice, none of them).
 */
export function stripSaveExtras(content: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) {
    if (!k.startsWith('_')) out[k] = v;
  }
  return out;
}

/**
 * Compose the FULL save payload: the ProseMirror doc plus every underscore
 * extra (tool data, dictionaries, layout, draft label). This is the ONLY
 * place the extras list may live — every save path (manual save, Save As,
 * autosave, snapshots, collab teardown) must serialize through it. A partial
 * copy of this list in the collab stop path once wiped Outline beats and
 * everything else it didn't know about; never fork this list again.
 */
export function composeSaveContent(doc: Record<string, unknown>): Record<string, unknown> {
  const store = useEditorStore.getState();
  const tplStore = useFormattingTemplateStore.getState();
  return {
    ...doc,
    _notes: store.notes,
    _markups: store.markups,
    _generalNotes: store.generalNotes,
    _shelf: store.shelfCards,
    _tags: store.tags,
    _tagCategories: store.tagCategories,
    _characterProfiles: store.characterProfiles,
    _characterRelationships: store.characterRelationships,
    _characterCustomFields: store.characterCustomFields,
    // v4.24 (Derek batch 1-2): the From Script tab's classifications and scan
    // list ride in the script file like every other character datum. They were
    // previously only mirrored through collabSync's Yjs map — Local-only
    // sessions lost every classification on relaunch.
    _referredTags: store.referredTags,
    _characterScan: store.scanResults,
    _beats: store.beats,
    _beatColumns: store.beatColumns,
    _beatArrangeMode: store.beatArrangeMode,
    // v2.30: outline variation tabs. _beats/_beatColumns above are the
    // VIEWED tab's live data; the other tabs are parked in the stash.
    _outlineTabs: store.outlineTabs,
    _outlineViewedTab: store.viewedOutlineTab,
    _outlineBarTab: store.outlineBarTab,
    _outlineStash: store.outlineStash,
    _draftLabel: store.draftLabel,
    _templateId: tplStore.activeTemplateId,
    _ignoredWords: spellChecker.getIgnoredWords(),
    _ignoredOnce: spellChecker.getIgnoredOnce(),
    // Project dictionary lives on the Project entity now; keep the script
    // field empty so older clients don't show stale words after migration.
    _customDictWords: [],
    _enabledGlobalDicts: spellChecker.getEnabledGlobalDicts(),
    _projectDictEnabled: spellChecker.isProjectDictionaryEnabled(),
    _enabledLanguages: spellChecker.getEnabledLanguages(),
    _ignoredGrammarRules: grammarIgnore.getIgnoredRules(),
    _ignoredGrammarOnce: grammarIgnore.getIgnoredOnce(),
    _spellCheckEnabled: store.spellCheckEnabled,
    // v4.77: the user's EXPLICIT as-you-type choice (null = never toggled —
    // the script follows the Settings default). _spellCheckEnabled above
    // stays for older builds, but it stamps the current STATE on every save,
    // which is exactly why it can't be read back as a choice.
    _spellCheckChoice: store.spellCheckChoice,
    _grammarCheckEnabled: store.grammarCheckEnabled,
    _sceneNumbersVisible: store.sceneNumbersVisible,
    _sceneNumbersLocked: store.sceneNumbersLocked,
    _pageLayout: store.pageLayout,
  };
}

/** v4.77 — ONE rule for restoring as-you-type spell check on load (both the
 *  cloud and local-file paths read this; they used to disagree). An explicit
 *  stored choice wins; a legacy `_spellCheckEnabled: true` was necessarily
 *  deliberate (the old default was off) so it counts as ON; anything else —
 *  absent, or the stamped-on-every-save legacy `false` — follows the
 *  Settings ▸ "Check spelling as you type" default. */
export function resolveSpellCheckOnLoad(
  c: Record<string, unknown>,
  settingDefault: boolean,
): { enabled: boolean; choice: 'on' | 'off' | null } {
  if (c._spellCheckChoice === 'on') return { enabled: true, choice: 'on' };
  if (c._spellCheckChoice === 'off') return { enabled: false, choice: 'off' };
  if (c._spellCheckEnabled === true) return { enabled: true, choice: null };
  return { enabled: settingDefault, choice: null };
}
