// v4.23: production-tags DATA slice (tag categories + tag items CRUD). The UI bits
// (tagsVisible, tagsPanelOpen/toggleTagsPanel, locationDatabase, pendingTagSelection,
// editingTagId) stay in editorStore — they're view/tool-dock state.
//
// DEFAULT_TAG_CATEGORIES is imported as a value from editorStore; that import is
// only READ inside createTagSlice (which runs when the store is built, after the
// const is initialised), so the circular reference resolves via ES live bindings.
import type { StateCreator } from 'zustand';
import { uuid } from '../../utils/uuid';
import { DEFAULT_TAG_CATEGORIES, type EditorState, type TagCategory, type TagItem } from '../editorStore';

export interface TagSlice {
  tagCategories: TagCategory[];
  setTagCategories: (cats: TagCategory[]) => void;
  addTagCategory: (name: string, color: string) => string;
  deleteTagCategory: (id: string) => void;
  tags: TagItem[];
  setTags: (tags: TagItem[]) => void;
  addTag: (tag: Omit<TagItem, 'id' | 'createdAt' | 'name'> & { name?: string }) => string;
  updateTag: (id: string, updates: Partial<Pick<TagItem, 'notes' | 'categoryId' | 'name'>>) => void;
  deleteTag: (id: string) => void;
}

export const createTagSlice: StateCreator<EditorState, [], [], TagSlice> = (set) => ({
  tagCategories: [...DEFAULT_TAG_CATEGORIES],
  setTagCategories: (cats) => set({ tagCategories: cats }),
  addTagCategory: (name, color) => {
    const id = uuid();
    set((s) => ({
      tagCategories: [...s.tagCategories, { id, name, color, isBuiltIn: false }],
    }));
    return id;
  },
  deleteTagCategory: (id) =>
    set((s) => ({
      tagCategories: s.tagCategories.filter((c) => c.id !== id),
      tags: s.tags.filter((t) => t.categoryId !== id),
    })),
  tags: [],
  setTags: (tags) => set({ tags }),
  addTag: (tag) => {
    const id = uuid();
    set((s) => ({
      tags: [...s.tags, { ...tag, name: tag.name || tag.text, id, createdAt: new Date().toISOString() }],
    }));
    return id;
  },
  updateTag: (id, updates) =>
    set((s) => ({
      tags: s.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  deleteTag: (id) =>
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),
});
