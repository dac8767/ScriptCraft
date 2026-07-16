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

/* v2.64: rotating a picture a quarter turn swaps its frame, so the window
   hugs the rotated image instead of letting it poke out. */
import { rotatedImagePatch } from '../components/NotebookTool';

describe('rotated image frame (v2.64)', () => {
  it('a quarter turn swaps the frame dimensions', () => {
    expect(rotatedImagePatch({ w: 300, h: 200 }, 90)).toEqual({ rotate: 90, w: 200, h: 300 });
    expect(rotatedImagePatch({ rotate: 90, w: 200, h: 300 }, 90)).toEqual({ rotate: 180, w: 300, h: 200 });
    expect(rotatedImagePatch({ w: 300, h: 200 }, -90)).toEqual({ rotate: 270, w: 200, h: 300 });
  });

  it('four quarter turns come back exactly', () => {
    let b = { rotate: 0, w: 300, h: 200 };
    for (let i = 0; i < 4; i++) b = { ...b, ...rotatedImagePatch(b, 90) } as typeof b;
    expect(b).toEqual({ rotate: 0, w: 300, h: 200 });
  });
});

/* v2.66: the tree panel's zoom bar — thumb width maps linearly to row scale
   and the mapping round-trips. */
import { treeThumbFrac, treeScaleFromFrac, TREE_SCALE_MIN, TREE_SCALE_MAX } from '../components/NotebookTool';

describe('tree zoom bar mapping (v2.66)', () => {
  it('min scale = smallest grabbable thumb; max scale = full width', () => {
    expect(treeThumbFrac(TREE_SCALE_MIN)).toBeCloseTo(0.3);
    expect(treeThumbFrac(TREE_SCALE_MAX)).toBeCloseTo(1);
  });

  it('round-trips through the mapping and clamps outside it', () => {
    for (const s of [0.7, 1, 1.5, 2]) {
      expect(treeScaleFromFrac(treeThumbFrac(s))).toBeCloseTo(s);
    }
    expect(treeScaleFromFrac(0)).toBe(TREE_SCALE_MIN);      // below the min thumb
    expect(treeScaleFromFrac(2)).toBe(TREE_SCALE_MAX);      // past full width
  });
});
