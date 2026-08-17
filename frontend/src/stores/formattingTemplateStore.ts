/**
 * Zustand store for the formatting template system.
 *
 * Manages template CRUD, per-document template assignment, and provides
 * the resolved active template.
 */

import { create } from 'zustand';
import { uuid } from '../utils/uuid';
import { DEFAULT_PAGE_LAYOUT } from './editorStore';
import type { PageLayout } from './editorStore';

/** Element visibility/order overrides — persisted separately from templates,
 *  which may be immutable system constants. */
const ELEMENT_OVERRIDES_KEY = 'opendraft:elementOverrides';
function loadElementOverrides(): { hidden: string[]; order: string[] } {
  try {
    const raw = localStorage.getItem(ELEMENT_OVERRIDES_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        hidden: Array.isArray(p?.hidden) ? p.hidden.filter((x: unknown) => typeof x === 'string') : [],
        order: Array.isArray(p?.order) ? p.order.filter((x: unknown) => typeof x === 'string') : [],
      };
    }
  } catch { /* ignore */ }
  return { hidden: [], order: [] };
}
function saveElementOverrides(v: { hidden: string[]; order: string[] }) {
  try { localStorage.setItem(ELEMENT_OVERRIDES_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/* v7.10, Derek — "make equivalents for the other templates", built-ins
   included. A template can carry its own page setup, and the writer can edit
   it. THE TRAP this map exists to avoid: the six system templates are
   IMMUTABLE CONSTANTS, not rows in `templates[]`, so updateTemplate() on one
   is a silent no-op — the same shape as the v0.63–v0.70 Show/Hide bug, where
   a control looked like it worked and wrote into the void. Overrides live
   here, keyed by template id, exactly the way elementHidden/elementOrder do
   it for the element list. */
const TEMPLATE_PAGE_KEY = 'opendraft:templatePageLayouts';
function loadTemplatePageLayouts(): Record<string, Partial<PageLayout>> {
  try {
    const raw = localStorage.getItem(TEMPLATE_PAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, Partial<PageLayout>>;
    }
  } catch { /* ignore */ }
  return {};
}
function saveTemplatePageLayouts(v: Record<string, Partial<PageLayout>>) {
  try { localStorage.setItem(TEMPLATE_PAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/** v4.22, Derek: the transition auto-complete list is customizable in Customize
 *  ▸ Script Editor. The eight built-ins below are the DEFAULTS — hidable but not
 *  deletable; the writer's own additions live alongside and are deletable. One
 *  source of truth: the editor's transition picker reads getEffectiveTransitions
 *  so it never drifts from what the customizer shows. */
export const DEFAULT_TRANSITIONS = [
  'CUT TO:', 'DISSOLVE TO:', 'FADE IN:', 'FADE OUT:', 'FADE TO:',
  'INTERCUT:', 'CUT TO BLACK.', 'WIPE TO:',   /* v7.35, Derek: a period, not a
     colon — nothing follows it, the same reason FADE OUT. takes one. The PDF
     classifier already read it both ways (pdfClassify TRANSITION_RE). */
];
const TRANSITION_OVERRIDES_KEY = 'opendraft:transitionOverrides';
function loadTransitionOverrides(): { custom: string[]; hidden: string[]; order: string[] } {
  try {
    const raw = localStorage.getItem(TRANSITION_OVERRIDES_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string') : []);
      return { custom: arr(p?.custom), hidden: arr(p?.hidden), order: arr(p?.order) };
    }
  } catch { /* ignore */ }
  return { custom: [], hidden: [], order: [] };
}
function saveTransitionOverrides(v: { custom: string[]; hidden: string[]; order: string[] }) {
  try { localStorage.setItem(TRANSITION_OVERRIDES_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
import type { FormattingTemplate } from './formattingTypes';
import { INDUSTRY_STANDARD_ID } from './formattingTypes';
import { INDUSTRY_STANDARD_TEMPLATE } from './industryStandardTemplate';
import { MULTICAM_SITCOM_TEMPLATE, MULTICAM_SITCOM_ID } from './templates/multicamSitcomTemplate';
import { ONE_HOUR_DRAMA_TEMPLATE, ONE_HOUR_DRAMA_ID } from './templates/oneHourDramaTemplate';
import { STAGE_PLAY_TEMPLATE, STAGE_PLAY_ID } from './templates/stagePlayTemplate';
import { RADIO_PLAY_TEMPLATE, RADIO_PLAY_ID } from './templates/radioPlayTemplate';
import { AV_SCRIPT_TEMPLATE, AV_SCRIPT_ID } from './templates/avScriptTemplate';
import { api } from '../services/api';

/** Built-in system templates, keyed by id. Read-only — never persisted. */
export const SYSTEM_TEMPLATES: Record<string, FormattingTemplate> = {
  [INDUSTRY_STANDARD_ID]: INDUSTRY_STANDARD_TEMPLATE,
  [MULTICAM_SITCOM_ID]: MULTICAM_SITCOM_TEMPLATE,
  [ONE_HOUR_DRAMA_ID]: ONE_HOUR_DRAMA_TEMPLATE,
  [STAGE_PLAY_ID]: STAGE_PLAY_TEMPLATE,
  [RADIO_PLAY_ID]: RADIO_PLAY_TEMPLATE,
  [AV_SCRIPT_ID]: AV_SCRIPT_TEMPLATE,
};

/** Ordered list of system templates for the format picker. */
export const SYSTEM_TEMPLATE_LIST: FormattingTemplate[] = [
  INDUSTRY_STANDARD_TEMPLATE,
  ONE_HOUR_DRAMA_TEMPLATE,
  MULTICAM_SITCOM_TEMPLATE,
  STAGE_PLAY_TEMPLATE,
  RADIO_PLAY_TEMPLATE,
  AV_SCRIPT_TEMPLATE,
];

interface FormattingTemplateState {
  /** All user-created templates */
  templates: FormattingTemplate[];
  /** Active template id for the currently open document */
  activeTemplateId: string | null;
  /** Whether templates have been loaded from storage */
  loaded: boolean;

  // ── Computed helpers ──
  /** Returns the resolved active template (per-document or industry standard). */
  getActiveTemplate: () => FormattingTemplate;
  /** Returns list of enabled element ids in the active template. */
  getEnabledElements: () => string[];
  /** Per-user element visibility + order, applied OVER the active template.
   *  System templates (Industry Standard, Multicam, One-Hour Drama) are
   *  immutable constants, NOT rows in `templates[]` — so updateTemplate() on
   *  one is a silent no-op, which is why Edit Elements' Show/Hide/reorder did
   *  nothing (v0.63–v0.70 bug). Overrides live here instead. */
  /** v7.10: per-template page setup. `getTemplatePageLayout` is the ONE
   *  resolver — app defaults, then the template's own pageLayout, then the
   *  writer's override — so the Page Setup tab, a new script and the info
   *  page can't disagree about what a template's page is. */
  templatePageLayouts: Record<string, Partial<PageLayout>>;
  getTemplatePageLayout: (templateId: string) => PageLayout;
  /** The template's own page setup, WITHOUT the writer's override — what
   *  "Reset Default" on that template's page goes back to. */
  getTemplateBasePageLayout: (templateId: string) => PageLayout;
  setTemplatePageLayout: (templateId: string, layout: PageLayout) => void;
  resetTemplatePageLayout: (templateId: string) => void;
  elementHidden: string[];
  elementOrder: string[];
  setElementHidden: (ids: string[]) => void;
  setElementOrder: (ids: string[]) => void;
  resetElementOverrides: () => void;

  /** v4.22: transition auto-complete customization. `customTransitions` are the
   *  writer's own; `hiddenTransitions` are built-ins they've hidden;
   *  `transitionOrder` is the drag-sorted order applied over the union. */
  customTransitions: string[];
  hiddenTransitions: string[];
  transitionOrder: string[];
  addTransition: (text: string) => void;
  removeCustomTransition: (text: string) => void;
  setTransitionHidden: (text: string, hidden: boolean) => void;
  setTransitionOrder: (order: string[]) => void;
  resetTransitions: () => void;
  /** v6.77: exact restore — the Reset Transitions window-undo path. */
  restoreTransitions: (snap: { custom: string[]; hidden: string[]; order: string[] }) => void;
  /** The effective transition list the editor's picker shows: the built-ins and
   *  the writer's own in the user's drag order, minus any hidden built-ins. */
  getEffectiveTransitions: () => string[];
  /** The active template's rules with the user's overrides applied: hidden
   *  elements disabled, and rule key order following elementOrder. Every
   *  consumer (Element dropdown, Insert menu, getEnabledElements) reads this. */
  getEffectiveRules: () => FormattingTemplate['rules'];
  /** Elements a writer can pick, in the user's order (v0.84). */
  getPickableElements: () => FormattingTemplate['rules'][string][];
  /** Returns whether the active template is in enforce mode. */
  isEnforceMode: () => boolean;

  // ── Actions ──
  loadTemplates: () => Promise<void>;
  createTemplate: (t: Partial<FormattingTemplate>) => Promise<FormattingTemplate>;
  updateTemplate: (id: string, data: Partial<FormattingTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<FormattingTemplate>;
  setActiveTemplateId: (id: string | null) => void;
}

/**
 * Elements that never appear in an element PICKER. They're structural and are
 * inserted from their own menu commands, not chosen as a paragraph type.
 * Exported so every list — including Customize > Elements — filters identically.
 */
// v4.61, Derek: `character` is back in the pick lists as one of the three
// v4.84: the name line is labeled "Character" again and is NOT pickable —
// plain "Character". (v4.54 had removed it in favor of an implicit
// Dialogue→character conversion; explicit labeled options replaced that.)
// v4.84, Derek: 'character' is NOT offered as its own element again — the
// "Dialogue" option starts by prompting for the name (resolvePickedElement in
// screenplayEditorConstants). It remains a real schema node and a real
// template rule; it just isn't something you pick.
export const NON_PICKABLE = ['newAct', 'endOfAct', 'castList', 'character'];

/** Dual Dialogue is a structure rather than a paragraph type, so it has no
 *  template rule — but it IS offered in every element list. */
export const DUAL_DIALOGUE_ID = 'dualDialogue';

function now(): string {
  return new Date().toISOString();
}

/**
 * v1.34 — placeholders that shipped as DEFAULTS and later changed.
 *
 * Stored templates (backend-saved user templates) cloned the default rules at
 * creation, so when a default placeholder changes in the system templates the
 * stored copies keep serving the old text — which is why "Describe the
 * action..." survived the v1.32 rename for any script using a saved template.
 * A stored placeholder that EQUALS an old default was never user-authored;
 * it follows the new default. Anything else the user typed is untouched.
 */
const MIGRATED_PLACEHOLDERS: Record<string, string> = {
  'Describe the action...': 'Action...',
};

export function migrateTemplatePlaceholders(t: FormattingTemplate): FormattingTemplate {
  let changed = false;
  const rules: FormattingTemplate['rules'] = { ...t.rules };
  for (const id of Object.keys(rules)) {
    const ph = rules[id]?.placeholder;
    if (ph && MIGRATED_PLACEHOLDERS[ph]) {
      rules[id] = { ...rules[id], placeholder: MIGRATED_PLACEHOLDERS[ph] };
      changed = true;
    }
  }
  return changed ? { ...t, rules } : t;
}

export const useFormattingTemplateStore = create<FormattingTemplateState>((set, get) => ({
  templates: [],
  activeTemplateId: null,
  loaded: false,

  getActiveTemplate: () => {
    const { activeTemplateId, templates } = get();
    if (activeTemplateId) {
      const sys = SYSTEM_TEMPLATES[activeTemplateId];
      if (sys) return sys;
      const found = templates.find((t) => t.id === activeTemplateId);
      if (found) return found;
    }
    return INDUSTRY_STANDARD_TEMPLATE;
  },

  templatePageLayouts: loadTemplatePageLayouts(),
  getTemplateBasePageLayout: (templateId) => {
    const sys = SYSTEM_TEMPLATES[templateId];
    const t = sys || get().templates.find((x) => x.id === templateId);
    return { ...DEFAULT_PAGE_LAYOUT, ...(t?.pageLayout ?? {}) };
  },
  getTemplatePageLayout: (templateId) => ({
    ...get().getTemplateBasePageLayout(templateId),
    ...(get().templatePageLayouts[templateId] ?? {}),
  }),
  setTemplatePageLayout: (templateId, layout) => {
    const next = { ...get().templatePageLayouts, [templateId]: layout };
    saveTemplatePageLayouts(next);
    set({ templatePageLayouts: next });
  },
  resetTemplatePageLayout: (templateId) => {
    const next = { ...get().templatePageLayouts };
    delete next[templateId];
    saveTemplatePageLayouts(next);
    set({ templatePageLayouts: next });
  },

  elementHidden: loadElementOverrides().hidden,
  elementOrder: loadElementOverrides().order,
  setElementHidden: (ids) => {
    saveElementOverrides({ hidden: ids, order: get().elementOrder });
    set({ elementHidden: ids });
  },
  setElementOrder: (ids) => {
    saveElementOverrides({ hidden: get().elementHidden, order: ids });
    set({ elementOrder: ids });
  },
  resetElementOverrides: () => {
    saveElementOverrides({ hidden: [], order: [] });
    set({ elementHidden: [], elementOrder: [] });
  },

  customTransitions: loadTransitionOverrides().custom,
  hiddenTransitions: loadTransitionOverrides().hidden,
  transitionOrder: loadTransitionOverrides().order,
  addTransition: (text) => {
    // v4.22, Derek: transitions are upper-case and end with a colon (CUT TO:).
    // Normalise on the way in so the stored value — shown in the list and
    // inserted in the script — matches, not just the input's display styling.
    let t = text.trim().toUpperCase();
    if (t && !t.endsWith(':')) t += ':';
    if (!t) return;
    const { customTransitions, hiddenTransitions, transitionOrder } = get();
    // Case-insensitive dedupe against both defaults and existing customs.
    const exists = [...DEFAULT_TRANSITIONS, ...customTransitions]
      .some((x) => x.toLowerCase() === t.toLowerCase());
    // Adding back a default that was hidden just un-hides it.
    const wasDefault = DEFAULT_TRANSITIONS.find((x) => x.toLowerCase() === t.toLowerCase());
    if (wasDefault) {
      const hidden = hiddenTransitions.filter((x) => x !== wasDefault);
      saveTransitionOverrides({ custom: customTransitions, hidden, order: transitionOrder });
      set({ hiddenTransitions: hidden });
      return;
    }
    if (exists) return;
    const custom = [...customTransitions, t];
    saveTransitionOverrides({ custom, hidden: hiddenTransitions, order: transitionOrder });
    set({ customTransitions: custom });
  },
  removeCustomTransition: (text) => {
    const { customTransitions, hiddenTransitions, transitionOrder } = get();
    const custom = customTransitions.filter((x) => x !== text);
    const order = transitionOrder.filter((x) => x !== text);
    saveTransitionOverrides({ custom, hidden: hiddenTransitions, order });
    set({ customTransitions: custom, transitionOrder: order });
  },
  setTransitionHidden: (text, hidden) => {
    const { customTransitions, hiddenTransitions, transitionOrder } = get();
    const next = hidden
      ? [...hiddenTransitions.filter((x) => x !== text), text]
      : hiddenTransitions.filter((x) => x !== text);
    saveTransitionOverrides({ custom: customTransitions, hidden: next, order: transitionOrder });
    set({ hiddenTransitions: next });
  },
  setTransitionOrder: (order) => {
    const { customTransitions, hiddenTransitions } = get();
    saveTransitionOverrides({ custom: customTransitions, hidden: hiddenTransitions, order });
    set({ transitionOrder: order });
  },
  resetTransitions: () => {
    saveTransitionOverrides({ custom: [], hidden: [], order: [] });
    set({ customTransitions: [], hiddenTransitions: [], transitionOrder: [] });
  },
  restoreTransitions: (snap) => {
    saveTransitionOverrides(snap);
    set({ customTransitions: snap.custom, hiddenTransitions: snap.hidden, transitionOrder: snap.order });
  },
  getEffectiveTransitions: () => {
    const { customTransitions, hiddenTransitions, transitionOrder } = get();
    const all = [...DEFAULT_TRANSITIONS, ...customTransitions];
    // Apply the user's drag order over the union, then append anything they
    // haven't explicitly placed (new built-ins, fresh customs), then drop hidden.
    const ordered = transitionOrder.length
      ? [...transitionOrder.filter((t) => all.includes(t)), ...all.filter((t) => !transitionOrder.includes(t))]
      : all;
    return ordered.filter((t) => !hiddenTransitions.includes(t));
  },

  getEffectiveRules: () => {
    const { rules } = get().getActiveTemplate();
    const { elementHidden, elementOrder } = get();
    const ids = Object.keys(rules);
    const ordered = elementOrder.length
      ? [...elementOrder.filter((id) => ids.includes(id)),
         ...ids.filter((id) => !elementOrder.includes(id))]
      : ids;
    const out: FormattingTemplate['rules'] = {};
    for (const id of ordered) {
      const r = rules[id];
      out[id] = elementHidden.includes(id) ? { ...r, enabled: false } : r;
    }
    return out;
  },

  /**
   * The canonical list of elements a writer can CHOOSE — the one list behind the
   * Element dropdown, the Insert menu, the Enter-key picker and the right-click
   * menu (v0.84).
   *
   * Previously each of those four re-derived it, and three of them carried their
   * own copy of this exclusion while the Enter-key picker did not — which is why
   * New Act / End of Act / Cast List still turned up there. One list, one place.
   *
   * NON_PICKABLE are structural elements that aren't chosen from an element
   * list (they're inserted deliberately from elsewhere).
   */
  getPickableElements: () => {
    const { elementHidden, elementOrder } = get();
    const list = Object.values(get().getEffectiveRules())
      .filter((r) => r.enabled && !NON_PICKABLE.includes(r.id));

    // v0.86: Dual Dialogue is a real choice in every element list, so it belongs
    // in THE list — not bolted on at each call site (which is how it ended up
    // present in some menus and missing from others). It isn't a template rule
    // (it's a structure, not a paragraph type), so it's synthesized here. That
    // means it can be hidden and reordered in Customize > Elements like anything
    // else, and every surface picks that up for free.
    if (!elementHidden.includes(DUAL_DIALOGUE_ID)) {
      const dual = {
        id: DUAL_DIALOGUE_ID,
        label: 'Dual Dialogue',
        isBuiltIn: true,
        enabled: true,
      } as FormattingTemplate['rules'][string];

      const ordered = elementOrder.indexOf(DUAL_DIALOGUE_ID);
      if (ordered >= 0) {
        // The user has placed it explicitly: honour their position among the
        // elements they've ordered.
        const before = elementOrder.slice(0, ordered);
        const at = list.findIndex((r) => !before.includes(r.id));
        list.splice(at < 0 ? list.length : at, 0, dual);
      } else {
        // Default home: immediately after Dialogue.
        const di = list.findIndex((r) => r.id === 'dialogue');
        list.splice(di < 0 ? list.length : di + 1, 0, dual);
      }
    }
    return list;
  },

  getEnabledElements: () => {
    return Object.values(get().getEffectiveRules())
      .filter((r) => r.enabled)
      .map((r) => r.id);
  },

  isEnforceMode: () => {
    return get().getActiveTemplate().mode === 'enforce';
  },

  loadTemplates: async () => {
    try {
      const templates = await (api as any).listFormattingTemplates();
      // Stale default placeholders in stored templates follow the new defaults.
      set({ templates: templates.map(migrateTemplatePlaceholders), loaded: true });
    } catch {
      // Storage not available yet or no templates
      set({ loaded: true });
    }
  },

  createTemplate: async (data) => {
    const id = uuid();
    const ts = now();
    const template: FormattingTemplate = {
      id,
      name: data.name || 'Untitled Template',
      description: data.description || '',
      mode: data.mode || 'enforce',
      category: data.category || 'user',
      rules: data.rules || { ...INDUSTRY_STANDARD_TEMPLATE.rules },
      createdAt: ts,
      updatedAt: ts,
    };
    try {
      await (api as any).createFormattingTemplate(template);
    } catch { /* web fallback: store in memory */ }
    set((s) => ({ templates: [...s.templates, template] }));
    return template;
  },

  updateTemplate: async (id, data) => {
    const ts = now();
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, ...data, updatedAt: ts } : t,
      ),
    }));
    const updated = get().templates.find((t) => t.id === id);
    if (updated) {
      try {
        await (api as any).updateFormattingTemplate(id, updated);
      } catch { /* ignore */ }
    }
  },

  deleteTemplate: async (id) => {
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      activeTemplateId: s.activeTemplateId === id ? null : s.activeTemplateId,
    }));
    try {
      await (api as any).deleteFormattingTemplate(id);
    } catch { /* ignore */ }
  },

  duplicateTemplate: async (id) => {
    const source = SYSTEM_TEMPLATES[id] || get().templates.find((t) => t.id === id);
    if (!source) throw new Error('Template not found');

    return get().createTemplate({
      name: `${source.name} (Copy)`,
      description: source.description,
      mode: source.mode,
      rules: JSON.parse(JSON.stringify(source.rules)),
    });
  },

  setActiveTemplateId: (id) => {
    set({ activeTemplateId: id });
  },
}));
