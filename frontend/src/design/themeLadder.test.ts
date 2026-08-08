/**
 * v4.49, Derek: every theme follows the DARK theme's surface ladder — his
 * screenshot annotated which areas are darker, lighter, and the same, and
 * that PATTERN (not the hexes) must hold in every theme:
 *
 *   status bar < panels/window headers < body/editor canvas
 *     <= cards (dropdown surface) <= menus <= ribbon toolbar
 *
 * each step LIGHTER than the last, in dark and light themes alike. This
 * parses the real stylesheets, resolves each theme's EFFECTIVE tokens
 * (theme override, else the :root dark value), and asserts the ordering —
 * so a future theme tweak that inverts a relationship fails here instead
 * of shipping.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CSS = ['01-fonts-base.css', '22-tools-extra.css']
  .map((f) => readFileSync(join(__dirname, '../styles/screenplay', f), 'utf8'))
  .join('\n');

const SURFACES = ['status-bg', 'navigator-bg', 'bg', 'dropdown-bg', 'menu-bg', 'toolbar-bg'] as const;

/** All --fd-* hex tokens inside one selector block. */
function blockTokens(selector: string): Record<string, string> {
  const re = new RegExp(`${selector.replace(/[[\]"=-]/g, (c) => '\\' + c)}\\s*\\{([^}]*)\\}`, 'g');
  const out: Record<string, string> = {};
  for (const m of CSS.matchAll(re)) {
    for (const t of m[1].matchAll(/--fd-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[t[1]] = t[2];
  }
  return out;
}

const rootTokens = blockTokens(':root');

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

const THEMES = ['light', 'sepia', 'nord', 'dracula', 'solarized-dark', 'solarized-light', 'midnight', 'paper', 'gruvbox', 'catppuccin'];

describe('theme surface ladder', () => {
  it('the dark (:root) reference itself follows the ladder', () => {
    const l = SURFACES.map((s) => lum(rootTokens[s]));
    expect(l[0]).toBeLessThan(l[1]);      // status < panels
    expect(l[1]).toBeLessThan(l[2]);      // panels < body
    for (let i = 3; i < l.length; i++) expect(l[i]).toBeGreaterThanOrEqual(l[i - 1]);
  });

  for (const theme of THEMES) {
    it(`${theme} follows the ladder`, () => {
      const own = blockTokens(`[data-theme="${theme}"]`);
      const eff = (s: string) => own[s] ?? rootTokens[s];
      const l = SURFACES.map((s) => lum(eff(s)));
      const names = SURFACES.map((s, i) => `${s}=${eff(s)} (${l[i].toFixed(0)})`).join(', ');
      expect(l[0], `status !< panels: ${names}`).toBeLessThan(l[1]);
      expect(l[1], `panels !< body: ${names}`).toBeLessThan(l[2]);
      for (let i = 3; i < l.length; i++) {
        expect(l[i], `${SURFACES[i]} darker than ${SURFACES[i - 1]}: ${names}`).toBeGreaterThanOrEqual(l[i - 1]);
      }
    });
  }
});
