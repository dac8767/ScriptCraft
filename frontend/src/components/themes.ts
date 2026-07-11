/**
 * Theme registry + custom themes (v0.78).
 *
 * A theme is a set of CSS custom properties. The built-ins live in
 * screenplay.css under [data-theme="…"]; a CUSTOM theme is stored as a `base`
 * ('dark' or 'light') plus a map of variable overrides.
 *
 * Why a base rather than a full variable set: the stylesheet defines far more
 * variables than anyone wants to hand-pick (and more get added over time). A
 * custom theme therefore sets data-theme to its base — so every unedited
 * variable keeps a sensible value — and layers the user's chosen colors on top
 * as inline properties. A theme created today won't break when a new variable
 * is introduced tomorrow.
 */

export type BuiltInThemeId =
  | 'dark' | 'light' | 'sepia' | 'nord' | 'dracula'
  | 'solarized-dark' | 'solarized-light' | 'midnight';

/** Built-ins can be reordered and hidden, but never edited or deleted. */
export const BUILTIN_THEMES: { id: BuiltInThemeId; label: string; base: 'dark' | 'light' }[] = [
  { id: 'dark', label: 'Dark', base: 'dark' },
  { id: 'light', label: 'Light', base: 'light' },
  { id: 'sepia', label: 'Sepia', base: 'light' },
  { id: 'nord', label: 'Nord', base: 'dark' },
  { id: 'dracula', label: 'Dracula', base: 'dark' },
  { id: 'solarized-dark', label: 'Solarized Dark', base: 'dark' },
  { id: 'solarized-light', label: 'Solarized Light', base: 'light' },
  { id: 'midnight', label: 'Midnight', base: 'dark' },
];

export const BUILTIN_IDS = BUILTIN_THEMES.map((t) => t.id) as string[];

/** The variables a custom theme can set, with human labels. */
export const THEME_VARS: { key: string; label: string; group: string }[] = [
  { key: '--fd-bg', label: 'Workspace background', group: 'Application' },
  { key: '--fd-menu-bg', label: 'Menu bar', group: 'Application' },
  { key: '--fd-menu-hover', label: 'Menu hover', group: 'Application' },
  { key: '--fd-toolbar-bg', label: 'Toolbar', group: 'Application' },
  { key: '--fd-navigator-bg', label: 'Side panels', group: 'Application' },
  { key: '--fd-status-bg', label: 'Status bar', group: 'Application' },
  { key: '--fd-dropdown-bg', label: 'Menus & dialogs', group: 'Application' },
  { key: '--fd-border', label: 'Borders', group: 'Application' },
  { key: '--fd-accent', label: 'Accent / highlight', group: 'Application' },
  { key: '--fd-btn-bg', label: 'Button', group: 'Application' },
  { key: '--fd-btn-text', label: 'Button text', group: 'Application' },
  { key: '--fd-btn-hover', label: 'Button hover', group: 'Application' },

  { key: '--fd-text', label: 'Text', group: 'Text' },
  { key: '--fd-text-muted', label: 'Muted text', group: 'Text' },

  { key: '--fd-page-bg', label: 'Script page', group: 'Page' },
];

export interface CustomTheme {
  id: string;               // 'custom:<timestamp>'
  label: string;
  base: 'dark' | 'light';
  vars: Record<string, string>;
}

export const isCustomTheme = (id: string) => id.startsWith('custom:');

/** Starting colors for a new theme — the base's own values, so the editor
 *  opens showing the theme it's derived from rather than arbitrary defaults. */
export function seedVarsFromBase(base: 'dark' | 'light'): Record<string, string> {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', base);
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out: Record<string, string> = {};
  for (const v of THEME_VARS) {
    const val = cs.getPropertyValue(v.key).trim();
    out[v.key] = val || (base === 'dark' ? '#2b2b2b' : '#ffffff');
  }
  probe.remove();
  return out;
}

/**
 * Apply a theme to the document. Built-ins are just the data-theme attribute;
 * a custom theme sets data-theme to its BASE (so untouched variables still
 * resolve) and layers its overrides on the root element inline.
 */
export function applyThemeToDom(themeId: string, customThemes: CustomTheme[]) {
  const root = document.documentElement;

  // Always clear previous custom overrides first, or switching from a custom
  // theme to a built-in would leave the old colors stuck on the root element.
  for (const v of THEME_VARS) root.style.removeProperty(v.key);

  if (!isCustomTheme(themeId)) {
    root.setAttribute('data-theme', themeId);
    return;
  }
  const t = customThemes.find((c) => c.id === themeId);
  if (!t) {
    root.setAttribute('data-theme', 'dark');   // theme was deleted — fall back
    return;
  }
  root.setAttribute('data-theme', t.base);
  for (const [k, val] of Object.entries(t.vars)) {
    if (val) root.style.setProperty(k, val);
  }
}
