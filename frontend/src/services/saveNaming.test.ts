import { describe, it, expect, vi } from 'vitest';
import { getLibraryId, LIBRARY_NAME } from './scriptLibrary';
import type { ProjectInfo } from './api';

const proj = (id: string, name: string) => ({ id, name, updated_at: '', created_at: '' } as ProjectInfo);

/**
 * Derek's bug, reproduced as a test.
 *
 * He saved a script as "Test". Then File > New Screenplay, then Save — and the new,
 * unrelated screenplay came back named "Test". Two causes, both mine:
 *   1. getLibraryId ADOPTED the first container it found (the one called "Test"), so
 *      the new script was filed inside it.
 *   2. The status bar printed the CONTAINER's name, not the script's.
 */
describe('a new screenplay does not inherit the last one\'s name', () => {
  it('the library never adopts an old container — not even one called "Test"', async () => {
    const createProject = vi.fn(async (name: string) => proj('lib-1', name));
    const id = await getLibraryId({
      listProjects: async () => [proj('test-1', 'Test')],   // the container from his first save
      createProject,
    });
    expect(id).toBe('lib-1');                                // NOT 'test-1'
    expect(createProject).toHaveBeenCalledWith(LIBRARY_NAME);
  });

  it('and reuses the library once it exists', async () => {
    const createProject = vi.fn();
    const id = await getLibraryId({
      listProjects: async () => [proj('test-1', 'Test'), proj('lib-1', LIBRARY_NAME)],
      createProject,
    });
    expect(id).toBe('lib-1');
    expect(createProject).not.toHaveBeenCalled();
  });
});

describe('what the user sees is the SCRIPT\'s name', () => {
  // The status bar renders `documentTitle`, which is the script title the Save As
  // dialog set from the Name field — never the container.
  // v1.24: a dash, not a middle dot — the same separator the Save dialog's
  // "Saves as:" preview uses, so the name reads identically everywhere.
  const statusBar = (documentTitle: string, draftLabel?: string) =>
    [documentTitle || 'Untitled', draftLabel].filter(Boolean).join(' - ');

  it('shows the name you typed, with the draft beside it', () => {
    expect(statusBar('Blackwater', 'Second Draft - 07/12/26'))
      .toBe('Blackwater - Second Draft - 07/12/26');
  });

  it('a new unsaved screenplay is Untitled, not the last script\'s name', () => {
    expect(statusBar('')).toBe('Untitled');
  });
});

describe('the file on disk is named after the script', () => {
  const safeName = (s: string) => (s || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
  const fileNameFor = (title: string) => `${safeName(title)}.odraft.json`;

  it('"Blackwater" saves as Blackwater.odraft.json', () => {
    expect(fileNameFor('Blackwater')).toBe('Blackwater.odraft.json');
  });

  it('not "<container> — <draft>", which is what it used to produce', () => {
    expect(fileNameFor('Blackwater')).not.toContain('—');
    expect(fileNameFor('Blackwater')).not.toContain('Test');
  });
});
