// v4.23: the character DATA slice (the second domain extracted from editorStore).
// Pure CRUD over characters/profiles/custom-fields/relationships/referred-tags —
// it uses only `set` (no _vs, saveViewState, clamp, or get), so it imports nothing
// from viewState. The small UI-open bits (characterProfilesOpen,
// toggleCharacterProfiles, selectedCharacter, charFullscreen, mapScrollSpeed,
// characterSortBy) stay in editorStore for now — they're view/tool-dock state.
import type { StateCreator } from 'zustand';
import type { EditorState, CharacterProfile, CharacterCustomField, CharacterRelationship, ReferredTag } from '../editorStore';
import type { ScannedCharacter } from '../../utils/characterScan';

export interface CharacterSlice {
  // Character profiles (Final Draft CastList + CharacterHighlighting)
  characters: string[];
  setCharacters: (names: string[]) => void;
  characterProfiles: CharacterProfile[];
  setCharacterProfiles: (profiles: CharacterProfile[]) => void;
  upsertCharacterProfile: (name: string, updates: Partial<Omit<CharacterProfile, 'name'>>) => void;
  deleteCharacterProfile: (name: string) => void;
  /** v4.22: user-defined character fields, shared by every character. */
  characterCustomFields: CharacterCustomField[];
  setCharacterCustomFields: (fields: CharacterCustomField[]) => void;
  addCharacterCustomField: (label: string) => void;
  renameCharacterCustomField: (id: string, label: string) => void;
  removeCharacterCustomField: (id: string) => void;
  characterRelationships: CharacterRelationship[];
  setCharacterRelationships: (rels: CharacterRelationship[]) => void;
  upsertCharacterRelationship: (rel: CharacterRelationship) => void;
  deleteCharacterRelationship: (id: string) => void;
  /** v4.19: how the writer classified an ALL-CAPS name found in action lines
   *  (the "Referred in Script" list). Any tagged name drops out of that list.
   *  v4.24: persisted in the script file (_referredTags in composeSaveContent)
   *  like every other character datum — it previously rode only on collabSync,
   *  so Local-only sessions lost every classification on relaunch. */
  referredTags: Record<string, ReferredTag>;
  setReferredTags: (tags: Record<string, ReferredTag>) => void;
  setReferredTag: (name: string, tag: ReferredTag) => void;
  /** v4.24: the From Script tab's scan list — store-held (survives unmounts)
   *  and saved in the script file (_characterScan), so it's still there after
   *  saving/relaunch. The tab re-scans on entry; this keeps the list stable
   *  in between. */
  scanResults: ScannedCharacter[] | null;
  setScanResults: (list: ScannedCharacter[] | null) => void;
}

export const createCharacterSlice: StateCreator<EditorState, [], [], CharacterSlice> = (set) => ({
  characters: [],
  setCharacters: (names) => set({ characters: names }),
  characterProfiles: [],
  setCharacterProfiles: (profiles) => set({ characterProfiles: profiles }),
  upsertCharacterProfile: (name, updates) =>
    set((s) => {
      const upper = name.toUpperCase();
      const idx = s.characterProfiles.findIndex((p) => p.name === upper);
      if (idx >= 0) {
        const copy = [...s.characterProfiles];
        copy[idx] = { ...copy[idx], ...updates };
        return { characterProfiles: copy };
      }
      return {
        characterProfiles: [
          ...s.characterProfiles,
          {
            name: upper,
            description: '',
            color: '',
            highlighted: false,
            gender: '',
            age: '',
            role: '',
            backstory: '',
            arc: '',
            speechPattern: '',
            vocabulary: '',
            verbalTics: '',
            sampleDialogue: '',
            images: [],
            ...updates,
          },
        ],
      };
    }),
  deleteCharacterProfile: (name) =>
    set((s) => ({
      characterProfiles: s.characterProfiles.filter((p) => p.name !== name.toUpperCase()),
    })),
  characterCustomFields: [],
  setCharacterCustomFields: (fields) => set({ characterCustomFields: fields }),
  addCharacterCustomField: (label) =>
    set((s) => {
      const clean = label.trim();
      if (!clean) return {};
      const id = `cf-${Date.now()}-${s.characterCustomFields.length}`;
      return { characterCustomFields: [...s.characterCustomFields, { id, label: clean }] };
    }),
  renameCharacterCustomField: (id, label) =>
    set((s) => ({
      characterCustomFields: s.characterCustomFields.map((f) => (f.id === id ? { ...f, label } : f)),
    })),
  removeCharacterCustomField: (id) =>
    set((s) => ({
      characterCustomFields: s.characterCustomFields.filter((f) => f.id !== id),
      // drop the value off every character too, so nothing is orphaned
      characterProfiles: s.characterProfiles.map((p) => {
        if (!p.customFields || !(id in p.customFields)) return p;
        const cf = { ...p.customFields };
        delete cf[id];
        return { ...p, customFields: cf };
      }),
    })),
  characterRelationships: [],
  setCharacterRelationships: (rels) => set({ characterRelationships: rels }),
  upsertCharacterRelationship: (rel) =>
    set((s) => {
      const idx = s.characterRelationships.findIndex((r) => r.id === rel.id);
      if (idx >= 0) {
        const copy = [...s.characterRelationships];
        copy[idx] = { ...copy[idx], ...rel };
        return { characterRelationships: copy };
      }
      return { characterRelationships: [...s.characterRelationships, rel] };
    }),
  deleteCharacterRelationship: (id) =>
    set((s) => ({
      characterRelationships: s.characterRelationships.filter((r) => r.id !== id),
    })),
  referredTags: {},
  setReferredTags: (tags) => set({ referredTags: tags }),
  setReferredTag: (name, tag) => set((s) => ({ referredTags: { ...s.referredTags, [name]: tag } })),
  scanResults: null,
  setScanResults: (list) => set({ scanResults: list }),
});
