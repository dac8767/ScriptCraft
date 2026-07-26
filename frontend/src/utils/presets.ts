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
 * Filenames: every preset-type export ends in `_<type>.json` (Derek's rule —
 * the type must be readable off the filename): _settings, _theme, _themes,
 * _customize, _outline-presets, _preset. typedExportName is the ONE builder.
 */
import { useEditorStore } from '../stores/editorStore';
import { useThemeStore } from '../stores/themeStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { resolveMoresContds, DEFAULT_MORES_CONTDS, type MoresContds, type ThemeId } from '../stores/editorStore';
import { gatherSettings, applyBackup } from './settingsBackup';

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
