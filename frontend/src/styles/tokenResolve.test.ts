/**
 * tokenResolve.test.ts (v7.01) — the `--fd-*` equivalent of designTokens.test.ts.
 *
 * WHY THIS EXISTS. The v7.00 style audit found SIX theme tokens that the
 * stylesheets consumed but no theme defined: --fd-toolbar-hover, --fd-hover-bg,
 * --fd-hover, --fd-background, --fd-text-dim, --fd-text-secondary. Roughly fifty
 * hover, selected-row and background declarations therefore computed to nothing.
 * A hovered primary dialog button went transparent. The selected row in the
 * Element Templates editor had an invisible highlight. Nothing failed, nothing
 * warned — CSS resolves an undefined custom property to the empty string and
 * carries on.
 *
 * The `--dz-*` design tokens never had this problem because designTokens.test.ts
 * asserts every consumed var is registered. This file gives the theme tokens the
 * same gate: every `var(--fd-…)` in the stylesheets and in .tsx inline styles
 * must be defined in :root.
 *
 * A token used ONLY with a fallback — `var(--fd-x, #333)` — is still a smell
 * (a theme can never influence it), so those are reported separately and
 * allow-listed explicitly rather than silently passing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLE_DIR = join(__dirname, 'screenplay');
const SRC_DIR = join(__dirname, '..');

function readAllCss(): string {
  return readdirSync(STYLE_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(STYLE_DIR, f), 'utf8'))
    .join('\n');
}

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(p, out);
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(p);
  }
  return out;
}

const css = readAllCss();
/** Names defined anywhere as a custom property declaration (`--fd-x: value`). */
const defined = new Set([...css.matchAll(/(--fd-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

/** Every use, with a note on whether that use carried a fallback. */
function uses(text: string): Array<{ name: string; hasFallback: boolean }> {
  return [...text.matchAll(/var\(\s*(--fd-[a-z0-9-]+)\s*(,)?/g)].map((m) => ({
    name: m[1],
    hasFallback: Boolean(m[2]),
  }));
}

/**
 * Tokens deliberately used only through a fallback. Keep this list SHORT and
 * justified — each entry is a color a theme cannot reach. v7.01 emptied it by
 * defining the seven that were on it (see 01-fonts-base.css §A226).
 */
const FALLBACK_ONLY_OK = new Set<string>([]);

/** Strip comments, preserving line count so reported line numbers stay true. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

describe('theme tokens (--fd-*) resolve', () => {
  it('every --fd-* used in the stylesheets is defined in a theme', () => {
    const missing = [...new Set(uses(css).map((u) => u.name))]
      .filter((n) => !defined.has(n))
      .sort();
    expect(missing, `undefined theme tokens: ${missing.join(', ')}`).toEqual([]);
  });

  it('every --fd-* used in a .tsx inline style is defined in a theme', () => {
    const missing = new Set<string>();
    for (const file of walkTsx(SRC_DIR)) {
      for (const u of uses(readFileSync(file, 'utf8'))) {
        if (!defined.has(u.name)) missing.add(u.name);
      }
    }
    const list = [...missing].sort();
    expect(list, `undefined theme tokens in components: ${list.join(', ')}`).toEqual([]);
  });

  it('no --fd-* is reachable only through a fallback (themes must own it)', () => {
    const byName = new Map<string, { total: number; withFallback: number }>();
    for (const u of uses(css)) {
      const rec = byName.get(u.name) ?? { total: 0, withFallback: 0 };
      rec.total += 1;
      if (u.hasFallback) rec.withFallback += 1;
      byName.set(u.name, rec);
    }
    const fallbackOnly = [...byName.entries()]
      .filter(([name, r]) => r.total === r.withFallback && !defined.has(name) && !FALLBACK_ONLY_OK.has(name))
      .map(([name]) => name)
      .sort();
    expect(fallbackOnly, `only ever used with a fallback: ${fallbackOnly.join(', ')}`).toEqual([]);
  });

  it('the six tokens the v7.00 audit found undefined are defined now', () => {
    for (const t of [
      '--fd-toolbar-hover', '--fd-hover-bg', '--fd-hover',
      '--fd-background', '--fd-text-dim', '--fd-text-secondary',
    ]) {
      expect(defined.has(t), `${t} must be defined in :root`).toBe(true);
    }
  });

  it('the state colors exist and the light themes override the danger red', () => {
    for (const t of ['--fd-danger', '--fd-success', '--fd-warning']) {
      expect(defined.has(t), `${t} must be defined`).toBe(true);
    }
    // more than one definition = at least one theme overrides the dark default
    const dangerDefs = [...css.matchAll(/--fd-danger\s*:/g)].length;
    expect(dangerDefs).toBeGreaterThan(1);
  });
});

describe('custom themes can reach every colour', () => {
  it('every --fd-* colour defined in :root is editable in Themes (or listed as exempt)', () => {
    // v7.02 (style audit remaining #14). The original gap happened because a
    // colour was added to the app and forgotten in the Themes editor; nothing
    // caught it. This is that catch.
    const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    expect(root, ':root block must be findable').toBeTruthy();
    const rootTokens = [...root![1].matchAll(/(--fd-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);

    const themesSrc = readFileSync(join(SRC_DIR, 'components', 'themes.ts'), 'utf8');
    const editable = new Set([...themesSrc.matchAll(/key:\s*'(--[a-z0-9-]+)'/g)].map((m) => m[1]));

    /** Deliberately NOT user-editable, with the reason. */
    const EXEMPT = new Map<string, string>([
      ['--fd-hairline-w', 'a width, not a colour — belongs to the Design window'],
      ['--fd-chrome-shadow', 'a full box-shadow value, not a single colour'],
      ['--fd-page-bg', 'already editable under its own Page group key'],
      // aliases: they resolve to a token that IS editable, so editing the
      // parent is the way to change them.
      ['--fd-toolbar-hover', 'alias of --fd-menu-hover'],
      ['--fd-hover-bg', 'alias of --fd-menu-hover'],
      ['--fd-hover', 'alias of --fd-menu-hover'],
      ['--fd-background', 'alias of --fd-bg'],
      ['--fd-text-dim', 'alias of --fd-text-muted'],
      ['--fd-text-secondary', 'alias of --fd-text-muted'],
      ['--fd-accent-bg', 'derived from --fd-accent'],
      ['--fd-bg-dim', 'alias of --fd-overlay-subtle'],
      ['--fd-bg-hover', 'alias of --fd-overlay-light'],
      ['--fd-canvas-bg', 'alias of --fd-bg'],
      ['--fd-panel-bg', 'alias of --fd-navigator-bg'],
      ['--fd-tooltip-bg', 'alias of --fd-dropdown-bg'],
      ['--fd-tooltip-text', 'alias of --fd-text'],
      ['--fd-btn-bg', 'editable'], ['--fd-btn-text', 'editable'], ['--fd-btn-hover', 'editable'],
    ]);
    const unreachable = rootTokens.filter((t) => !editable.has(t) && !EXEMPT.has(t)).sort();
    expect(
      unreachable,
      `not editable in Themes and not exempt: ${unreachable.join(', ')} — add to THEME_VARS or to EXEMPT with a reason`,
    ).toEqual([]);
  });
});

describe('one primary-button idiom', () => {
  it('no component uses the retired bare `dialog-primary` class', () => {
    const offenders: string[] = [];
    for (const file of walkTsx(SRC_DIR)) {
      const text = readFileSync(file, 'utf8');
      // `dialog-btn-primary` is the survivor; a bare `dialog-primary` is not.
      for (const m of text.matchAll(/className="([^"]*\bdialog-primary\b[^"]*)"/g)) {
        if (!m[1].includes('dialog-btn-primary')) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders, `use "dialog-btn dialog-btn-primary": ${offenders.join(' | ')}`).toEqual([]);
  });
});

describe('no native browser dialogs', () => {
  it('confirm/alert/prompt are never called outside ConfirmDialog', () => {
    const offenders: string[] = [];
    for (const file of walkTsx(SRC_DIR)) {
      if (file.endsWith('ConfirmDialog.tsx')) continue;
      const text = stripComments(readFileSync(file, 'utf8'));
      text.split('\n').forEach((code, i) => {
        // window.confirm is an async Tauri shim: it returns a Promise, which is
        // always truthy, so `if (confirm(...))` runs the branch unconditionally.
        if (/(^|[^.\w])(confirm|alert|prompt)\s*\(/.test(code) && !/\w(Confirm|Alert|Prompt)\s*\(/.test(code)) {
          offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders, `use confirmDialog/promptDialog instead: ${offenders.join(', ')}`).toEqual([]);
  });
});
