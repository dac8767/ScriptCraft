import { describe, it, expect, vi } from 'vitest';
import { getLibraryId, LIBRARY_NAME } from './scriptLibrary';
import type { ProjectInfo } from './api';

const proj = (id: string, name: string) => ({ id, name, updated_at: '', created_at: '' } as ProjectInfo);

describe('the script library — the container the user never sees', () => {
  it('creates it once, when there is nothing there', async () => {
    const createProject = vi.fn(async (name: string) => proj('lib-1', name));
    const id = await getLibraryId({ listProjects: async () => [], createProject });
    expect(id).toBe('lib-1');
    expect(createProject).toHaveBeenCalledWith(LIBRARY_NAME);
  });

  it('reuses it on every subsequent save — no second container', async () => {
    const createProject = vi.fn();
    const id = await getLibraryId({
      listProjects: async () => [proj('lib-1', LIBRARY_NAME)],
      createProject,
    });
    expect(id).toBe('lib-1');
    expect(createProject).not.toHaveBeenCalled();
  });

  it('never adopts an old container — that is what named a new script after an old one', async () => {
    // v1.14 adopted the first container it found, to avoid "stranding" old scripts.
    // They were never stranded: the Open dialog lists scripts from every container.
    // What adoption actually did was file every new screenplay inside whatever
    // container existed first — so a brand-new script came back called "Test".
    const createProject = vi.fn(async (name: string) => proj('lib-1', name));
    const id = await getLibraryId({
      listProjects: async () => [proj('old-1', 'Untitled Feature')],
      createProject,
    });
    expect(id).toBe('lib-1');
    expect(createProject).toHaveBeenCalledWith(LIBRARY_NAME);
  });

  it('survives a race — two saves at once must not error at the user', async () => {
    let calls = 0;
    const id = await getLibraryId({
      listProjects: async () => (++calls === 1 ? [] : [proj('lib-1', LIBRARY_NAME)]),
      createProject: async () => { throw Object.assign(new Error('conflict'), { status: 409 }); },
    });
    expect(id).toBe('lib-1');    // refetched, not surfaced as "Could not create project"
  });
});
