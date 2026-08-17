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
import type { EditorState, WorkspaceSnapshot, ToolId } from '../editorStore';
import { migrateToolConfig, migrateToolOrder, migrateToolId } from '../editorStore';

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
    const snap: WorkspaceSnapshot = {
      toolConfig: s.toolConfig, toolOrder: s.toolOrder,
      toolbarHiddenItems: s.toolbarHiddenItems, toolbarPinnedTools: s.toolbarPinnedTools,
      navigatorOpen: s.navigatorOpen, shelfOpen: s.shelfOpen, toolSizes: s.toolSizes,
      toolbarMode: s.toolbarMode, activeTool: s.activeTool, activeToolRight: s.activeToolRight,
      toolbarLeft: s.toolbarLeft, toolbarRight: s.toolbarRight,
      menuBarOrder: s.menuBarOrder, menuBarHidden: s.menuBarHidden, menuMode: s.menuMode,
      panelDividers: s.panelDividers,
      panelSizeMode: s.panelSizeMode, chromeCustomPx: s.chromeCustomPx,
      theme: s.theme,                       // v0.78: the theme is part of a workspace
    };
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
    const snap: WorkspaceSnapshot = {
      ...raw,
      toolConfig: migrateToolConfig(raw.toolConfig),
      toolOrder: migrateToolOrder(raw.toolOrder),
      toolbarPinnedTools: migrateToolOrder((raw.toolbarPinnedTools as string[]) ?? []) as ToolId[],
      ...(raw.activeTool ? { activeTool: migrateToolId(raw.activeTool) as ToolId | null } : {}),
      ...(raw.activeToolRight ? { activeToolRight: migrateToolId(raw.activeToolRight) as ToolId | null } : {}),
    };
    // v0.12 fields are optional (older snapshots): only restore when captured.
    const extras: Partial<EditorState> = {};
    // A workspace that had Index Cards showing reopens Scenes in Cards view.
    if (raw.activeTool === 'indexcards' || raw.activeToolRight === 'indexcards') {
      extras.scenesViewMode = 'cards';
    }
    // v5.67: one that had the Title Page window reopens Pages on its tab.
    if (raw.activeTool === 'titlepage' || raw.activeToolRight === 'titlepage') {
      extras.pagesTab = 'title';
    }
    if (snap.toolbarMode !== undefined) extras.toolbarMode = snap.toolbarMode;
    if (snap.activeTool !== undefined) { extras.activeTool = snap.activeTool; extras.tempTool = null; }
    if (snap.activeToolRight !== undefined) extras.activeToolRight = snap.activeToolRight;
    // v0.44 Customize capture (older workspaces leave these untouched)
    if (snap.toolbarLeft !== undefined && snap.toolbarRight !== undefined) {
      extras.toolbarLeft = snap.toolbarLeft; extras.toolbarRight = snap.toolbarRight;
      extras.toolbarZonesSet = true;
    }
    if (snap.menuBarOrder !== undefined) extras.menuBarOrder = snap.menuBarOrder;
    if (snap.menuBarHidden !== undefined) extras.menuBarHidden = snap.menuBarHidden;
    if (snap.menuMode !== undefined) extras.menuMode = snap.menuMode;
    if (snap.panelDividers !== undefined) extras.panelDividers = snap.panelDividers;
    // THE "apply doesn't take" bug: save captured panelSizeMode, chromeCustomPx
    // and theme (v0.78: the theme is part of a workspace) but apply never
    // restored them — the two hand-maintained field lists had drifted, and the
    // most VISIBLE parts of a workspace stayed put on apply.
    if (snap.panelSizeMode !== undefined) extras.panelSizeMode = snap.panelSizeMode;
    if (snap.chromeCustomPx !== undefined) extras.chromeCustomPx = snap.chromeCustomPx;
    saveViewState({
      workspaces: s.workspaces, activeWorkspace: name,
      toolConfig: snap.toolConfig, toolOrder: snap.toolOrder,
      toolbarHiddenItems: snap.toolbarHiddenItems, toolbarPinnedTools: snap.toolbarPinnedTools as string[],
      navigatorOpen: snap.navigatorOpen, shelfOpen: snap.shelfOpen, toolSizes: snap.toolSizes,
      ...(snap.toolbarLeft !== undefined && snap.toolbarRight !== undefined
        ? { toolbarLeft: snap.toolbarLeft, toolbarRight: snap.toolbarRight, toolbarZonesSet: true } : {}),
      ...(snap.menuBarOrder !== undefined ? { menuBarOrder: snap.menuBarOrder } : {}),
      ...(snap.menuBarHidden !== undefined ? { menuBarHidden: snap.menuBarHidden } : {}),
      ...(snap.menuMode !== undefined ? { menuMode: snap.menuMode } : {}),
      ...(snap.panelDividers !== undefined ? { panelDividers: snap.panelDividers } : {}),
      ...(snap.toolbarMode !== undefined ? { toolbarMode: snap.toolbarMode } : {}),
      ...(snap.activeTool !== undefined ? { activeTool: snap.activeTool } : {}),
      ...(snap.activeToolRight !== undefined ? { activeToolRight: snap.activeToolRight } : {}),
      ...(snap.panelSizeMode !== undefined ? { panelSizeMode: snap.panelSizeMode } : {}),
      ...(snap.chromeCustomPx !== undefined ? { chromeCustomPx: snap.chromeCustomPx } : {}),
      ...(extras.scenesViewMode !== undefined ? { scenesViewMode: extras.scenesViewMode } : {}),
    });
    set({
      activeWorkspace: name,
      // v4.37: a workspace is a whole layout — any fullscreen takeover belongs
      // to the layout being replaced, and restoring that tool into a slot with
      // the takeover still up would show the same window twice.
      fullscreenTool: null,
      toolConfig: snap.toolConfig, toolOrder: snap.toolOrder,
      toolbarHiddenItems: snap.toolbarHiddenItems,
      toolbarPinnedTools: snap.toolbarPinnedTools as ToolId[],
      navigatorOpen: snap.navigatorOpen, shelfOpen: snap.shelfOpen, toolSizes: snap.toolSizes,
      ...extras,
    });
    // Theme goes through setTheme, not a bare patch: it persists to its own
    // localStorage key and runs applyThemeToDom (which also clears custom-theme
    // overrides) — patching the value alone changes nothing on screen.
    if (snap.theme !== undefined && snap.theme !== get().theme) get().setTheme(snap.theme);
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
