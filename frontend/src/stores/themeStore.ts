/**
 * Theme store (v0.78) — custom themes, display order, and hidden themes.
 * Kept separate from editorStore (which owns the ACTIVE theme id) so the menu,
 * the Customize tab, and the workspace snapshot all read one source.
 */
import { create } from 'zustand';
import { BUILTIN_IDS, type CustomTheme } from '../components/themes';

const KEY = 'opendraft:themeConfig';

interface Persisted {
  custom: CustomTheme[];
  order: string[];
  hidden: string[];
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        custom: Array.isArray(p?.custom) ? p.custom : [],
        order: Array.isArray(p?.order) ? p.order : [],
        hidden: Array.isArray(p?.hidden) ? p.hidden : [],
      };
    }
  } catch { /* ignore */ }
  return { custom: [], order: [], hidden: [] };
}

function save(p: Persisted) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

interface ThemeState {
  customThemes: CustomTheme[];
  /** Display order across built-ins AND custom themes. */
  themeOrder: string[];
  /** Themes hidden from the View > Theme menu. */
  hiddenThemes: string[];

  /** Every theme id in display order (built-ins + custom), including hidden. */
  allThemeIds: () => string[];

  saveCustomTheme: (t: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
  setThemeOrder: (ids: string[]) => void;
  setThemeHidden: (id: string, hidden: boolean) => void;
  resetThemeConfig: () => void;
}

const init = load();

export const useThemeStore = create<ThemeState>((set, get) => ({
  customThemes: init.custom,
  themeOrder: init.order,
  hiddenThemes: init.hidden,

  allThemeIds: () => {
    const { customThemes, themeOrder } = get();
    const known = [...BUILTIN_IDS, ...customThemes.map((c) => c.id)];
    // Ordered ids first (skipping any that no longer exist), then anything new
    // that isn't in the saved order yet — so a theme added later still appears.
    const ordered = themeOrder.filter((id) => known.includes(id));
    return [...ordered, ...known.filter((id) => !ordered.includes(id))];
  },

  saveCustomTheme: (t) => {
    const { customThemes, themeOrder, hiddenThemes } = get();
    const exists = customThemes.some((c) => c.id === t.id);
    const custom = exists
      ? customThemes.map((c) => (c.id === t.id ? t : c))
      : [...customThemes, t];
    const order = themeOrder.includes(t.id) ? themeOrder : [...themeOrder, t.id];
    save({ custom, order, hidden: hiddenThemes });
    set({ customThemes: custom, themeOrder: order });
  },

  deleteCustomTheme: (id) => {
    const { customThemes, themeOrder, hiddenThemes } = get();
    const custom = customThemes.filter((c) => c.id !== id);
    const order = themeOrder.filter((x) => x !== id);
    const hidden = hiddenThemes.filter((x) => x !== id);
    save({ custom, order, hidden });
    set({ customThemes: custom, themeOrder: order, hiddenThemes: hidden });
  },

  setThemeOrder: (ids) => {
    const { customThemes, hiddenThemes } = get();
    save({ custom: customThemes, order: ids, hidden: hiddenThemes });
    set({ themeOrder: ids });
  },

  setThemeHidden: (id, hidden) => {
    const { customThemes, themeOrder, hiddenThemes } = get();
    const next = hidden
      ? [...hiddenThemes.filter((x) => x !== id), id]
      : hiddenThemes.filter((x) => x !== id);
    save({ custom: customThemes, order: themeOrder, hidden: next });
    set({ hiddenThemes: next });
  },

  resetThemeConfig: () => {
    const { customThemes } = get();
    save({ custom: customThemes, order: [], hidden: [] });
    set({ themeOrder: [], hiddenThemes: [] });
  },
}));
