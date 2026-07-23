/**
 * The single working-note predicate every exporter routes through. If this drifts,
 * the writer's outline sections / markers / to-do lines leak into exported drafts
 * (CLAUDE.md §4) — so the detection is pinned here, once.
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { isWorkingNoteText, isWorkingNoteNode } from './workingNotes';

const general = (t: string): JSONContent => ({ type: 'general', content: [{ type: 'text', text: t }] });

describe('isWorkingNoteText', () => {
  it('flags outline sections, markers and to-do lines', () => {
    for (const t of ['# Act One', '## Sequence B', '### deep', '⚑ reversal here', '[ ] fix this', '[x] done']) {
      expect(isWorkingNoteText(t), `should flag "${t}"`).toBe(true);
    }
  });

  it('tolerates leading/trailing whitespace', () => {
    expect(isWorkingNoteText('   # Act One  ')).toBe(true);
    expect(isWorkingNoteText('\t[ ] task')).toBe(true);
  });

  it('does NOT flag ordinary script text', () => {
    for (const t of ['Sarah enters.', '#nofilter energy', 'A [bracketed] aside', 'She said "cut".', '']) {
      expect(isWorkingNoteText(t), `should NOT flag "${t}"`).toBe(false);
    }
  });
});

describe('isWorkingNoteNode', () => {
  it('flags only general nodes whose text is a working note', () => {
    expect(isWorkingNoteNode(general('# Act One'))).toBe(true);
    expect(isWorkingNoteNode(general('⚑ beat'))).toBe(true);
    expect(isWorkingNoteNode(general('Ordinary general line'))).toBe(false);
  });

  it('never flags real script elements even if their text starts like a note', () => {
    // A scene heading / action node is never a working note, whatever its text.
    expect(isWorkingNoteNode({ type: 'action', content: [{ type: 'text', text: '# not a section here' }] })).toBe(false);
    expect(isWorkingNoteNode({ type: 'sceneHeading', content: [{ type: 'text', text: '[ ] not a todo' }] })).toBe(false);
  });

  it('handles empty / contentless nodes safely', () => {
    expect(isWorkingNoteNode({ type: 'general' })).toBe(false);
    expect(isWorkingNoteNode({ type: 'general', content: [] })).toBe(false);
  });
});
