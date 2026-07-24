/**
 * Template conflicts — what the "apply template to an existing script" flow
 * relies on. Pins:
 *
 *  - getDefaultReplacement's canonical fallbacks and its 'action' catch-all.
 *  - getEnabledElementOptions filtering (enabled rules only, template order).
 *  - detectTemplateConflicts: disabled/unknown element counting, label sources
 *    (rule label → customLabel → raw type id), replacement fallback chain
 *    (default → first enabled rule → 'action'), and enforce-mode mark
 *    violations (allowFormatOverride:false locks everything; formatOverride
 *    marks are ALWAYS flagged, even on free-formatting elements).
 *  - detect → resolve as a pair: replaced nodes, stripped marks, and that a
 *    second detect comes back clean — plus the one case where it does NOT
 *    (see KNOWN LIMITATION below).
 *
 * No DOM needed: the functions only touch editor.state / editor.schema /
 * editor.view.dispatch, so a real ProseMirror doc behind a tiny fake Editor
 * is enough. Runs in the default node environment.
 */
import { describe, it, expect } from 'vitest';
import type { Editor } from '@tiptap/core';
import { Schema } from '@tiptap/pm/model';
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import { BUILT_IN_ELEMENT_IDS, createDefaultRule } from '../stores/formattingTypes';
import type { FormattingElementRule, FormattingTemplate } from '../stores/formattingTypes';
import {
  detectTemplateConflicts,
  getDefaultReplacement,
  getEnabledElementOptions,
  resolveTemplateConflicts,
} from './templateConflicts';

// ── Minimal screenplay-ish schema ──
// Mark declaration order matters: ProseMirror stores a text node's marks
// sorted by schema rank, which fixes the conflictingMarks ordering below.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    sceneHeading: { content: 'inline*', group: 'block' },
    action: { content: 'inline*', group: 'block' },
    dialogue: { content: 'inline*', group: 'block' },
    lyrics: { content: 'inline*', group: 'block' },
    shot: { content: 'inline*', group: 'block' },
    customElement: {
      content: 'inline*',
      group: 'block',
      attrs: { customTypeId: { default: null }, customLabel: { default: null } },
    },
  },
  marks: { bold: {}, italic: {}, textStyle: {}, formatOverride: {} },
});

// ── Helper constructors ──

const block = (type: string, text: string, markNames: string[] = []): PMNode =>
  schema.nodes[type].create(
    null,
    schema.text(text, markNames.map((n) => schema.marks[n].create())),
  );

const custom = (customTypeId: string, customLabel: string, text: string): PMNode =>
  schema.nodes.customElement.create({ customTypeId, customLabel }, schema.text(text));

/** Fake Editor: real ProseMirror state, dispatch applies the transaction. */
function makeEditor(blocks: PMNode[]): Editor {
  let state = EditorState.create({ doc: schema.nodes.doc.create(null, blocks) });
  const fake = {
    schema,
    get state() { return state; },
    view: {
      dispatch(tr: Transaction) { state = state.apply(tr); },
    },
  };
  return fake as unknown as Editor;
}

const rule = (
  id: string,
  label: string,
  overrides: Partial<FormattingElementRule> = {},
): FormattingElementRule => ({
  ...createDefaultRule(id, label, BUILT_IN_ELEMENT_IDS.includes(id)),
  ...overrides,
});

const template = (
  mode: FormattingTemplate['mode'],
  rules: FormattingElementRule[],
): FormattingTemplate => ({
  id: 'tpl-test',
  name: 'Test Template',
  description: '',
  mode,
  category: 'user',
  rules: Object.fromEntries(rules.map((r) => [r.id, r])),
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

// ── getDefaultReplacement ──

describe('getDefaultReplacement', () => {
  it('maps each known retired element to its canonical stand-in', () => {
    expect(getDefaultReplacement('lyrics')).toBe('dialogue');
    expect(getDefaultReplacement('castList')).toBe('general');
    expect(getDefaultReplacement('shot')).toBe('action');
    expect(getDefaultReplacement('showEpisode')).toBe('general');
    expect(getDefaultReplacement('newAct')).toBe('sceneHeading');
    expect(getDefaultReplacement('endOfAct')).toBe('action');
  });

  it('falls back to action for unknown or empty element types', () => {
    expect(getDefaultReplacement('someCustomUuid')).toBe('action');
    expect(getDefaultReplacement('')).toBe('action');
    // even for element types that exist but have no entry in the map
    expect(getDefaultReplacement('dialogue')).toBe('action');
  });
});

// ── getEnabledElementOptions ──

describe('getEnabledElementOptions', () => {
  it('lists only enabled rules, in template rule order', () => {
    const tpl = template('override', [
      rule('sceneHeading', 'Scene Heading'),
      rule('lyrics', 'Lyrics', { enabled: false }),
      rule('c-uuid-1', 'Widget', { isBuiltIn: false }),
    ]);
    expect(getEnabledElementOptions(tpl)).toEqual([
      { id: 'sceneHeading', label: 'Scene Heading' },
      { id: 'c-uuid-1', label: 'Widget' },
    ]);
  });

  it('returns an empty list when every rule is disabled', () => {
    const tpl = template('override', [rule('action', 'Action', { enabled: false })]);
    expect(getEnabledElementOptions(tpl)).toEqual([]);
  });
});

// ── detectTemplateConflicts: disabled / unknown elements (override mode) ──

describe('detectTemplateConflicts — disabled and unknown elements', () => {
  const tpl = template('override', [
    rule('sceneHeading', 'Scene Heading'),
    rule('action', 'Action'),
    rule('dialogue', 'Dialogue'),
    rule('lyrics', 'Lyrics', { enabled: false }),
  ]);
  const editor = makeEditor([
    block('action', 'Fine.', ['bold']), // enabled; bold is irrelevant in override mode
    block('lyrics', 'la la'),
    block('lyrics', 'more la'),
    block('shot', 'CU ON FACE'), // built-in but absent from the template
    custom('myCustom', 'My Custom', 'stray'), // custom type absent from the template
  ]);
  const conflicts = detectTemplateConflicts(editor, tpl);

  it('counts nodes per offending type, in document order of first appearance', () => {
    expect(conflicts.disabledElements).toEqual([
      { elementType: 'lyrics', elementLabel: 'Lyrics', nodeCount: 2, replacementType: 'dialogue' },
      // Absent-from-template built-in: label falls back to the raw type id,
      // not a human-readable name.
      { elementType: 'shot', elementLabel: 'shot', nodeCount: 1, replacementType: 'action' },
      // Absent custom element: label comes from the node's customLabel attr.
      { elementType: 'myCustom', elementLabel: 'My Custom', nodeCount: 1, replacementType: 'action' },
    ]);
    expect(conflicts.hasConflicts).toBe(true);
  });

  it('never reports formatting violations in override mode', () => {
    expect(conflicts.formattingViolations).toEqual([]);
  });

  it('reports no conflicts for a doc that only uses enabled elements', () => {
    const clean = makeEditor([block('sceneHeading', 'INT. LAB - DAY'), block('action', 'Beat.')]);
    expect(detectTemplateConflicts(clean, tpl)).toEqual({
      disabledElements: [],
      formattingViolations: [],
      hasConflicts: false,
    });
  });
});

// ── detectTemplateConflicts: replacement fallback chain ──

describe('detectTemplateConflicts — replacement fallbacks', () => {
  it('falls back to the first enabled rule when the default replacement is disabled', () => {
    // shot's default replacement is 'action', but action is disabled here,
    // so it takes the first enabled rule in template order: sceneHeading.
    const tpl = template('override', [
      rule('sceneHeading', 'Scene Heading'),
      rule('action', 'Action', { enabled: false }),
      rule('shot', 'Shot', { enabled: false }),
    ]);
    const editor = makeEditor([block('shot', 'CU')]);
    const conflicts = detectTemplateConflicts(editor, tpl);
    expect(conflicts.disabledElements).toEqual([
      { elementType: 'shot', elementLabel: 'Shot', nodeCount: 1, replacementType: 'sceneHeading' },
    ]);
  });

  it("falls back to 'action' when no rule is enabled, even though action is not in the template", () => {
    // KNOWN LIMITATION: with zero enabled rules the replacement is the
    // hardcoded 'action', which this template does not even contain — a
    // resolve would convert lyrics into an element the template still
    // treats as unknown. Degenerate templates (nothing enabled) never
    // converge. Pinning actual behavior.
    const tpl = template('override', [rule('lyrics', 'Lyrics', { enabled: false })]);
    const editor = makeEditor([block('lyrics', 'hum')]);
    const conflicts = detectTemplateConflicts(editor, tpl);
    expect(conflicts.disabledElements).toEqual([
      { elementType: 'lyrics', elementLabel: 'Lyrics', nodeCount: 1, replacementType: 'action' },
    ]);
  });
});

// ── detectTemplateConflicts: enforce-mode formatting violations ──

describe('detectTemplateConflicts — enforce-mode mark violations', () => {
  const tpl = template('enforce', [
    rule('sceneHeading', 'Scene Heading'),
    rule('action', 'Action', { allowFormatOverride: false }), // everything locked
    rule('dialogue', 'Dialogue'), // allowFormatOverride true → nothing locked
  ]);
  const editor = makeEditor([
    block('action', 'shouty', ['bold']),
    block('action', 'slanted', ['bold', 'italic', 'textStyle']),
    block('action', 'calm'),
    block('dialogue', 'free bold', ['bold']),
    block('dialogue', 'overridden', ['formatOverride']),
  ]);
  const conflicts = detectTemplateConflicts(editor, tpl);

  it('flags locked marks with human labels and per-type node counts', () => {
    // 'calm' has no marks, so action's nodeCount is 2 of 3 nodes. Mark label
    // order follows first-seen order (bold from node 1, then italic and
    // textStyle from node 2, in schema rank order).
    expect(conflicts.formattingViolations[0]).toEqual({
      elementType: 'action',
      elementLabel: 'Action',
      conflictingMarks: ['Bold', 'Italic', 'Font/Size'],
      nodeCount: 2,
      shouldReformat: true,
    });
    expect(conflicts.disabledElements).toEqual([]);
    expect(conflicts.hasConflicts).toBe(true);
  });

  it('ignores ordinary marks on free-formatting elements but always flags formatOverride', () => {
    // dialogue allows format override, so its bold node is fine — but a
    // formatOverride mark is treated as stale on ANY element when switching
    // templates (isMarkLocked returns true for it unconditionally).
    expect(conflicts.formattingViolations).toHaveLength(2);
    expect(conflicts.formattingViolations[1]).toEqual({
      elementType: 'dialogue',
      elementLabel: 'Dialogue',
      conflictingMarks: ['Format Override'],
      nodeCount: 1,
      shouldReformat: true,
    });
  });
});

// ── detect → resolve as a pair ──

describe('resolveTemplateConflicts — detect then resolve leaves no conflicts', () => {
  const tpl = template('enforce', [
    rule('sceneHeading', 'Scene Heading'),
    rule('action', 'Action', { allowFormatOverride: false }),
    rule('dialogue', 'Dialogue'),
    rule('lyrics', 'Lyrics', { enabled: false }),
  ]);
  const editor = makeEditor([
    block('sceneHeading', 'INT. LAB - DAY'),
    block('lyrics', 'la la la'), // disabled → becomes dialogue
    block('action', 'run!', ['bold']), // locked mark → stripped
  ]);
  const conflicts = detectTemplateConflicts(editor, tpl);
  resolveTemplateConflicts(editor, tpl, conflicts);

  it('replaces disabled nodes and strips locked marks in one dispatch', () => {
    const doc = editor.state.doc;
    expect(doc.childCount).toBe(3);
    expect(doc.child(0).type.name).toBe('sceneHeading');
    expect(doc.child(1).type.name).toBe('dialogue');
    expect(doc.child(1).textContent).toBe('la la la');
    expect(doc.child(2).type.name).toBe('action');
    expect(doc.child(2).textContent).toBe('run!');
    expect(doc.child(2).firstChild!.marks).toHaveLength(0);
  });

  it('a second detect on the resolved doc finds nothing', () => {
    expect(detectTemplateConflicts(editor, tpl)).toEqual({
      disabledElements: [],
      formattingViolations: [],
      hasConflicts: false,
    });
  });

  it('does not dispatch at all when detect found no conflicts', () => {
    const clean = makeEditor([block('action', 'Beat.')]);
    const before = clean.state;
    resolveTemplateConflicts(clean, tpl, detectTemplateConflicts(clean, tpl));
    expect(clean.state).toBe(before); // tr.docChanged guard: no dispatch
  });
});

describe('resolveTemplateConflicts — custom-element replacement', () => {
  it('converts to a customElement carrying the rule id and label', () => {
    // lyrics' default replacement (dialogue) is absent, so the fallback is
    // the first enabled rule — a custom one — exercising the non-built-in
    // setNodeMarkup branch.
    const tpl = template('override', [
      rule('c-uuid-1', 'Widget', { isBuiltIn: false }),
      rule('lyrics', 'Lyrics', { enabled: false }),
    ]);
    const editor = makeEditor([block('lyrics', 'hum')]);
    const conflicts = detectTemplateConflicts(editor, tpl);
    expect(conflicts.disabledElements[0].replacementType).toBe('c-uuid-1');

    resolveTemplateConflicts(editor, tpl, conflicts);
    const node = editor.state.doc.child(0);
    expect(node.type.name).toBe('customElement');
    expect(node.attrs).toEqual({ customTypeId: 'c-uuid-1', customLabel: 'Widget' });
    expect(node.textContent).toBe('hum');
    expect(detectTemplateConflicts(editor, tpl).hasConflicts).toBe(false);
  });
});

describe('resolveTemplateConflicts — replacement into a locked type', () => {
  // KNOWN LIMITATION: detect skips the formatting scan on disabled elements,
  // and resolve only strips marks for 'reformat'/'both' ops — a plain
  // 'replace' keeps the node's inline marks. So replacing a disabled node
  // into a fully-locked type carries the conflicting marks along, and a
  // second detect finds a brand-new violation. detect → resolve is NOT
  // guaranteed to converge in one pass. Pinning actual behavior.
  const tpl = template('enforce', [
    rule('action', 'Action', { allowFormatOverride: false }),
    rule('lyrics', 'Lyrics', { enabled: false }),
  ]);

  it('keeps the old marks on the replaced node, so a second detect still conflicts', () => {
    const editor = makeEditor([block('lyrics', 'LOUD', ['bold'])]);
    const first = detectTemplateConflicts(editor, tpl);
    // dialogue (lyrics' default) is absent → falls back to action, the only
    // enabled rule. No violation reported: disabled nodes skip the mark scan.
    expect(first.disabledElements).toEqual([
      { elementType: 'lyrics', elementLabel: 'Lyrics', nodeCount: 1, replacementType: 'action' },
    ]);
    expect(first.formattingViolations).toEqual([]);

    resolveTemplateConflicts(editor, tpl, first);
    const node = editor.state.doc.child(0);
    expect(node.type.name).toBe('action');
    expect(node.firstChild!.marks.map((m) => m.type.name)).toEqual(['bold']); // survived

    const second = detectTemplateConflicts(editor, tpl);
    expect(second.hasConflicts).toBe(true);
    expect(second.formattingViolations).toEqual([
      {
        elementType: 'action',
        elementLabel: 'Action',
        conflictingMarks: ['Bold'],
        nodeCount: 1,
        shouldReformat: true,
      },
    ]);
  });

  it("a hand-built 'both' op does strip marks after replacing", () => {
    // resolve CAN do replace + reformat on the same node — but only if the
    // caller hand-crafts a violation entry for the disabled type; detect
    // never emits both for the same element type (see above).
    const editor = makeEditor([block('lyrics', 'LOUD', ['bold'])]);
    resolveTemplateConflicts(editor, tpl, {
      disabledElements: [
        { elementType: 'lyrics', elementLabel: 'Lyrics', nodeCount: 1, replacementType: 'action' },
      ],
      formattingViolations: [
        { elementType: 'lyrics', elementLabel: 'Lyrics', conflictingMarks: ['Bold'], nodeCount: 1, shouldReformat: true },
      ],
      hasConflicts: true,
    });
    const node = editor.state.doc.child(0);
    expect(node.type.name).toBe('action');
    expect(node.firstChild!.marks).toHaveLength(0);
    expect(detectTemplateConflicts(editor, tpl).hasConflicts).toBe(false);
  });
});
