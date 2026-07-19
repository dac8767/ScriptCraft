// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DESIGN_GROUPS,
  DESIGN_TOKENS,
  applyDesignVars,
  buildOverrideCss,
} from './designTokens';

// Concatenate every screenplay stylesheet once — the source of truth for what
// the running app actually consumes.
const STYLES_DIR = join(__dirname, '..', 'styles', 'screenplay');
const ALL_CSS = readdirSync(STYLES_DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(STYLES_DIR, f), 'utf8'))
  .join('\n');

describe('design token registry', () => {
  it('has unique ids and unique css vars', () => {
    const ids = DESIGN_TOKENS.map((t) => t.id);
    const vars = DESIGN_TOKENS.map((t) => t.cssVar);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it('every default sits within its slider range', () => {
    for (const t of DESIGN_TOKENS) {
      expect(t.def, t.id).toBeGreaterThanOrEqual(t.min);
      expect(t.def, t.id).toBeLessThanOrEqual(t.max);
      expect(t.max, t.id).toBeGreaterThan(t.min);
    }
  });

  // The whole point of the panel: NO dead knobs. Each token's CSS variable must
  // actually be read somewhere via var(--x, …), or moving its slider does
  // nothing — the silent no-op this project treats as a cardinal sin.
  it('every token is consumed by the stylesheet (no dead knobs)', () => {
    const dead = DESIGN_TOKENS.filter((t) => !ALL_CSS.includes(`var(${t.cssVar}`));
    expect(dead.map((t) => `${t.id} → ${t.cssVar}`)).toEqual([]);
  });

  // A --dz-* fallback literal must equal the token default, or an unset knob
  // would render at a value the panel claims is something else.
  it('--dz-* fallbacks match the declared defaults', () => {
    for (const t of DESIGN_TOKENS) {
      if (!t.cssVar.startsWith('--dz-')) continue;
      const re = new RegExp(`var\\(${t.cssVar},\\s*([0-9.]+)(px|in|pt)?\\)`);
      const m = ALL_CSS.match(re);
      expect(m, `${t.id} has no var() usage with a numeric fallback`).toBeTruthy();
      if (m) expect(parseFloat(m[1]), `${t.id} fallback`).toBe(t.def);
    }
  });
});

describe('applyDesignVars', () => {
  afterEach(() => {
    for (const t of DESIGN_TOKENS) document.documentElement.style.removeProperty(t.cssVar);
  });

  it('sets overridden tokens and clears the rest', () => {
    applyDesignVars({ pageWidth: 8, toolbarBtnW: 22 });
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--page-width')).toBe('8in');
    expect(root.style.getPropertyValue('--dz-toolbar-btn-w')).toBe('22px');
    // an untouched token leaves no inline property (CSS default wins)
    expect(root.style.getPropertyValue('--dz-menu-height')).toBe('');
  });

  it('clears a property when its override is removed', () => {
    applyDesignVars({ menuHeight: 32 });
    expect(document.documentElement.style.getPropertyValue('--dz-menu-height')).toBe('32px');
    applyDesignVars({});
    expect(document.documentElement.style.getPropertyValue('--dz-menu-height')).toBe('');
  });

  it('ignores unknown keys', () => {
    applyDesignVars({ notAToken: 5 } as unknown as Record<string, number>);
    // nothing thrown, nothing stray set
    expect(document.documentElement.getAttribute('style') || '').not.toContain('notAToken');
  });
});

describe('buildOverrideCss', () => {
  it('returns empty string with no overrides', () => {
    expect(buildOverrideCss({})).toBe('');
  });

  it('emits only tokens that differ from their default', () => {
    const css = buildOverrideCss({ menuHeight: 32, toolbarBtnW: 26 /* == default */ });
    expect(css).toContain('--dz-menu-height: 32px;');
    expect(css).not.toContain('--dz-toolbar-btn-w');
    expect(css.startsWith(':root {')).toBe(true);
  });

  it('formats units per token', () => {
    const css = buildOverrideCss({ pageWidth: 8, pageLineHeight: 1.15, pageFontSize: 11 });
    expect(css).toContain('--page-width: 8in;');
    expect(css).toContain('--screenplay-line-height: 1.15;');
    expect(css).toContain('--screenplay-font-size: 11pt;');
  });
});

describe('groups', () => {
  it('flattened tokens equal the sum of group tokens', () => {
    const summed = DESIGN_GROUPS.reduce((n, g) => n + g.tokens.length, 0);
    expect(DESIGN_TOKENS.length).toBe(summed);
  });
});
