/**
 * templateCss — generateTemplateCss turns a FormattingTemplate into the CSS
 * string injected over screenplay.css when a custom template is active. These
 * tests pin the exact emitted text: the selector shapes (built-in class vs
 * custom-element attribute selector), property order and units (pt for
 * font-size/margin-top, calc() over --pl/--pw/--pr CSS vars for indents), the
 * :first-child margin reset, the ::before placeholder block with its string
 * escaping, and the skip rules (disabled rules, sub-epsilon indents). A drift
 * in any of these silently restyles every custom-formatted script, so exact
 * string equality is the point.
 *
 * injectTemplateCss is a thin DOM wrapper and is deliberately not covered here.
 */
import { describe, it, expect } from 'vitest';
import { generateTemplateCss } from './templateCss';
import { createDefaultRule } from '../stores/formattingTypes';
import type { FormattingTemplate, FormattingElementRule } from '../stores/formattingTypes';
import type { PageLayout } from '../stores/editorStore';

// US Letter with the standard screenplay margins: content starts 1.5in from the
// left edge and ends 1in before the right edge.
const LAYOUT: PageLayout = {
  pageWidth: 8.5,
  pageHeight: 11,
  topMargin: 72,
  bottomMargin: 72,
  headerMargin: 36,
  footerMargin: 36,
  leftMargin: 1.5,
  rightMargin: 1,
  headerContent: { left: '', center: '', right: '' },
  footerContent: { left: '', center: '', right: '' },
  headerStartPage: 2,
  footerStartPage: 2,
};

/** A rule built on the store's own defaults (enabled, no styling, indents that
 *  exactly match the standard margins → zero padding). */
const rule = (
  id: string,
  isBuiltIn: boolean,
  over: Partial<FormattingElementRule> = {},
): FormattingElementRule => ({ ...createDefaultRule(id, id, isBuiltIn), ...over });

const template = (...rules: FormattingElementRule[]): FormattingTemplate => ({
  id: 'tmpl-test',
  name: 'Test Template',
  description: '',
  mode: 'override',
  category: 'user',
  rules: Object.fromEntries(rules.map((r) => [r.id, r])),
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('generateTemplateCss — built-in element, fully styled', () => {
  const sceneHeading = rule('sceneHeading', true, {
    fontFamily: 'Arial',
    fontSize: 14,
    bold: true,
    underline: true,
    strikethrough: true,
    textTransform: 'uppercase',
    textColor: '#123456',
    backgroundColor: '#fffbe6',
    marginTop: 24,
    leftIndent: 2,    // 0.5in past the 1.5in margin → calc() padding
    rightIndent: 6,   // 8.5 - 6 - 1 = 1.5in short of the right margin → calc()
    placeholder: 'Where are we?',
  });

  it('emits the exact rule block, :first-child reset, and placeholder block', () => {
    expect(generateTemplateCss(template(sceneHeading), LAYOUT)).toBe(
      [
        '.page .screenplay-element.scene-heading {',
        "  font-family: 'Arial', 'Courier Prime', 'Courier New', monospace;",
        '  font-size: 14pt;',
        '  font-weight: bold;',
        '  font-style: normal;',
        '  text-decoration: underline line-through;',
        '  text-transform: uppercase;',
        '  text-align: left;',
        '  margin-top: 24pt;',
        '  padding-left: calc(2in - var(--pl, 1.5in));',
        '  padding-right: calc(var(--pw, 8.5in) - 6in - var(--pr, 1in));',
        '  color: #123456;',
        '  background-color: #fffbe6;',
        '}',
        '',
        '.page .screenplay-element.scene-heading:first-child { margin-top: 0; }',
        '',
        // Placeholder targets the TipTap data-type (hyphenated CSS class name)
        // and mirrors only text-transform/italic from the rule.
        'div[data-type="scene-heading"].is-empty::before {',
        "  content: 'Where are we?';",
        '  color: #ccc;',
        '  pointer-events: none;',
        '  float: left;',
        '  height: 0;',
        '  text-transform: uppercase;',
        '}',
        '',
      ].join('\n'),
    );
  });
});

describe('generateTemplateCss — custom element, default styling', () => {
  it('uses the data-custom-type selector and collapses zero indents/margins', () => {
    const custom = rule('b7f3-custom-id', false, { textAlign: 'center' });
    // Defaults: leftIndent 1.5 == leftMargin and rightIndent 7.5 leaves exactly
    // the 1in right margin, so both paddings are literal 0 — no calc().
    // marginTop 0 → 'margin-top: 0;' and NO :first-child override.
    expect(generateTemplateCss(template(custom), LAYOUT)).toBe(
      [
        '.page .screenplay-element.custom-element[data-custom-type="b7f3-custom-id"] {',
        '  font-weight: normal;',
        '  font-style: normal;',
        '  text-decoration: none;',
        '  text-transform: none;',
        '  text-align: center;',
        '  margin-top: 0;',
        '  padding-left: 0;',
        '  padding-right: 0;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('treats indents within the 0.01in epsilon as zero padding', () => {
    // 1.505 - 1.5 = 0.005in and 8.5 - 7.495 - 1 = 0.005in: both under the
    // epsilon, so the generator emits plain zeros instead of tiny calc()s.
    const nearZero = rule('near-zero', false, { leftIndent: 1.505, rightIndent: 7.495 });
    const css = generateTemplateCss(template(nearZero), LAYOUT);
    expect(css).toContain('  padding-left: 0;');
    expect(css).toContain('  padding-right: 0;');
    expect(css).not.toContain('calc(');
  });
});

describe('generateTemplateCss — placeholder escaping', () => {
  it("escapes backslashes, single quotes, and newlines in content:''", () => {
    // Placeholder is the raw string:  It's a<newline>back\slash
    const r = rule('escapee', false, { placeholder: "It's a\nback\\slash", italic: true });
    const css = generateTemplateCss(template(r), LAYOUT);
    // Escape order in the source: \ → \\ first, then ' → \', then newline → '\A '.
    expect(css).toContain("  content: 'It\\'s a\\A back\\\\slash';");
    // Placeholder block mirrors italic from the rule.
    const placeholderBlock = css.slice(css.indexOf('div[data-type="custom-element"]'));
    expect(placeholderBlock).toContain('  font-style: italic;');
    expect(placeholderBlock).not.toContain('text-transform:'); // rule is 'none' → omitted
  });
});

describe('generateTemplateCss — skips and empty inputs', () => {
  it('skips disabled rules entirely, even ones with placeholders', () => {
    const off = rule('action', true, { enabled: false, placeholder: 'never seen', marginTop: 12 });
    expect(generateTemplateCss(template(off), LAYOUT)).toBe('');
  });

  it('returns an empty string for a template with no rules', () => {
    expect(generateTemplateCss(template(), LAYOUT)).toBe('');
  });

  it('emits one block per enabled rule, in rules-object insertion order', () => {
    const css = generateTemplateCss(
      template(rule('dialogue', true), rule('character', true)),
      LAYOUT,
    );
    const dialogueAt = css.indexOf('.page .screenplay-element.dialogue {');
    const characterAt = css.indexOf('.page .screenplay-element.character {');
    expect(dialogueAt).toBeGreaterThanOrEqual(0);
    expect(characterAt).toBeGreaterThan(dialogueAt);
  });

  it('throws a TypeError for a null template (null handling lives in injectTemplateCss)', () => {
    // KNOWN LIMITATION: generateTemplateCss reads template.rules unguarded, so a
    // null template (forbidden by the types but possible from JS callers) throws
    // rather than returning ''. The null path is injectTemplateCss(null).
    expect(() =>
      generateTemplateCss(null as unknown as FormattingTemplate, LAYOUT),
    ).toThrow(TypeError);
  });
});

describe('generateTemplateCss — built-in id missing from ELEMENT_CSS_CLASS', () => {
  it('falls back to the custom selector but leaks data-type="undefined" for the placeholder', () => {
    // KNOWN LIMITATION: for an isBuiltIn rule whose id is not in
    // ELEMENT_CSS_CLASS, getSelector falls back to the custom-element attribute
    // selector, but getPlaceholderSelector does NOT — it interpolates the failed
    // lookup, emitting a literal data-type="undefined" selector that matches
    // nothing. The two selectors disagree about which node the rule targets.
    const ghost = rule('notARealBuiltIn', true, { placeholder: 'hm' });
    const css = generateTemplateCss(template(ghost), LAYOUT);
    expect(css).toContain(
      '.page .screenplay-element.custom-element[data-custom-type="notARealBuiltIn"] {',
    );
    expect(css).toContain('div[data-type="undefined"].is-empty::before {');
  });
});
