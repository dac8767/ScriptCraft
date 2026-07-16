// @vitest-environment jsdom
/**
 * Scrapbook folder colors (v2.63) — top-level section folder icons each get
 * a palette color (auto by top-level order, or right-click-chosen); subfolder
 * icons stay monotone.
 */
import { describe, it, expect } from 'vitest';
import { folderColor, FOLDER_COLORS } from '../components/NotebookTool';
import { useNotebookStore } from './notebookStore';

describe('folder colors (v2.63)', () => {
  it('top-level folders cycle the palette; subfolders stay monotone', () => {
    expect(folderColor({}, 0, 0)).toBe(FOLDER_COLORS[0]);
    expect(folderColor({}, 1, 0)).toBe(FOLDER_COLORS[1]);
    expect(folderColor({}, FOLDER_COLORS.length, 0)).toBe(FOLDER_COLORS[0]);   // wraps around
    expect(folderColor({}, 0, 1)).toBeUndefined();                             // subfolder: no tint
    expect(folderColor({ color: '#123456' }, 3, 0)).toBe('#123456');           // chosen color wins
  });

  it('setSectionColor stores the chosen color on the section', () => {
    const S = useNotebookStore.getState;
    S().addSection();
    const sec = S().tree.find((n) => n.type === 'section')!;
    S().setSectionColor(sec.id, '#e06060');
    const after = S().tree.find((n) => n.type === 'section' && n.id === sec.id);
    expect(after && after.type === 'section' ? after.color : undefined).toBe('#e06060');
  });
});
