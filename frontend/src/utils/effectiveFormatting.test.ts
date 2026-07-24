/**
 * Effective formatting — the enforce-mode lock computation and cursor-element
 * rule lookup that drive the toolbar's enabled/disabled state. Pins
 * getLockedFormatting (which attributes are locked for an element) and
 * getCurrentElementRule (built-in lookup by node type, custom-element lookup
 * by customTypeId). The toggle*Override functions are NOT covered here: they
 * drive a live TipTap Editor command chain (focus/setMark/unsetMark/run) and
 * cannot be exercised without a real editor instance.
 *
 * getCurrentElementRule only reads editor.state.selection.$from.parent, so a
 * minimal stub stands in for the Editor — no jsdom required (the module's own
 * imports are all type-only).
 */
import { describe, it, expect } from 'vitest';
import type { Editor } from '@tiptap/core';
import type { FormattingElementRule, FormattingTemplate } from '../stores/formattingTypes';
import { createDefaultRule } from '../stores/formattingTypes';
import { getLockedFormatting, getCurrentElementRule } from './effectiveFormatting';
import type { LockedFormatting } from './effectiveFormatting';

/** A rule built from the project's own default factory, with overrides. */
const rule = (id: string, overrides: Partial<FormattingElementRule> = {}): FormattingElementRule =>
  ({ ...createDefaultRule(id, id, true), ...overrides });

/** A minimal template — getCurrentElementRule only ever reads .rules. */
const template = (
  rules: Record<string, FormattingElementRule>,
  mode: 'enforce' | 'override' = 'enforce',
): FormattingTemplate => ({
  id: 'tpl-1',
  name: 'Test Template',
  description: '',
  mode,
  category: 'user',
  rules,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** Stub Editor whose cursor sits inside a node of the given type/attrs. */
const editorAt = (nodeType: string, attrs: Record<string, unknown> = {}): Editor =>
  ({
    state: { selection: { $from: { parent: { type: { name: nodeType }, attrs } } } },
  }) as unknown as Editor;

const NOTHING_LOCKED: LockedFormatting = {
  bold: false, italic: false, underline: false, strikethrough: false,
  textAlign: false, textColor: false, backgroundColor: false, textTransform: false,
  fontFamily: false, fontSize: false, subscript: false, superscript: false,
};

const EVERYTHING_LOCKED: LockedFormatting = {
  bold: true, italic: true, underline: true, strikethrough: true,
  textAlign: true, textColor: true, backgroundColor: true, textTransform: true,
  fontFamily: true, fontSize: true, subscript: true, superscript: true,
};

describe('getLockedFormatting', () => {
  it('locks nothing when the template is not in enforce mode', () => {
    // Even a rule that forbids overrides locks nothing outside enforce mode.
    const locked = getLockedFormatting(rule('dialogue', { allowFormatOverride: false }), false);
    expect(locked).toEqual(NOTHING_LOCKED);
  });

  it('locks nothing in enforce mode when the element has no rule', () => {
    expect(getLockedFormatting(null, true)).toEqual(NOTHING_LOCKED);
  });

  it('locks nothing in enforce mode when the rule allows format override', () => {
    // KNOWN LIMITATION: the function's doc comment says "If allowFormatOverride
    // is true, only attributes that differ from defaults are locked", but the
    // implementation returns the all-false constant unconditionally — no
    // partial locking exists. Pinning the actual behavior, not the comment.
    const bolded = rule('sceneHeading', { bold: true, textAlign: 'center', allowFormatOverride: true });
    expect(getLockedFormatting(bolded, true)).toEqual(NOTHING_LOCKED);
  });

  it('locks all twelve attributes in enforce mode when override is disallowed', () => {
    const locked = getLockedFormatting(rule('transition', { allowFormatOverride: false }), true);
    expect(locked).toEqual(EVERYTHING_LOCKED);
    expect(Object.keys(locked)).toHaveLength(12);
  });

  it('returns the same shared constant object on every call', () => {
    // KNOWN LIMITATION: the function hands out its module-level NO_LOCK /
    // ALL_LOCKED constants by reference. Any caller that mutates the result
    // would silently corrupt every future call. Pinned so a refactor to
    // fresh objects (or a mutation creeping in) is noticed.
    expect(getLockedFormatting(null, false)).toBe(getLockedFormatting(rule('action'), true));
    expect(getLockedFormatting(rule('a', { allowFormatOverride: false }), true))
      .toBe(getLockedFormatting(rule('b', { allowFormatOverride: false }), true));
  });
});

describe('getCurrentElementRule', () => {
  it('returns the template rule for the built-in element under the cursor', () => {
    const dialogueRule = rule('dialogue');
    const tpl = template({ dialogue: dialogueRule, action: rule('action') });
    // Same reference, not a copy — the toolbar reads the live rule object.
    expect(getCurrentElementRule(editorAt('dialogue'), tpl)).toBe(dialogueRule);
  });

  it('returns null for a built-in element the template has no rule for', () => {
    const tpl = template({ dialogue: rule('dialogue') });
    expect(getCurrentElementRule(editorAt('sceneHeading'), tpl)).toBeNull();
  });

  it('resolves custom elements by their customTypeId attribute', () => {
    const customRule = rule('uuid-song-cue');
    const tpl = template({ 'uuid-song-cue': customRule });
    const ed = editorAt('customElement', { customTypeId: 'uuid-song-cue' });
    expect(getCurrentElementRule(ed, tpl)).toBe(customRule);
  });

  it('returns null for a custom element with an unknown or missing customTypeId', () => {
    // Note: a rule keyed 'customElement' is deliberately NOT consulted for
    // customElement nodes — lookup goes through customTypeId only.
    const tpl = template({ customElement: rule('customElement') });
    expect(getCurrentElementRule(editorAt('customElement', { customTypeId: 'nope' }), tpl)).toBeNull();
    expect(getCurrentElementRule(editorAt('customElement', {}), tpl)).toBeNull();
  });

  it('leaks Object.prototype members for pathologically-named node types', () => {
    // KNOWN LIMITATION: template.rules is indexed with plain bracket access
    // and a truthiness check, so a node type (or customTypeId) named after an
    // inherited Object.prototype member — 'toString', 'constructor', ... —
    // returns that function instead of null. Harmless while schema node type
    // names are controlled, but pinned here because it is the actual behavior.
    const leaked: unknown = getCurrentElementRule(editorAt('toString'), template({}));
    expect(leaked).toBe(Object.prototype.toString);
  });
});
