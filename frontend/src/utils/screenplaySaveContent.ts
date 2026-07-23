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
    _generalNotes: store.generalNotes,
    _shelf: store.shelfCards,
    _tags: store.tags,
    _tagCategories: store.tagCategories,
    _characterProfiles: store.characterProfiles,
    _characterRelationships: store.characterRelationships,
    _characterCustomFields: store.characterCustomFields,
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
    _grammarCheckEnabled: store.grammarCheckEnabled,
    _sceneNumbersVisible: store.sceneNumbersVisible,
    _sceneNumbersLocked: store.sceneNumbersLocked,
    _pageLayout: store.pageLayout,
  };
}
