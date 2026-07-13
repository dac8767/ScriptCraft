/**
 * scriptLibrary — the container every script lives in, now that there is no such
 * thing as a project.
 *
 * WHY THIS EXISTS AT ALL. A ScriptCraft file is one script. But underneath, the
 * storage layer keys everything on a container id: scripts are stored as
 * (containerId, scriptId), assets live in assets/{containerId}, and version
 * history, characters and locations are all scoped by it. That's ~1,300
 * references across 29 files, including the save path — the one place where a bug
 * costs you writing.
 *
 * So the CONCEPT is gone from the product — no Project Manager, no grouping, no
 * dialog ever asks you which project a script belongs to — while the storage keeps
 * the id it has always used, as an invisible implementation detail. Nothing about
 * your existing scripts moves, and no migration runs over work you've already
 * saved.
 *
 * New scripts all land in one container, so there is exactly one library. Scripts
 * you saved earlier keep whatever container they were filed under, and the Open
 * dialog lists everything flat, so they're all just... scripts.
 */
import type { ProjectInfo } from './api';

/** The one container. Named for what it is, not for a concept we removed. */
export const LIBRARY_NAME = 'My Scripts';

interface LibraryClient {
  listProjects: () => Promise<ProjectInfo[]>;
  createProject: (name: string) => Promise<ProjectInfo>;
}

/**
 * The container new scripts are saved into. Reuses the existing one if it's
 * there (including one from an earlier version of the app), and only creates a
 * container when the library is genuinely empty.
 *
 * Note it does NOT fail if creation races — two windows saving at once would both
 * try to create, and the loser refetches instead of erroring at the user, who did
 * nothing wrong and cannot act on the message anyway.
 */
export async function getLibraryId(client: LibraryClient): Promise<string> {
  const existing = await client.listProjects().catch(() => [] as ProjectInfo[]);

  const named = existing.find((p) => p.name === LIBRARY_NAME);
  if (named) return named.id;

  /*
   * v1.15: DO NOT adopt an existing container.
   *
   * v1.14 adopted the first one it found, reasoning that it would otherwise strand
   * old scripts. It wouldn't — the Open dialog lists scripts from every container,
   * so nothing was ever stranded. What adoption actually did was file every new
   * screenplay inside whatever container happened to exist first, which is how a new
   * script ended up living in one called "Test".
   *
   * New scripts go in the library. Old ones stay where they are and still open.
   */

  try {
    const created = await client.createProject(LIBRARY_NAME);
    return created.id;
  } catch {
    // Lost a race (409) or hit a transient failure — refetch and use whatever
    // exists now rather than surfacing a container error for a script save.
    const fresh = await client.listProjects().catch(() => [] as ProjectInfo[]);
    const found = fresh.find((p) => p.name === LIBRARY_NAME);
    if (!found) throw new Error('Could not open the script library.');
    return found.id;
  }
}
