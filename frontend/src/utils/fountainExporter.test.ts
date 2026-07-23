/**
 * Fountain export — with a hard guard on the "working notes must never leave the
 * app" invariant (v1.4, CLAUDE.md §4). Outline sections (# ...), markers (⚑ ...)
 * and script to-do lines ([ ] ...) are the writer's scaffolding, not the script;
 * they were once written verbatim into exported files, so a draft mailed to a
 * collaborator carried the author's private to-do list. These tests fail if that
 * filtering ever regresses.
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { exportFountain } from './fountainExporter';

const text = (t: string, marks?: { type: string }[]): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const node = (type: string, t: string, attrs?: Record<string, unknown>): JSONContent =>
  ({ type, content: [text(t)], ...(attrs ? { attrs } : {}) });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

describe('exportFountain — working notes never export', () => {
  it('drops outline sections, markers and to-do lines carried as general text', () => {
    const out = exportFountain(doc(
      node('general', '# Act One'),          // outline section
      node('general', '## Sequence A'),      // deeper section
      node('general', '⚑ remember the reversal here'), // marker
      node('general', '[ ] fix Sarah motivation'),          // open to-do
      node('general', '[x] rename the diner'),               // done to-do
      node('action', 'Sarah enters.'),       // real content — must survive
    ));
    expect(out).not.toContain('Act One');
    expect(out).not.toContain('Sequence A');
    expect(out).not.toContain('remember the reversal');
    expect(out).not.toContain('fix Sarah motivation');
    expect(out).not.toContain('rename the diner');
    expect(out).toContain('Sarah enters.');
  });

  it('keeps ordinary general text that merely resembles nothing special', () => {
    const out = exportFountain(doc(node('general', 'A quiet beat before the door opens.')));
    expect(out).toContain('A quiet beat before the door opens.');
  });

  it('does not mistake a "#hashtag" mid-idea (no space) for a section', () => {
    // The section rule requires "# " — a bare #word is ordinary text and exports.
    const out = exportFountain(doc(node('general', '#nofilter energy')));
    expect(out).toContain('#nofilter energy');
  });
});

describe('exportFountain — core formatting', () => {
  it('formats the standard elements', () => {
    const out = exportFountain(doc(
      node('sceneHeading', 'int. diner - day'),
      node('action', 'Rain on the window.'),
      node('character', 'sarah'),
      node('parenthetical', 'quietly'),
      node('dialogue', 'We should go.'),
      node('transition', 'cut to:'),
      node('lyrics', 'la la la'),
    ));
    expect(out).toContain('INT. DINER - DAY');   // scene heading upper-cased
    expect(out).toContain('Rain on the window.');
    expect(out).toContain('SARAH');               // character upper-cased
    expect(out).toContain('(quietly)');           // parenthetical wrapped
    expect(out).toContain('We should go.');
    expect(out).toContain('> cut to:');           // transition prefix
    expect(out).toContain('~la la la');           // lyric prefix
  });

  it('applies bold / italic / underline marks', () => {
    const out = exportFountain(doc({
      type: 'action',
      content: [
        text('plain '),
        text('bold', [{ type: 'bold' }]),
        text(' '),
        text('em', [{ type: 'italic' }]),
        text(' '),
        text('under', [{ type: 'underline' }]),
      ],
    }));
    expect(out).toContain('plain **bold** *em* _under_');
  });

  it('emits title-page metadata from a titlePage node', () => {
    const out = exportFountain(doc(
      { type: 'titlePage', attrs: { field: 'title', tpTitle: 'NIGHTFALL', tpWrittenBy: 'S. Chen' } },
      node('action', 'FADE IN.'),
    ));
    expect(out).toContain('Title: NIGHTFALL');
    expect(out).toContain('Author: S. Chen');
  });

  it('skips images and returns empty string for an empty doc', () => {
    expect(exportFountain({ type: 'doc', content: [] })).toBe('');
    const out = exportFountain(doc({ type: 'screenplayImage', attrs: { src: 'x' } }, node('action', 'Beat.')));
    expect(out).not.toContain('x');
    expect(out).toContain('Beat.');
  });
});
