// v4.23: Workspaces slice — named saved layouts (View → Workspaces). save/apply
// capture and restore chrome state (toolbar/menu/panels/theme) read through the
// full state via set/get, so cross-slice reads keep working.
// v4.24: the "apply doesn't take" bug is FIXED — save captured panelSizeMode /
// chromeCustomPx / theme but apply never restored them (drifted field lists);
// apply now restores every captured field, routing theme through setTheme so
// the DOM theme application actually runs. Keep save and apply in lockstep —
// a field added to one MUST be added to the other (workspacesApply.test.ts
// guards the round-trip).
import type { StateCreator } from 'zustand';
import { _vs, saveViewState } from '../viewState';
import type { EditorState, WorkspaceSnapshot, ToolId, ToolConfig } from '../editorStore';
import { migrateToolConfig, migrateToolOrder, migrateToolId } from '../editorStore';
import { CUSTOMIZATION_FIELDS } from '../customizationFields';

export interface WorkspacesSlice {
  /** Named saved layouts (View → Workspaces) */
  workspaces: Record<string, WorkspaceSnapshot>;
  /** Display order for saved workspaces (menu + Edit Workspaces dialog). */
  workspaceOrder: string[];
  setWorkspaceOrder: (order: string[]) => void;
  activeWorkspace: string | null;
  saveWorkspace: (name: string) => void;
  applyWorkspace: (name: string) => void;
  deleteWorkspace: (name: string) => void;
  /** Merge workspaces exported from another project/machine. Returns the names
   *  actually added (duplicates get a numeric suffix rather than overwriting). */
  importWorkspaces: (incoming: Record<string, WorkspaceSnapshot>) => string[];
  renameWorkspace: (oldName: string, newName: string) => void;
}

/* v7.65 — THE SNAPSHOT'S FIELD LIST, in one place.
   It used to be written out inline inside saveWorkspace, with applyWorkspace
   restoring a second hand-maintained copy of the same list. Those two drifted
   once already (v4.24: save captured panelSizeMode / chromeCustomPx / theme,
   apply restored none of them, and the most visible parts of a workspace
   silently stayed put). Derek's ask this time — grey out "Save Changes" and
   "Reset" when nothing has changed — needs a THIRD reading of that list to
   compare live state against the saved snapshot, and a third copy is how the
   v4.24 bug happens again. So capture is a function now, and the comparison
   is built from its output rather than from its own list. */
/** Customizations a workspace deliberately does NOT carry. Both are about how
 *  the app CHECKS YOUR WRITING, not how it is arranged — switching workspace
 *  should not change your grammar rules. Named rather than omitted, so the
 *  check below can tell a decision from an oversight. */
export const WORKSPACE_EXCLUDES = ['suggestionRules', 'suggestionMode'] as const;

/** The arrangement, on top of the customizations: what is open, how big, and
 *  in what mode. These are view state rather than customizations, which is why
 *  CUSTOMIZATION_FIELDS does not have them. */
export const WORKSPACE_VIEW_FIELDS = [
  'navigatorOpen', 'shelfOpen', 'toolSizes', 'toolMode',
  'activeTool', 'activeToolRight',
  'theme',                              // v0.78: the theme is part of a workspace
  'contextMenuOrder',                   // its sibling contextMenuHidden is a customization
] as const;

export const WORKSPACE_FIELDS: string[] = [
  ...CUSTOMIZATION_FIELDS.filter((f) => !(WORKSPACE_EXCLUDES as readonly string[]).includes(f)),
  ...WORKSPACE_VIEW_FIELDS,
];

export function captureWorkspace(s: EditorState): WorkspaceSnapshot {
  const snap: WorkspaceSnapshot = {};
  for (const f of WORKSPACE_FIELDS) snap[f] = (s as unknown as Record<string, unknown>)[f];
  return snap;
}

/** The migrations applyWorkspace runs before restoring. The comparison has to
 *  see what apply WOULD produce, or a snapshot holding a retired tool id reads
 *  as "changed" the instant it is applied. */
export function normalizeWorkspace(raw: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...raw,
    toolConfig: migrateToolConfig(raw.toolConfig as Record<string, ToolConfig>),
    toolOrder: migrateToolOrder((raw.toolOrder as string[]) ?? []),
    toolbarPinnedTools: migrateToolOrder((raw.toolbarPinnedTools as string[]) ?? []) as ToolId[],
    ...(raw.activeTool ? { activeTool: migrateToolId(raw.activeTool as string) as ToolId | null } : {}),
    ...(raw.activeToolRight
      ? { activeToolRight: migrateToolId(raw.activeToolRight as string) as ToolId | null } : {}),
  };
}

/** Key order is not meaningful — a snapshot that has been through localStorage
 *  and one built just now can carry the same values in a different order. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
}

/**
 * Has the live layout moved away from the workspace it was applied from?
 *
 * v7.65, Derek: "if no changes have been made to the current workspace, then
 * 'Save changes to this workspace' and 'reset to saved layout' should be
 * grayed out." Both actions are no-ops in that state — one writes back what is
 * already stored, the other restores what is already on screen — and a control
 * that looks live and does nothing is this app's cardinal sin.
 *
 * FALSE when no workspace is applied: there is nothing to be dirty against.
 * (The buttons stay disabled in that case for the reason they always were.)
 */
export function workspaceIsDirty(s: EditorState): boolean {
  const name = s.activeWorkspace;
  if (!name) return false;
  const saved = s.workspaces[name];
  if (!saved) return false;
  return stable(captureWorkspace(s)) !== stable(normalizeWorkspace(saved));
}

export const createWorkspacesSlice: StateCreator<EditorState, [], [], WorkspacesSlice> = (set, get) => ({
  workspaces: _vs.workspaces ?? {},
  workspaceOrder: _vs.workspaceOrder ?? Object.keys(_vs.workspaces ?? {}).sort(),
  setWorkspaceOrder: (order) => {
    saveViewState({ workspaceOrder: order });
    set({ workspaceOrder: order });
  },
  activeWorkspace: _vs.activeWorkspace ?? null,
  importWorkspaces: (incoming) => {
    const added: string[] = [];
    const s = get();
    const workspaces = { ...s.workspaces };
    const order = [...s.workspaceOrder];
    for (const [rawName, snap] of Object.entries(incoming)) {
      if (!snap || typeof snap !== 'object') continue;
      // Never overwrite an existing workspace — suffix instead.
      let name = rawName;
      let n = 2;
      while (workspaces[name]) name = `${rawName} (${n++})`;
      workspaces[name] = snap;
      order.push(name);
      added.push(name);
    }
    if (added.length === 0) return [];
    saveViewState({ workspaces, workspaceOrder: order });
    set({ workspaces, workspaceOrder: order });
    return added;
  },
  saveWorkspace: (name) => set((s) => {
    const snap = captureWorkspace(s);
    const workspaces = { ...s.workspaces, [name]: snap };
    const workspaceOrder = s.workspaceOrder.includes(name)
      ? s.workspaceOrder : [...s.workspaceOrder, name];
    saveViewState({ workspaces, workspaceOrder, activeWorkspace: name });
    return { workspaces, workspaceOrder, activeWorkspace: name };
  }),
  applyWorkspace: (name) => {
    const s = get();
    const raw = s.workspaces[name];
    if (!raw) return;
    // v4.24 batch 7: snapshots saved before a tool retirement may still carry
    // the retired id — normalize once, then apply. v5.67: the active-slot
    // fields read the retirement map (the same one migrateToolOrder/Config
    // use) instead of a hardcoded 'indexcards', so 'todo' and 'titlepage'
    // snapshots heal too. v7.33: through migrateToolId, so a DROPPED tool
    // (null heir) empties the slot rather than being left in it — the old
    // truthiness test skipped null and handed the dead id straight back.
    const snap = normalizeWorkspace(raw);

    /* v7.69 — APPLY IS DERIVED FROM THE SNAPSHOT, not from a second list.
       It used to restore a hand-written copy of capture's field names, and
       those two drifted twice: v4.24 (save captured panelSizeMode,
       chromeCustomPx and theme; apply restored none of them, so the most
       visible parts of a workspace silently stayed put) and again by v7.69,
       where four fields were in neither list and a workspace could not see
       them change at all. Every captured field is now copied across, and the
       handful that need more than a copy are named right here. */
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(snap)) {
      if (v === undefined) continue;
      patch[k] = v;
    }
    /* Popping a tool out is a MODE, and the takeover belongs to the layout
       being replaced — restoring a tool into a slot with the takeover still up
       would show the same window twice (v4.37). */
    patch.fullscreenTool = null;
    // A temp float belongs to the layout being replaced too.
    if (snap.activeTool !== undefined) patch.tempTool = null;
    // v0.44: zones restored means the user's zones are in force.
    if (snap.toolbarLeft !== undefined && snap.toolbarRight !== undefined) patch.toolbarZonesSet = true;
    // A workspace that had Index Cards showing reopens Scenes in Cards view.
    if (raw.activeTool === 'indexcards' || raw.activeToolRight === 'indexcards') {
      patch.scenesViewMode = 'cards';
    }
    // v5.67: one that had the Title Page window reopens Pages on its tab.
    if (raw.activeTool === 'titlepage' || raw.activeToolRight === 'titlepage') {
      patch.pagesTab = 'title';
    }
    /* The theme is applied through setTheme below, never patched: it persists
       to its own localStorage key and runs applyThemeToDom (which also clears
       custom-theme overrides), so patching the value alone changes nothing on
       screen. */
    const theme = patch.theme as EditorState['theme'] | undefined;
    delete patch.theme;

    saveViewState({
      ...(patch as Partial<Parameters<typeof saveViewState>[0]>),
      workspaces: s.workspaces,
      activeWorkspace: name,
    });
    set({ ...(patch as Partial<EditorState>), activeWorkspace: name });
    if (theme !== undefined && theme !== get().theme) get().setTheme(theme);
  },
  deleteWorkspace: (name) => set((s) => {
    const workspaces = { ...s.workspaces };
    delete workspaces[name];
    const workspaceOrder = s.workspaceOrder.filter((n) => n !== name);
    const activeWorkspace = s.activeWorkspace === name ? null : s.activeWorkspace;
    saveViewState({ workspaces, workspaceOrder, activeWorkspace });
    return { workspaces, workspaceOrder, activeWorkspace };
  }),
  renameWorkspace: (oldName, newName) => set((s) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || !s.workspaces[oldName]) return {};
    const workspaces = { ...s.workspaces, [trimmed]: s.workspaces[oldName] };
    delete workspaces[oldName];
    const workspaceOrder = s.workspaceOrder.map((n) => (n === oldName ? trimmed : n));
    const activeWorkspace = s.activeWorkspace === oldName ? trimmed : s.activeWorkspace;
    saveViewState({ workspaces, workspaceOrder, activeWorkspace });
    return { workspaces, workspaceOrder, activeWorkspace };
  }),
});
