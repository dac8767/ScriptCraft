// v4.24: Spell-check / grammar / dictionaries slice — everything reached through
// Tools → Spelling & Grammar, the writing-suggestions panel, and the named
// dictionary library.
//
// This slice also owns the module-load helper infra that used to sit at the top
// of editorStore: the named custom-dictionary library, the "Add to Dictionary"
// targets, and the installed-Hunspell-language set. All three are persisted to
// localStorage and pushed into the shared `spellChecker` at import time — before
// any document opens — so those startup side-effects run when this module is
// first evaluated (editorStore imports it, so that is still app startup).
//
// `SpellingSettings` stays defined + exported in editorStore because viewState.ts
// type-imports it; we take it type-only here to avoid moving the shared type.
import type { StateCreator } from 'zustand';
import { spellChecker, PROJECT_DICT_TARGET } from '../../editor/spellchecker';
import { findLanguage, urlsFor } from '../../editor/languageCatalog';
import { _vs, saveViewState } from '../viewState';
import type { EditorState, SpellingSettings } from '../editorStore';

const DEFAULT_SPELLING_SETTINGS: Required<SpellingSettings> = {
  flagProperNouns: false,
};

// ── Custom dictionary library (named global word lists) ──
const DICTS_KEY = 'opendraft:dictionaries';
const LEGACY_DICT_KEY = 'opendraft:customDictionary';

function loadCustomDictionaries(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(DICTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const out: Record<string, string[]> = {};
        for (const [name, words] of Object.entries(parsed)) {
          if (Array.isArray(words)) out[name] = words.filter((w): w is string => typeof w === 'string');
        }
        return out;
      }
    }
    // Migrate the legacy single-global dictionary into a "Personal" entry.
    const legacy = localStorage.getItem(LEGACY_DICT_KEY);
    if (legacy) {
      try {
        const arr = JSON.parse(legacy);
        if (Array.isArray(arr)) {
          const migrated = { Personal: arr.filter((w): w is string => typeof w === 'string') };
          localStorage.setItem(DICTS_KEY, JSON.stringify(migrated));
          return migrated;
        }
      } catch { /* fall through */ }
    }
  } catch { /* localStorage unavailable */ }
  return {};
}

function saveCustomDictionaries(dicts: Record<string, string[]>) {
  try {
    localStorage.setItem(DICTS_KEY, JSON.stringify(dicts));
  } catch { /* localStorage unavailable */ }
}

const _initialDicts = loadCustomDictionaries();
// Push the loaded library to the spell checker immediately so it's in effect
// before any document is opened.
spellChecker.setGlobalDictionaries(_initialDicts);

// ── Add-to-Dictionary targets (global setting) ──
// Tracks which dictionaries the "Add to Dictionary" action writes to. Members
// are either PROJECT_DICT_TARGET or a global-dictionary name.
const ADD_TARGETS_KEY = 'opendraft:addTargets';
function loadAddTargets(): string[] {
  try {
    const raw = localStorage.getItem(ADD_TARGETS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.every((s) => typeof s === 'string') && arr.length > 0) {
        return arr;
      }
    }
  } catch { /* fall through */ }
  return [PROJECT_DICT_TARGET];
}
function saveAddTargets(targets: string[]) {
  try { localStorage.setItem(ADD_TARGETS_KEY, JSON.stringify(targets)); } catch { /* noop */ }
}
const _initialAddTargets = loadAddTargets();
spellChecker.setAddTargets(_initialAddTargets);

// ── Installed-language tracking (persisted set of language codes the user
//    has downloaded; the actual .aff/.dic blobs live in IndexedDB). ──
const INSTALLED_LANGS_KEY = 'opendraft:installedLanguages';
function loadInstalledLanguages(): string[] {
  try {
    const raw = localStorage.getItem(INSTALLED_LANGS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === 'string');
    }
  } catch { /* noop */ }
  return [];
}
function saveInstalledLanguages(codes: string[]) {
  try { localStorage.setItem(INSTALLED_LANGS_KEY, JSON.stringify(codes)); } catch { /* noop */ }
}

export interface SpellGrammarSlice {
  // Spell check
  spellCheckEnabled: boolean;
  toggleSpellCheck: () => void;
  setSpellCheckEnabled: (v: boolean) => void;
  /** v4.77, Derek: squiggles are the DEFAULT now. This is the user's explicit
   *  per-script choice — null means they never toggled, so the script follows
   *  Settings ▸ "Check spelling as you type". toggleSpellCheck (both UI
   *  surfaces) records it; loads restore it; saves persist it. The legacy
   *  boolean _spellCheckEnabled=false in old saves is NOISE (every save
   *  stamped the then-default), which is why it can't be trusted as a choice. */
  spellCheckChoice: 'on' | 'off' | null;
  setSpellCheckChoice: (v: 'on' | 'off' | null) => void;
  spellModalOpen: boolean;
  /** True while the docked Spelling & Grammar panel is mounted — suppresses the
   *  global floating SpellCheckModal so only one instance ever renders. */
  spellPanelMounted: boolean;
  setSpellPanelMounted: (v: boolean) => void;
  setSpellModalOpen: (open: boolean) => void;

  // Grammar / writing suggestions
  grammarCheckEnabled: boolean;
  toggleGrammarCheck: () => void;
  setGrammarCheckEnabled: (v: boolean) => void;
  grammarModalOpen: boolean;
  setGrammarModalOpen: (open: boolean) => void;
  /** True while the docked panel shows the Suggestions tab — suppresses the
   *  global floating WritingSuggestionsModal (same one-instance rule as
   *  spellPanelMounted). */
  grammarPanelMounted: boolean;
  setGrammarPanelMounted: (v: boolean) => void;
  grammarRulesPanelOpen: boolean;
  setGrammarRulesPanelOpen: (open: boolean) => void;
  /** Per-rule on/off switch. Missing key = enabled by default. */
  grammarRulesEnabled: Record<string, boolean>;
  setGrammarRuleEnabled: (ruleId: string, enabled: boolean) => void;
  /** Spell-checker preferences (proper-noun handling, etc.). */
  spellingSettings: Required<SpellingSettings>;
  setSpellingSetting: <K extends keyof SpellingSettings>(key: K, value: Required<SpellingSettings>[K]) => void;
  /** Global custom-dictionary library, keyed by user-chosen name. */
  customDictionaries: Record<string, string[]>;
  createGlobalDictionary: (name: string) => void;
  renameGlobalDictionary: (oldName: string, newName: string) => void;
  deleteGlobalDictionary: (name: string) => void;
  setGlobalDictionaryWords: (name: string, words: string[]) => void;
  dictionaryLibraryOpen: boolean;
  setDictionaryLibraryOpen: (open: boolean) => void;
  /** Dictionaries that "Add to Dictionary" writes to. Members are either
   *  PROJECT_DICT_TARGET (the per-project private dict) or a global-dict name. */
  addTargets: string[];
  setAddTargets: (targets: string[]) => void;
  /** Append a word to a global dictionary (used by add-to-dictionary submenu). */
  appendWordToGlobalDictionary: (name: string, word: string) => void;
  /** Codes of languages the user has downloaded (.aff/.dic cached in IndexedDB).
   *  Persisted so we can show their status before the cache is queried. */
  installedLanguages: string[];
  /** Trigger a Hunspell language install from the catalog. */
  installLanguage: (code: string) => Promise<{ ok: boolean; error?: string }>;
  /** Install a language from arbitrary `.aff`/`.dic` URLs (or a single base
   *  URL that points to both, e.g. a jsdelivr package root). */
  installLanguageFromUrls: (params: {
    code: string;
    label: string;
    affUrl: string;
    dicUrl: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Remove a previously-downloaded language. */
  uninstallLanguage: (code: string) => Promise<void>;
}

export const createSpellGrammarSlice: StateCreator<EditorState, [], [], SpellGrammarSlice> = (set) => ({
  // Spell check as you type is ON by default (v4.77, Derek: "like all text
  // editors"). A user toggle records an explicit per-script choice
  // (_spellCheckChoice) that wins over the Settings default on load; grammar
  // stays opt-in per document (_grammarCheckEnabled).
  spellCheckEnabled: false,
  // The UI toggle = the user CHOOSING — record the choice with the flip.
  toggleSpellCheck: () => set((s) => ({
    spellCheckEnabled: !s.spellCheckEnabled,
    spellCheckChoice: !s.spellCheckEnabled ? 'on' : 'off',
  })),
  setSpellCheckEnabled: (v) => set({ spellCheckEnabled: v }),
  spellCheckChoice: null,
  setSpellCheckChoice: (v) => set({ spellCheckChoice: v }),
  spellModalOpen: false,
  setSpellModalOpen: (open) => set({ spellModalOpen: open }),
  spellPanelMounted: false,
  setSpellPanelMounted: (v) => set({ spellPanelMounted: v }),

  grammarCheckEnabled: false,
  toggleGrammarCheck: () => set((s) => ({ grammarCheckEnabled: !s.grammarCheckEnabled })),
  setGrammarCheckEnabled: (v) => set({ grammarCheckEnabled: v }),
  grammarPanelMounted: false,
  setGrammarPanelMounted: (v) => set({ grammarPanelMounted: v }),
  grammarModalOpen: false,
  setGrammarModalOpen: (open) => set({ grammarModalOpen: open }),
  grammarRulesPanelOpen: false,
  setGrammarRulesPanelOpen: (open) => set({ grammarRulesPanelOpen: open }),
  grammarRulesEnabled: (_vs.grammarRulesEnabled as Record<string, boolean> | undefined) ?? {},
  setGrammarRuleEnabled: (ruleId, enabled) => set((s) => {
    const next = { ...s.grammarRulesEnabled, [ruleId]: enabled };
    saveViewState({ grammarRulesEnabled: next });
    return { grammarRulesEnabled: next };
  }),
  spellingSettings: { ...DEFAULT_SPELLING_SETTINGS, ...(_vs.spellingSettings ?? {}) },
  setSpellingSetting: (key, value) => set((s) => {
    const next = { ...s.spellingSettings, [key]: value };
    saveViewState({ spellingSettings: next });
    return { spellingSettings: next };
  }),
  customDictionaries: _initialDicts,
  createGlobalDictionary: (name) => set((s) => {
    const trimmed = name.trim();
    if (!trimmed || s.customDictionaries[trimmed]) return s;
    const next = { ...s.customDictionaries, [trimmed]: [] };
    saveCustomDictionaries(next);
    spellChecker.setGlobalDictionaries(next);
    return { customDictionaries: next };
  }),
  renameGlobalDictionary: (oldName, newName) => set((s) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return s;
    if (!(oldName in s.customDictionaries)) return s;
    if (trimmed in s.customDictionaries) return s;
    const next: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(s.customDictionaries)) {
      next[k === oldName ? trimmed : k] = v;
    }
    saveCustomDictionaries(next);
    spellChecker.setGlobalDictionaries(next);
    // If the renamed dict was enabled for the current project, swap the name.
    const enabled = spellChecker.getEnabledGlobalDicts();
    if (enabled.includes(oldName)) {
      spellChecker.setEnabledGlobalDicts(enabled.map((n) => (n === oldName ? trimmed : n)));
    }
    return { customDictionaries: next };
  }),
  deleteGlobalDictionary: (name) => set((s) => {
    if (!(name in s.customDictionaries)) return s;
    const next = { ...s.customDictionaries };
    delete next[name];
    saveCustomDictionaries(next);
    spellChecker.setGlobalDictionaries(next);
    const enabled = spellChecker.getEnabledGlobalDicts();
    if (enabled.includes(name)) {
      spellChecker.setEnabledGlobalDicts(enabled.filter((n) => n !== name));
    }
    return { customDictionaries: next };
  }),
  setGlobalDictionaryWords: (name, words) => set((s) => {
    if (!(name in s.customDictionaries)) return s;
    const cleaned = Array.from(new Set(words.map((w) => w.trim()).filter(Boolean))).sort();
    const next = { ...s.customDictionaries, [name]: cleaned };
    saveCustomDictionaries(next);
    spellChecker.setGlobalDictionaries(next);
    return { customDictionaries: next };
  }),
  dictionaryLibraryOpen: false,
  setDictionaryLibraryOpen: (open) => set({ dictionaryLibraryOpen: open }),

  addTargets: _initialAddTargets,
  setAddTargets: (targets) => set(() => {
    // Always keep at least one target so "Add to Dictionary" has a destination.
    const next = targets.length > 0 ? [...new Set(targets)] : [PROJECT_DICT_TARGET];
    saveAddTargets(next);
    spellChecker.setAddTargets(next);
    return { addTargets: next };
  }),
  appendWordToGlobalDictionary: (name, word) => set((s) => {
    if (!(name in s.customDictionaries)) return s;
    const trimmed = word.trim();
    if (!trimmed) return s;
    const current = s.customDictionaries[name];
    if (current.some((w) => w.toLowerCase() === trimmed.toLowerCase())) return s;
    const updated = Array.from(new Set([...current, trimmed])).sort();
    const next = { ...s.customDictionaries, [name]: updated };
    saveCustomDictionaries(next);
    spellChecker.setGlobalDictionaries(next);
    return { customDictionaries: next };
  }),

  installedLanguages: loadInstalledLanguages(),
  installLanguage: async (code) => {
    const lang = findLanguage(code);
    if (!lang) return { ok: false, error: `Unknown language: ${code}` };
    const urls = urlsFor(lang);
    const ok = await spellChecker.loadLanguage(code, {
      affUrl: urls.aff,
      dicUrl: urls.dic,
      label: lang.label,
    });
    if (!ok) {
      return { ok: false, error: `Couldn't download "${lang.label}" — the source may be temporarily unavailable, or the network is offline.` };
    }
    set((s) => {
      if (s.installedLanguages.includes(code)) return s;
      const next = [...s.installedLanguages, code];
      saveInstalledLanguages(next);
      return { installedLanguages: next };
    });
    return { ok: true };
  },
  installLanguageFromUrls: async ({ code, label, affUrl, dicUrl }) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return { ok: false, error: 'Language code is required.' };
    if (!affUrl.trim() || !dicUrl.trim()) {
      return { ok: false, error: 'Both .aff and .dic URLs are required.' };
    }
    const ok = await spellChecker.loadLanguage(trimmedCode, {
      affUrl: affUrl.trim(),
      dicUrl: dicUrl.trim(),
      label: label.trim() || trimmedCode,
    });
    if (!ok) {
      return { ok: false, error: 'Download or parse failed. Check the URLs and that the files are valid Hunspell .aff/.dic.' };
    }
    set((s) => {
      if (s.installedLanguages.includes(trimmedCode)) return s;
      const next = [...s.installedLanguages, trimmedCode];
      saveInstalledLanguages(next);
      return { installedLanguages: next };
    });
    return { ok: true };
  },

  uninstallLanguage: async (code) => {
    await spellChecker.unloadLanguage(code);
    set((s) => {
      const next = s.installedLanguages.filter((c) => c !== code);
      saveInstalledLanguages(next);
      return { installedLanguages: next };
    });
  },
});
