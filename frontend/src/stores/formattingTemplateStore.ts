/**
 * Zustand store for the formatting template system.
 *
 * Manages template CRUD, per-document template assignment, and provides
 * the resolved active template.
 */

import { create } from 'zustand';

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
  elementHidden: string[];
  elementOrder: string[];
  setElementHidden: (ids: string[]) => void;
  setElementOrder: (ids: string[]) => void;
  resetElementOverrides: () => void;
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
export const NON_PICKABLE = ['newAct', 'endOfAct', 'castList'];

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch { /* fallback */ }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function now(): string {
  return new Date().toISOString();
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
    return Object.values(get().getEffectiveRules())
      .filter((r) => r.enabled && !NON_PICKABLE.includes(r.id));
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
      set({ templates, loaded: true });
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
