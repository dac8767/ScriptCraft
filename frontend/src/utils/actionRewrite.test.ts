// @vitest-environment jsdom
/**
 * v5.54: the Action Rewrite editor layer — the ProseMirror projection, the
 * range/ context resolution ported from Derek's design handoff (clamping,
 * scene-boundary stops, location-established, first appearances), and the
 * stale-guarded apply. Runs against a REAL TipTap editor built from the
 * app's own screenplay extensions, the Dialogue.test.ts harness pattern.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { TextSelection } from '@tiptap/pm/state';
import { SceneHeading } from '../editor/extensions/SceneHeading';
import { Action } from '../editor/extensions/Action';
import { Character } from '../editor/extensions/Character';
import { Dialogue } from '../editor/extensions/Dialogue';
import { Parenthetical } from '../editor/extensions/Parenthetical';
import { Transition } from '../editor/extensions/Transition';
import { DualDialogue, DualDialogueColumn } from '../editor/extensions/DualDialogue';
import {
  projectScript, resolveEditorSelection, resolveSelection,
  targetIsCurrent, applyVariantToEditor, buildVariantNodes, indexForPos,
  type ScriptElement,
} from './actionRewrite';

let editor: Editor | null = null;
let host: HTMLElement | null = null;

type Block = { type: string; text?: string };
const block = (type: string, text?: string) => ({
  type,
  content: text ? [{ type: 'text', text }] : [],
});

function makeEditor(blocks: Block[]) {
  host = document.createElement('div');
  document.body.appendChild(host);
  editor = new Editor({
    element: host,
    extensions: [
      Document, Text, SceneHeading, Action, Character, Dialogue,
      Parenthetical, Transition, DualDialogue, DualDialogueColumn,
    ],
    content: { type: 'doc', content: blocks.map((b) => block(b.type, b.text)) },
  });
  return editor;
}

/** Puts the caret inside the text of the given top-level block. */
function caretIn(ed: Editor, blockIndex: number) {
  let pos = 0;
  ed.state.doc.forEach((_node, offset, i) => {
    if (i === blockIndex) pos = offset + 1;
  });
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, pos + 1)));
}

/** Selects from inside block a to inside block b. */
function selectBlocks(ed: Editor, a: number, b: number) {
  let from = 0, to = 0;
  ed.state.doc.forEach((node, offset, i) => {
    if (i === a) from = offset + 1;
    if (i === b) to = offset + node.nodeSize - 1;
  });
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, from, to)));
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  host?.remove();
  host = null;
});

const SCRIPT: Block[] = [
  { type: 'sceneHeading', text: 'INT. PRISON CELL - NIGHT' },        // 0
  { type: 'action', text: 'Dark. Wet. KANE sits against the wall.' }, // 1
  { type: 'character', text: 'KANE' },                               // 2
  { type: 'dialogue', text: 'We attack at dawn.' },                  // 3
  { type: 'action', text: 'He stands.' },                            // 4
  { type: 'action', text: 'He crosses to the bars.' },               // 5
  { type: 'sceneHeading', text: 'EXT. COURTYARD - DAY' },            // 6
  { type: 'action', text: 'Guards drill in formation.' },            // 7
  { type: 'sceneHeading', text: 'INT. PRISON CELL - DAY' },          // 8
  { type: 'action', text: 'The same cell. GRIFFIN waits by the door.' }, // 9
];

describe('projectScript', () => {
  it('flattens top-level blocks with mapped types and true PM spans', () => {
    const ed = makeEditor(SCRIPT);
    const els = projectScript(ed.state.doc);
    expect(els.map((e) => e.type)).toEqual([
      'scene_heading', 'action', 'character', 'dialogue', 'action', 'action',
      'scene_heading', 'action', 'scene_heading', 'action',
    ]);
    for (const el of els) {
      expect(ed.state.doc.textBetween(el.from, el.to, '\n\n')).toBe(el.text);
    }
  });

  it('projects the character/dialogue inside a dualDialogue block', () => {
    const ed = makeEditor([{ type: 'action', text: 'They speak at once.' }]);
    ed.commands.insertContentAt(ed.state.doc.content.size, {
      type: 'dualDialogue',
      content: [
        {
          type: 'dualDialogueColumn',
          content: [block('character', 'ANNA'), block('dialogue', 'Now!')],
        },
        {
          type: 'dualDialogueColumn',
          content: [block('character', 'BEN'), block('dialogue', 'Wait!')],
        },
      ],
    });
    const els = projectScript(ed.state.doc);
    expect(els.map((e) => [e.type, e.text])).toEqual([
      ['action', 'They speak at once.'],
      ['character', 'ANNA'], ['dialogue', 'Now!'],
      ['character', 'BEN'], ['dialogue', 'Wait!'],
    ]);
  });
});

describe('resolveEditorSelection', () => {
  it('a caret inside one action paragraph targets that whole paragraph', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 4);
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    expect(r.paragraphs).toBe(1);
    expect(r.adjusted).toBe(false);
    expect(r.request.selection).toBe('He stands.');
    expect(ed.state.doc.textBetween(r.pmTarget.from, r.pmTarget.to, '\n\n')).toBe('He stands.');
  });

  it('a selection running into dialogue clamps to the action run and says so', () => {
    const ed = makeEditor(SCRIPT);
    selectBlocks(ed, 2, 5);   // character + dialogue + two actions
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    expect(r.paragraphs).toBe(2);
    expect(r.adjusted).toBe(true);
    expect(r.request.selection).toBe('He stands.\n\nHe crosses to the bars.');
  });

  it('dialogue-only selections are refused with the craft reason', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 3);
    const r = resolveEditorSelection(ed);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/doesn't rewrite dialogue/);
  });

  it('gathers scene heading, characters, and the preceding dialogue beat', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 4);
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    expect(r.request.sceneHeading).toBe('INT. PRISON CELL - NIGHT');
    expect(r.request.characters).toEqual(['KANE']);
    expect(r.request.precedingDialogue).toBe('KANE: We attack at dawn.');
    expect(r.request.preceding).toEqual(['Dark. Wet. KANE sits against the wall.']);
    expect(r.request.following).toEqual(['He crosses to the bars.']);
  });

  it('context stops at the scene boundary', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 7);
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    expect(r.request.preceding).toEqual([]);      // POSITION: opens the scene
    expect(r.request.following).toEqual([]);      // next scene is noise
    expect(r.request.sceneHeading).toBe('EXT. COURTYARD - DAY');
  });

  it('flags a previously established location and first appearances', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 9);
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    expect(r.request.locationEstablished).toBe(true);   // INT. PRISON CELL again
    // GRIFFIN has no earlier mention; KANE (cast) appeared at element 1.
    const ed2 = makeEditor([...SCRIPT, { type: 'character', text: 'GRIFFIN' }]);
    caretIn(ed2, 9);
    const r2 = resolveEditorSelection(ed2);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.request.firstAppearances).toEqual(['GRIFFIN']);
  });
});

describe('apply + the stale guard', () => {
  it('replaces the target with the variant paragraphs and retargets onto them', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 4);
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    const next = applyVariantToEditor(ed, { ...r.pmTarget }, 'He rises.\n\nBars. He grips them.');
    expect(next).not.toBeNull();
    const els = projectScript(ed.state.doc);
    expect(els[4]).toMatchObject({ type: 'action', text: 'He rises.' });
    expect(els[5]).toMatchObject({ type: 'action', text: 'Bars. He grips them.' });
    expect(els[6]).toMatchObject({ type: 'action', text: 'He crosses to the bars.' });
    // the retarget covers exactly the inserted text — a second variant can
    // replace the first
    expect(ed.state.doc.textBetween(next!.from, next!.to, '\n\n'))
      .toBe('He rises.\n\nBars. He grips them.');
    const swapped = applyVariantToEditor(ed, { ...next! }, 'He rises fast.');
    expect(swapped).not.toBeNull();
    expect(projectScript(ed.state.doc)[4].text).toBe('He rises fast.');
  });

  it('refuses to write into a range the doc has moved under', () => {
    const ed = makeEditor(SCRIPT);
    caretIn(ed, 4);
    const r = resolveEditorSelection(ed);
    if (!r.ok) throw new Error(r.reason);
    const target = { ...r.pmTarget };
    // an edit above the target shifts everything — unmapped positions go stale
    ed.commands.insertContentAt(1, 'X');
    expect(targetIsCurrent(ed.state.doc, target)).toBe(false);
    expect(applyVariantToEditor(ed, target, 'Anything.')).toBeNull();
  });
});

describe('pure pieces', () => {
  it('buildVariantNodes splits on blank lines and drops empties', () => {
    expect(buildVariantNodes('One.\n\n\n  \nTwo.')).toEqual([
      { type: 'action', content: [{ type: 'text', text: 'One.' }] },
      { type: 'action', content: [{ type: 'text', text: 'Two.' }] },
    ]);
    expect(buildVariantNodes('   ')).toEqual([]);
  });

  it('indexForPos finds the containing element (and clamps past the end)', () => {
    const els: ScriptElement[] = [
      { type: 'action', text: 'a', from: 0, to: 5 },
      { type: 'action', text: 'b', from: 5, to: 11 },
    ];
    expect(indexForPos(els, 2)).toBe(0);
    expect(indexForPos(els, 5)).toBe(1);
    expect(indexForPos(els, 99)).toBe(1);
  });

  it('resolveSelection over a hand-built projection matches the handoff contract', () => {
    const els: ScriptElement[] = [
      { type: 'scene_heading', text: 'INT. ROOM - DAY', from: 0, to: 2 },
      { type: 'action', text: 'One.', from: 2, to: 8 },
      { type: 'action', text: 'Two.', from: 8, to: 14 },
      { type: 'transition', text: 'CUT TO:', from: 14, to: 20 },
    ];
    const r = resolveSelection(els, { anchorIndex: 1, focusIndex: 3 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.target).toEqual({ start: 1, end: 2 });
    expect(r.adjusted).toBe(true);
    const none = resolveSelection(els, { anchorIndex: 3, focusIndex: 3 });
    expect(none.ok).toBe(false);
  });
});
