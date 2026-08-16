/**
 * OpenFile — unified Open dialog replacing the separate Open-from-Project and
 * Open-from-Cloud dialogs.
 *
 * On the desktop / mobile app:
 *   - Source toggle at the top (This device / ScriptCraft Cloud).
 *   - "This device" reads via `api` which is swapped to local SQLite.
 *   - "ScriptCraft Cloud" reads via `cloudApi` (HTTP + auth).
 * In the browser:
 *   - No toggle — everything on the web is cloud-backed. We always go through
 *     `cloudApi` since that's the only real source.
 *
 * Also adds:
 *   - Search box that filters script titles.
 *   - Sort options: name A-Z / Z-A, updated recent first / oldest first,
 *     created recent first.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { api } from '../services/api';
import { cloudApi } from '../services/cloudApi';
import { isWeb } from '../services/platform';
import { useSettingsStore } from '../stores/settingsStore';
import type { ProjectInfo, ScriptMeta } from '../services/api';
import { LIBRARY_NAME } from '../services/scriptLibrary';

export type OpenSource = 'local' | 'cloud';

interface ProjectWithScripts {
  project: ProjectInfo;
  scripts: ScriptMeta[];
}

interface OpenFileProps {
  onOpen: (
    projectId: string,
    project: ProjectInfo,
    scriptId: string,
    scriptTitle: string,
    source: OpenSource,
  ) => void;
  onClose: () => void;
  /** v4.79, Derek: File ▸ Open has no submenu any more — it opens THIS window,
   *  so browsing the computer for a file has to live here. Runs the same
   *  importer File ▸ Import ▸ Local File used to. */
}

type SortKey =
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'name_asc'
  | 'name_desc';

const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: 'Last modified (newest)',
  updated_asc: 'Last modified (oldest)',
  created_desc: 'Date created (newest)',
  name_asc: 'Name (A → Z)',
  name_desc: 'Name (Z → A)',
};

function compareScripts(a: ScriptMeta, b: ScriptMeta, sort: SortKey): number {
  switch (sort) {
    case 'name_asc':
      return a.title.localeCompare(b.title);
    case 'name_desc':
      return b.title.localeCompare(a.title);
    case 'updated_asc':
      return (a.updated_at || '').localeCompare(b.updated_at || '');
    case 'created_desc':
      return (b.created_at || '').localeCompare(a.created_at || '');
    case 'updated_desc':
    default:
      return (b.updated_at || '').localeCompare(a.updated_at || '');
  }
}

/** Web is always cloud. Desktop/mobile apps let the user pick. */
const WEB_ONLY_CLOUD = isWeb();

/** v7.23, Derek: "limit the items in Open recent to 10 files". RECENT is the
 *  point of the window — a list that grows without bound is the script
 *  library, which is a different thing. The cap applies AFTER the sort, so it
 *  is the ten most recent by whatever order is chosen, and AFTER the search,
 *  so typing still reaches an older script rather than hiding it behind a
 *  limit the writer cannot see. */
const RECENT_LIMIT = 10;

const OpenFile: React.FC<OpenFileProps> = ({ onOpen, onClose }) => {
  // Only treat the user as signed in once the token has been verified against
  // the server this session. A stale localStorage token shouldn't let us hit
  // the cloud API — the request would fail anyway.
  const accessToken = useSettingsStore((s) => s.collabAuth.accessToken);
  const authVerified = useSettingsStore((s) => s.authVerified);
  const signedIn = Boolean(accessToken && authVerified);
  // v6.42: no source picker — web builds are cloud-only, the app is local-only.
  const source: OpenSource = WEB_ONLY_CLOUD ? 'cloud' : 'local';
  const [groups, setGroups] = useState<ProjectWithScripts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated_desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setGroups([]);

    if (source === 'cloud' && !signedIn) {
      setLoading(false);
      // On the web, cloud is the only storage source. If the user isn't
      // signed in, pop the login dialog immediately instead of showing a
      // "please sign in" empty state — there's nowhere else they could go.
      // On the app (Tauri), the empty state is useful because the user can
      // switch to the "This device" tab.
      if (WEB_ONLY_CLOUD) {
        try {
          window.dispatchEvent(new CustomEvent('opendraft:auth-required'));
        } catch { /* no-op */ }
      }
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const client = source === 'cloud' ? cloudApi : api;
        const projects = await client.listProjects();
        const all = await Promise.all(
          projects.map(async (project) => {
            try {
              const scripts = await client.listScripts(project.id);
              return { project, scripts };
            } catch {
              return { project, scripts: [] };
            }
          }),
        );
        if (!cancelled) {
          setGroups(all.filter((g) => g.scripts.length > 0));
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load files');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [source, signedIn]);

  /**
   * v1.14: one flat list of scripts.
   *
   * This used to render a header per project with its scripts nested beneath. There
   * are no projects any more — a ScriptCraft file is one script — so the grouping was
   * a filing cabinet with one drawer. Scripts saved by older versions may still sit
   * in different containers underneath; they all appear here together, as scripts,
   * which is the only thing they ever were to you.
   */
  const visibleScripts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .flatMap((g) => g.scripts.map((s) => ({ script: s, project: g.project })))
      .filter(({ script }) => !q || script.title.toLowerCase().includes(q))
      .sort((a, b) => compareScripts(a.script, b.script, sort))
      .slice(0, RECENT_LIMIT);
  }, [groups, query, sort]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-box open-from-project-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="dialog-header">Open Recent</div>

        <div className="open-file-controls">
          {/* v6.42: the This device / ScriptCraft Cloud source tabs are gone
              with the account UI — on the app everything is local, and the
              web build (where cloud is the ONLY source) never showed them. */}
          <div className="open-file-search-row">
            <div className="open-file-search">
              <LuSearch className="open-file-search-icon" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scripts…"
                autoFocus
              />
            </div>
            <select
              className="open-file-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort"
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          className="dialog-body"
          style={{ maxHeight: 440, overflow: 'auto', padding: '8px 16px 16px' }}
        >
          {source === 'cloud' && !signedIn ? (
            <div className="open-file-empty">
              Cloud files need a signed-in account, which this build does not
              offer.
            </div>
          ) : loading ? (
            <div className="open-file-empty">Loading…</div>
          ) : error ? (
            <div className="open-file-error">{error}</div>
          ) : visibleScripts.length === 0 ? (
            <div className="open-file-empty">
              {query
                ? `No files match “${query}”.`
                : source === 'cloud'
                  ? 'No cloud files yet. Use File › Save As… and pick ScriptCraft Cloud to upload.'
                  : 'No scripts yet. Use File › New Script, or browse this computer for a file.'}
            </div>
          ) : (
            visibleScripts.map(({ script, project }) => (
              <div
                key={script.id}
                className="open-project-item"
                onClick={() => onOpen(project.id, project, script.id, script.title, source)}
              >
                {/*
                  * v1.15: scripts saved by older versions are titled "Draft - Date",
                  * because back then the PROJECT carried the name. On its own that
                  * row reads "First Draft - 07/12/26", which identifies nothing. So
                  * for anything still sitting in an old container, show the container
                  * name too — that's the name of the work. New scripts carry their own.
                  */}
                <span className="open-project-name">
                  {project.name === LIBRARY_NAME
                    ? script.title
                    : `${project.name} — ${script.title}`}
                  {/* v7.23, Derek: "show the draft number next to the script
                      name". His own list was five rows of "Episode X" with
                      nothing to tell them apart. Quiet — the name is what you
                      scan for, the draft is what you check once you've found
                      it — and absent entirely on a script that has no draft
                      set, rather than reading "First Draft" at everything. */}
                  {script.draft_label && (
                    <span className="open-project-draft"> — {script.draft_label}</span>
                  )}
                </span>
                <span className="open-project-date">
                  {new Date(script.updated_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>

        {/* v7.23, Derek: no "Browse This Computer…" here any more. File ▸ Open
            IS the file explorer now, so the button duplicated the menu item
            directly above the one that opens this window. */}
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default OpenFile;
