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

const CSS_TOKENS = DESIGN_TOKENS.filter((t) => t.cssVar);
const STORE_TOKENS = DESIGN_TOKENS.filter((t) => t.store);

describe('design token registry', () => {
  it('every token is exactly one kind — css-var or store-bound', () => {
    for (const t of DESIGN_TOKENS) {
      expect(Boolean(t.cssVar) !== Boolean(t.store), `${t.id} must be css-var xor store`).toBe(true);
    }
  });

  it('has unique ids and unique css vars', () => {
    const ids = DESIGN_TOKENS.map((t) => t.id);
    const vars = CSS_TOKENS.map((t) => t.cssVar);
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

  // The whole point of the panel: NO dead knobs. Each css-var token's variable
  // must actually be read via var(--x, …), or moving its slider does nothing —
  // the silent no-op this project treats as a cardinal sin. (Store-bound tokens
  // drive a store field instead, checked below.)
  it('every css-var token is consumed by the stylesheet (no dead knobs)', () => {
    const dead = CSS_TOKENS.filter((t) => !ALL_CSS.includes(`var(${t.cssVar}`));
    expect(dead.map((t) => `${t.id} → ${t.cssVar}`)).toEqual([]);
  });

  it('every store-bound token has get and set', () => {
    for (const t of STORE_TOKENS) {
      expect(typeof t.store!.get, t.id).toBe('function');
      expect(typeof t.store!.set, t.id).toBe('function');
    }
  });

  // At least one --dz-* usage must fall back to the declared default, or the
  // knob's reset target is a value the CSS never actually renders. (A token can
  // be read in several rules — a base rule and a mode-specific one — with
  // different fallbacks; the default must match the mode the def represents.)
  it('--dz-* defaults are a real fallback somewhere in the CSS', () => {
    for (const t of CSS_TOKENS) {
      if (!t.cssVar!.startsWith('--dz-')) continue;
      const re = new RegExp(`var\\(${t.cssVar},\\s*([0-9.]+)(px|in|pt)?\\)`, 'g');
      const fallbacks = [...ALL_CSS.matchAll(re)].map((m) => parseFloat(m[1]));
      expect(fallbacks.length, `${t.id} has no var() usage with a numeric fallback`).toBeGreaterThan(0);
      expect(fallbacks, `${t.id} default ${t.def} is not a fallback anywhere`).toContain(t.def);
    }
  });
});

describe('applyDesignVars', () => {
  afterEach(() => {
    for (const t of CSS_TOKENS) document.documentElement.style.removeProperty(t.cssVar!);
  });

  it('sets overridden tokens and clears the rest', () => {
    applyDesignVars({ editorMainPadTop: 48, toolbarBtnRadius: 8 });
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--dz-editor-main-pad-top')).toBe('48px');
    expect(root.style.getPropertyValue('--dz-toolbar-btn-radius')).toBe('8px');
    // an untouched token leaves no inline property (CSS default wins)
    expect(root.style.getPropertyValue('--dz-dialog-radius')).toBe('');
  });

  it('clears a property when its override is removed', () => {
    applyDesignVars({ dialogRadius: 12 });
    expect(document.documentElement.style.getPropertyValue('--dz-dialog-radius')).toBe('12px');
    applyDesignVars({});
    expect(document.documentElement.style.getPropertyValue('--dz-dialog-radius')).toBe('');
  });

  it('never writes a :root property for a store-bound token', () => {
    applyDesignVars({ menuSpacing: 8, toolbarSpacing: 6 });
    expect(document.documentElement.getAttribute('style') || '').not.toContain('undefined');
  });

  it('ignores unknown keys', () => {
    applyDesignVars({ notAToken: 5 } as unknown as Record<string, number>);
    expect(document.documentElement.getAttribute('style') || '').not.toContain('notAToken');
  });
});

describe('buildOverrideCss', () => {
  it('returns empty string with no overrides', () => {
    expect(buildOverrideCss({})).toBe('');
  });

  it('emits only css-var tokens that differ from their default', () => {
    // toolbarSpacing is store-bound → never in the CSS dump; toolbarBtnRadius at
    // its default is skipped; dialogRadius override is emitted.
    const css = buildOverrideCss({ dialogRadius: 12, toolbarBtnRadius: 5 /* == default */, toolbarSpacing: 10 });
    expect(css).toContain('--dz-dialog-radius: 12px;');
    expect(css).not.toContain('--dz-toolbar-btn-radius');
    expect(css).not.toContain('toolbarSpacing');
    expect(css.startsWith(':root {')).toBe(true);
  });

  it('formats px overrides in the :root block', () => {
    const css = buildOverrideCss({ editorMainPadTop: 48, dialogRadius: 12 });
    expect(css).toContain('--dz-editor-main-pad-top: 48px;');
    expect(css).toContain('--dz-dialog-radius: 12px;');
  });
});

describe('groups', () => {
  it('flattened tokens equal the sum of group tokens', () => {
    const summed = DESIGN_GROUPS.reduce((n, g) => n + g.tokens.length, 0);
    expect(DESIGN_TOKENS.length).toBe(summed);
  });
});
