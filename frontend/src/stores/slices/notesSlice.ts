// v4.23: Notes / General-notes / Sticky-Shelf slice. Pure CRUD (uuid + set), no
// view-state. Anchored notes, file-level general notes, and shelf cards.
import type { StateCreator } from 'zustand';
import { uuid } from '../../utils/uuid';
import type { EditorState, NoteInfo, NoteFilter, GeneralNote, ShelfCard } from '../editorStore';

export interface NotesSlice {
  // Notes
  notes: NoteInfo[];
  setNotes: (notes: NoteInfo[]) => void;
  addNote: (note: Omit<NoteInfo, 'id' | 'createdAt'>) => string;
  updateNote: (id: string, updates: Partial<Pick<NoteInfo, 'content' | 'color' | 'title'>>) => void;
  deleteNote: (id: string) => void;
  noteFilter: NoteFilter;
  setNoteFilter: (filter: NoteFilter) => void;

  // General notes (file-level, not anchored to text)
  generalNotes: GeneralNote[];
  setGeneralNotes: (notes: GeneralNote[]) => void;
  // Sticky Notes ("Shelf") — file-level cards: comments, to-dos, snippets
  shelfCards: ShelfCard[];
  setShelfCards: (cards: ShelfCard[]) => void;
  addShelfCard: (card: ShelfCard) => void;
}

export const createNotesSlice: StateCreator<EditorState, [], [], NotesSlice> = (set) => ({
  // Notes
  notes: [],
  setNotes: (notes) => set({ notes }),
  addNote: (note) => {
    const id = uuid();
    set((s) => ({
      notes: [
        ...s.notes,
        {
          ...note,
          id,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    return id;
  },
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  deleteNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  noteFilter: { elementType: null, contextLabel: null, color: null, noteId: null },
  setNoteFilter: (filter) => set({ noteFilter: filter }),

  // General notes
  generalNotes: [],
  setGeneralNotes: (generalNotes) => set({ generalNotes }),

  // Sticky Notes ("Shelf")
  shelfCards: [],
  setShelfCards: (shelfCards) => set({ shelfCards }),
  addShelfCard: (card) => set((s) => ({ shelfCards: [...s.shelfCards, card] })),
});
