/**
 * Presets (v4.79, Derek) — export/import of the app's "choices", in three
 * scopes, ONE module:
 *
 *   • CUSTOMIZATIONS — everything the Customize window governs: chrome layout
 *     (captureCustomizations — the same field list Customize's Cancel uses),
 *     element/transition visibility & order, themes, Mores & Continueds.
 *   • FULL PRESET — every preference the app persists (gatherSettings — the
 *     same collection Settings ▸ Backup exports, credentials excluded by
 *     construction) plus the per-document Mores & Continueds.
 *   • The individual exports that already existed (settings backup, themes,
 *     outline presets) keep their own flows; the File ▸ Export ▸ Presets
 *     window compiles all of them in one place.
 *
 * v6.63 replaces the six-files-six-buttons surface with ONE file built from
 * a checklist — see PRESET_PARTS at the bottom of this file. The builders
 * above are still the source of each part's payload, so nothing about what a
 * category MEANS changed; only how many files come out.
 *
 * Filenames: every preset-type export ends in `_<type>.json` (Derek's rule —
 * the type must be readable off the filename): _settings, _theme, _themes,
 * _customize, _outline-presets, _preset. typedExportName is the ONE builder.
 */
import { useEditorStore } from '../stores/editorStore';
import { useThemeStore } from '../stores/themeStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { resolveMoresContds, DEFAULT_MORES_CONTDS, type MoresContds, type ThemeId } from '../stores/editorStore';
import { gatherSettings, applyBackup } from './settingsBackup';
import { useOutlinePresetStore } from '../stores/outlinePresetStore';
import { useShortcutStore } from '../stores/shortcutStore';

/** `base` + `_<type>.json` — the one place the suffix convention lives. */
export const typedExportName = (base: string, type: string): string => `${base}_${type}.json`;

/** Today's stamp for default filenames (callers may pass their own base). */
export const stampedBase = (nowIso: string): string => `scriptcraft-${nowIso.slice(0, 10)}`;

const str = (v: unknown): v is string => typeof v === 'string';
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(str) : []);

export interface CustomizeExport {
  app: 'ScriptCraft';
  kind: 'customize-export';
  version: 1;
  exportedAt: string;
  /** captureCustomizations() — chrome/layout, filtered to known fields on apply. */
  chrome: Record<string, unknown>;
  theme: {
    active: string;
    customThemes: unknown[];
    themeOrder: string[];
    hiddenThemes: string[];
  };
  formatting: {
    elementHidden: string[];
    elementOrder: string[];
    customTransitions: string[];
    hiddenTransitions: string[];
    transitionOrder: string[];
  };
  moresContds: MoresContds;
}

export function buildCustomizeExport(nowIso: string): string {
  const ed = useEditorStore.getState();
  const th = useThemeStore.getState();
  const fmt = useFormattingTemplateStore.getState();
  const doc: CustomizeExport = {
    app: 'ScriptCraft',
    kind: 'customize-export',
    version: 1,
    exportedAt: nowIso,
    chrome: ed.captureCustomizations(),
    theme: {
      active: ed.theme,
      customThemes: th.customThemes,
      themeOrder: th.themeOrder,
      hiddenThemes: th.hiddenThemes,
    },
    formatting: {
      elementHidden: fmt.elementHidden,
      elementOrder: fmt.elementOrder,
      customTransitions: fmt.customTransitions,
      hiddenTransitions: fmt.hiddenTransitions,
      transitionOrder: fmt.transitionOrder,
    },
    moresContds: resolveMoresContds(ed.pageLayout),
  };
  return JSON.stringify(doc, null, 2);
}

/** Throwing validator — shared by the Customize footer, the Presets window,
 *  and (soon) the new-script setups' "customize from file". */
export function parseCustomizeExport(json: string): CustomizeExport {
  let doc: unknown;
  try { doc = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  const d = doc as Partial<CustomizeExport>;
  if (!d || d.kind !== 'customize-export' || typeof d.chrome !== 'object' || d.chrome === null) {
    throw new Error('That file is not a ScriptCraft customization export.');
  }
  return d as CustomizeExport;
}

/** Apply a customization export to the running app (and current script, for
 *  the Mores & Continueds part). Callers confirm with the user FIRST — this
 *  overrides the current customization choices. */
export function applyCustomizeExport(json: string): void {
  const d = parseCustomizeExport(json);
  const ed = useEditorStore.getState();

  // Chrome/layout — restoreCustomizations filters to known fields, so a
  // hand-edited or hostile file can't write arbitrary store keys.
  ed.restoreCustomizations(d.chrome);

  // Themes BEFORE the active id, so an imported custom theme can be active.
  if (d.theme && typeof d.theme === 'object') {
    const th = useThemeStore.getState();
    if (Array.isArray(d.theme.customThemes)) {
      for (const t of d.theme.customThemes) {
        const c = t as { id?: unknown; label?: unknown };
        if (str(c.id) && str(c.label)) th.saveCustomTheme(t as Parameters<typeof th.saveCustomTheme>[0]);
      }
    }
    const themes = useThemeStore.getState();
    themes.setThemeOrder(strArr(d.theme.themeOrder));
    const wantHidden = new Set(strArr(d.theme.hiddenThemes));
    for (const id of themes.allThemeIds()) themes.setThemeHidden(id, wantHidden.has(id));
    if (str(d.theme.active) && useThemeStore.getState().allThemeIds().includes(d.theme.active)) {
      ed.setTheme(d.theme.active as ThemeId);
    }
  }

  // Elements & transitions — bulk setters where they exist, reconciled
  // per-item where they don't (each setter persists its own overrides key).
  if (d.formatting && typeof d.formatting === 'object') {
    const fmt = useFormattingTemplateStore.getState();
    fmt.setElementHidden(strArr(d.formatting.elementHidden));
    fmt.setElementOrder(strArr(d.formatting.elementOrder));
    const wantCustom = strArr(d.formatting.customTransitions);
    for (const t of wantCustom) {
      if (!useFormattingTemplateStore.getState().customTransitions.includes(t)) fmt.addTransition(t);
    }
    for (const t of [...useFormattingTemplateStore.getState().customTransitions]) {
      if (!wantCustom.includes(t)) fmt.removeCustomTransition(t);
    }
    const wantHidden = new Set(strArr(d.formatting.hiddenTransitions));
    const allTransitions = new Set([
      ...useFormattingTemplateStore.getState().customTransitions,
      ...useFormattingTemplateStore.getState().hiddenTransitions,
      ...wantHidden,
    ]);
    for (const t of allTransitions) fmt.setTransitionHidden(t, wantHidden.has(t));
    fmt.setTransitionOrder(strArr(d.formatting.transitionOrder));
  }

  // Mores & Continueds ride the CURRENT document's page layout.
  if (d.moresContds && typeof d.moresContds === 'object') {
    const cur = useEditorStore.getState();
    cur.setPageLayout({
      ...cur.pageLayout,
      moresContds: { ...DEFAULT_MORES_CONTDS, ...d.moresContds },
    });
  }
}

/* ── The FULL preset — every persisted preference in one file ───────────── */

export interface FullPreset {
  app: 'ScriptCraft';
  kind: 'full-preset';
  version: 1;
  exportedAt: string;
  /** Every backup-eligible opendraft:* key (credentials excluded) — the same
   *  collection Settings ▸ Backup exports, so it can never under-collect. */
  settings: Record<string, string>;
  /** Per-document extras that don't live in localStorage. */
  moresContds: MoresContds;
}

export function buildFullPreset(nowIso: string): string {
  const doc: FullPreset = {
    app: 'ScriptCraft',
    kind: 'full-preset',
    version: 1,
    exportedAt: nowIso,
    settings: gatherSettings(),
    moresContds: resolveMoresContds(useEditorStore.getState().pageLayout),
  };
  return JSON.stringify(doc, null, 2);
}

/** Apply a full preset. localStorage keys are written through the settings
 *  backup's guarded path (opendraft:* only, credentials refused); stores that
 *  read storage at startup pick the rest up on the next launch — the caller
 *  tells the user to restart. Returns the applied key count. */
export function applyFullPreset(json: string): { imported: number } {
  let doc: unknown;
  try { doc = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  const d = doc as Partial<FullPreset>;
  if (!d || d.kind !== 'full-preset' || typeof d.settings !== 'object' || d.settings === null) {
    throw new Error('That file is not a ScriptCraft full preset.');
  }
  const res = applyBackup(JSON.stringify({ kind: 'settings-backup', data: d.settings }));
  if (d.moresContds && typeof d.moresContds === 'object') {
    const cur = useEditorStore.getState();
    cur.setPageLayout({ ...cur.pageLayout, moresContds: { ...DEFAULT_MORES_CONTDS, ...d.moresContds } });
  }
  return { imported: res.imported };
}

/* ── "Customize based on an existing script" (v4.83, Derek) ─────────────
   A .odraft script file is NOT a preset — it carries what a SCRIPT carries:
   its custom themes, its page layout (which includes Mores & Continueds),
   and the script format it was written in. Chrome layout (toolbar, panels,
   Quick Access) is app-level, lives in localStorage, and is simply not in
   the file — so this reports exactly what it copied instead of implying it
   brought everything. */
export interface ScriptSettingsApplied {
  themes: number;
  pageLayout: boolean;
  moresContds: boolean;
  templateId: string | null;
}

export function applySettingsFromScriptFile(json: string): ScriptSettingsApplied {
  let doc: unknown;
  try { doc = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  const d = doc as {
    format?: unknown;
    themes?: unknown;
    content?: Record<string, unknown>;
  };
  if (!d || typeof d !== 'object' || d.format !== 'opendraft-script') {
    throw new Error('That file is not a ScriptCraft script (.odraft).');
  }
  const out: ScriptSettingsApplied = { themes: 0, pageLayout: false, moresContds: false, templateId: null };

  if (Array.isArray(d.themes)) {
    const th = useThemeStore.getState();
    for (const t of d.themes) {
      const c = t as { id?: unknown; label?: unknown };
      if (str(c.id) && str(c.label)) { th.saveCustomTheme(t as Parameters<typeof th.saveCustomTheme>[0]); out.themes++; }
    }
  }

  const content = (d.content ?? {}) as Record<string, unknown>;
  const layout = content._pageLayout;
  if (layout && typeof layout === 'object') {
    const ed = useEditorStore.getState();
    const next = { ...ed.pageLayout, ...(layout as Record<string, unknown>) } as typeof ed.pageLayout;
    ed.setPageLayout(next);
    out.pageLayout = true;
    out.moresContds = !!(layout as { moresContds?: unknown }).moresContds;
  }
  if (str(content._templateId)) {
    useFormattingTemplateStore.getState().setActiveTemplateId(content._templateId);
    out.templateId = content._templateId;
  }
  return out;
}

/* ── v6.63, Derek: ONE preset file ──────────────────────────────────────
   "I want one single preset file that can include all the information for
   each item on the current preset list. The tab has a checklist of each of
   these items. If you check an item, preset information for that item will
   be included in the single preset file."

   So the six separate exports become one bundle with a part per checked
   item. PRESET_PARTS is THE registry: the checklist renders from it, the
   bundle is built from it, and an imported bundle is applied through it —
   one list, so a new preset type can never be in the file but missing from
   the checkbox (or the reverse). Each part's payload is byte-for-byte what
   that item's own export always wrote, so an old single-type file and a
   part of a bundle are the same shape. */

/* v6.70, Derek: "add annotation presets to the Settings > Presets tab
   options. check the app for any additional presets missing from that list."
   The audit found four things a writer authors, keeps, and would want on
   another machine, none of which any part carried by name:
     • annotation presets (Customize ▸ Markups — his ask)
     • keyboard shortcuts (his own bindings)
     • design (the Design window's token values)
     • helper text (his own rewritten tooltips, and the ones he hid)
   Deliberately NOT rows: snippets/shelf cards and tags (per SCRIPT, they
   travel in the .odraft), and Script Formats templates (they load through
   the HTTP backend, which the desktop app doesn't run — see v6.69). */
export type PresetPartId =
  | 'settings' | 'customize' | 'themes' | 'workspaces' | 'outline'
  | 'annotations' | 'shortcuts' | 'design' | 'helpertext';

export interface PresetBundle {
  app: 'ScriptCraft';
  kind: 'preset-bundle';
  version: 1;
  exportedAt: string;
  /** The checklist, recorded — which parts this file carries. */
  includes: PresetPartId[];
  parts: Partial<Record<PresetPartId, unknown>>;
}

export interface PresetPart {
  id: PresetPartId;
  label: string;
  /** How many of this thing the app currently holds; null = not a count
   *  (Settings/Customizations are always there). 0 disables the checkbox. */
  count: () => number | null;
  /** The payload this part contributes. */
  collect: () => unknown;
  /** Apply a payload back. Returns a short line for the result toast. */
  apply: (payload: unknown) => string;
}

export const PRESET_PARTS: PresetPart[] = [
  {
    id: 'settings',
    label: 'Settings',
    count: () => null,
    collect: () => gatherSettings(),
    apply: (p) => {
      const res = applyBackup(JSON.stringify({ kind: 'settings-backup', data: p }));
      return `${res.imported} setting${res.imported === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'customize',
    label: 'Customizations',
    count: () => null,
    collect: () => JSON.parse(buildCustomizeExport(new Date().toISOString())) as unknown,
    apply: (p) => { applyCustomizeExport(JSON.stringify(p)); return 'customizations'; },
  },
  {
    id: 'themes',
    label: 'Themes',
    count: () => useThemeStore.getState().customThemes.length,
    collect: () => useThemeStore.getState().customThemes,
    apply: (p) => {
      const list = Array.isArray(p) ? p : [];
      const th = useThemeStore.getState();
      let n = 0;
      for (const t of list) {
        const c = t as { id?: unknown; label?: unknown };
        if (str(c.id) && str(c.label)) { th.saveCustomTheme(t as Parameters<typeof th.saveCustomTheme>[0]); n++; }
      }
      return `${n} theme${n === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    count: () => Object.keys(useEditorStore.getState().workspaces).length,
    collect: () => {
      const st = useEditorStore.getState();
      return { workspaces: st.workspaces, workspaceOrder: st.workspaceOrder };
    },
    apply: (p) => {
      const d = (p ?? {}) as { workspaces?: unknown };
      const map = (d.workspaces ?? p) as Record<string, never>;
      if (!map || typeof map !== 'object' || Array.isArray(map)) return '0 workspaces';
      const added = useEditorStore.getState().importWorkspaces(map);
      return `${added.length} workspace${added.length === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'annotations',
    label: 'Annotation Presets',
    count: () => useEditorStore.getState().markupPresets.length,
    collect: () => useEditorStore.getState().markupPresets,
    apply: (p) => {
      const list = (Array.isArray(p) ? p : [])
        .map((x) => x as { icon?: unknown; color?: unknown })
        .filter((x) => str(x.icon) && str(x.color))
        .map((x) => ({ icon: x.icon as string, color: x.color as string }));
      if (!list.length) return '0 annotation presets';
      useEditorStore.getState().setMarkupPresets(list);
      return `${list.length} annotation preset${list.length === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    count: () => Object.keys(useShortcutStore.getState().overrides).length,
    collect: () => useShortcutStore.getState().overrides,
    apply: (p) => {
      const src = (p ?? {}) as Record<string, unknown>;
      if (typeof src !== 'object' || Array.isArray(src)) return '0 shortcuts';
      const st = useShortcutStore.getState();
      let n = 0;
      for (const [id, combo] of Object.entries(src)) {
        // null is a DELIBERATE unbind (see shortcuts.ts) — keep the
        // difference between "never touched" and "cleared on purpose".
        if (combo === null || str(combo)) { st.setBinding(id, combo as string | null); n++; }
      }
      return `${n} shortcut${n === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'design',
    label: 'Design',
    count: () => Object.keys(useEditorStore.getState().designVars).length,
    collect: () => useEditorStore.getState().designVars,
    apply: (p) => {
      const src = (p ?? {}) as Record<string, unknown>;
      if (typeof src !== 'object' || Array.isArray(src)) return '0 design values';
      const st = useEditorStore.getState();
      let n = 0;
      for (const [id, val] of Object.entries(src)) {
        if (typeof val === 'number' && Number.isFinite(val)) { st.setDesignVar(id, val); n++; }
      }
      return `${n} design value${n === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'helpertext',
    label: 'Helper Text',
    count: () => {
      const st = useEditorStore.getState();
      return Object.keys(st.helperTextOverrides).length + st.helperTextHidden.length;
    },
    collect: () => {
      const st = useEditorStore.getState();
      return { overrides: st.helperTextOverrides, hidden: st.helperTextHidden };
    },
    apply: (p) => {
      const d = (p ?? {}) as { overrides?: unknown; hidden?: unknown };
      const st = useEditorStore.getState();
      let n = 0;
      const overrides = (d.overrides ?? {}) as Record<string, unknown>;
      if (typeof overrides === 'object' && !Array.isArray(overrides)) {
        for (const [text, value] of Object.entries(overrides)) {
          if (str(value)) { st.setHelperTextOverride(text, value); n++; }
        }
      }
      // Hidden is a toggle, so reconcile rather than blindly re-toggling.
      const want = new Set(strArr(d.hidden));
      const cur = new Set(useEditorStore.getState().helperTextHidden);
      for (const t of new Set([...want, ...cur])) {
        if (want.has(t) !== cur.has(t)) { useEditorStore.getState().toggleHelperTextHidden(t); n++; }
      }
      return `${n} helper text change${n === 1 ? '' : 's'}`;
    },
  },
  {
    id: 'outline',
    label: 'Outline Presets',
    count: () => useOutlinePresetStore.getState().presets.length,
    collect: () => JSON.parse(useOutlinePresetStore.getState().exportJson()) as unknown,
    apply: (p) => {
      const res = useOutlinePresetStore.getState().importPresets(JSON.stringify(p));
      if (res.error) throw new Error(res.error);
      return `${res.added} outline preset${res.added === 1 ? '' : 's'}`;
    },
  },
];

export const presetPart = (id: PresetPartId): PresetPart | undefined => PRESET_PARTS.find((p) => p.id === id);

/** Build the single file from the checked parts, in registry order. */
export function buildPresetBundle(checked: PresetPartId[], nowIso: string): string {
  const includes = PRESET_PARTS.filter((p) => checked.includes(p.id)).map((p) => p.id);
  const parts: Partial<Record<PresetPartId, unknown>> = {};
  for (const id of includes) parts[id] = presetPart(id)!.collect();
  const doc: PresetBundle = { app: 'ScriptCraft', kind: 'preset-bundle', version: 1, exportedAt: nowIso, includes, parts };
  return JSON.stringify(doc, null, 2);
}

/** What a file holds, without applying any of it. Understands the bundle AND
 *  every single-type file the app has ever written, so a preset saved before
 *  v6.63 still opens — a file the app made must never become unreadable. */
export function readPresetFile(json: string): { parts: Partial<Record<PresetPartId, unknown>>; ids: PresetPartId[] } {
  let doc: unknown;
  try { doc = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  const d = doc as Record<string, unknown>;
  const parts: Partial<Record<PresetPartId, unknown>> = {};

  if (d && d.kind === 'preset-bundle' && d.parts && typeof d.parts === 'object') {
    const src = d.parts as Record<string, unknown>;
    for (const p of PRESET_PARTS) if (src[p.id] !== undefined) parts[p.id] = src[p.id];
  } else if (d && d.kind === 'full-preset' && d.settings) {
    // v4.79's "everything" file — its settings blob IS the settings part.
    parts.settings = d.settings;
  } else if (d && d.kind === 'settings-backup' && d.data) {
    parts.settings = d.data;
  } else if (d && d.kind === 'customize-export') {
    parts.customize = d;
  } else if (d && Array.isArray(d.themes)) {
    parts.themes = d.themes;
  } else if (d && d.workspaces && typeof d.workspaces === 'object') {
    parts.workspaces = d;
  } else if (Array.isArray(doc)) {
    parts.outline = doc;                       // outlinePresetStore.exportJson()
  } else {
    throw new Error('That file is not a ScriptCraft preset.');
  }

  const ids = PRESET_PARTS.filter((p) => parts[p.id] !== undefined).map((p) => p.id);
  if (!ids.length) throw new Error('That preset file is empty.');
  return { parts, ids };
}

/** Apply a preset file. `only` limits it to those parts (default: all of
 *  them). Each part reports what it applied; a part that throws is reported
 *  by name instead of taking the rest of the file down with it. */
export function applyPresetFile(json: string, only?: PresetPartId[]): { applied: string[]; failed: string[] } {
  const { parts, ids } = readPresetFile(json);
  const wanted = only ? ids.filter((id) => only.includes(id)) : ids;
  const applied: string[] = [];
  const failed: string[] = [];
  for (const id of wanted) {
    const part = presetPart(id)!;
    try { applied.push(part.apply(parts[id])); } catch { failed.push(part.label); }
  }
  return { applied, failed };
}
