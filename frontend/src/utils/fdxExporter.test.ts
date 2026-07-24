// @vitest-environment jsdom
/**
 * FDX export — regression guard for the working-notes leak (CLAUDE.md §4).
 * FDX/DOCX/PDF never had the filter the Fountain exporter did, so drafts sent as
 * .fdx carried the author's outline sections, markers and to-do lines. This pins
 * that they're gone while real script content stays.
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { exportFDX } from './fdxExporter';

const node = (type: string, t: string): JSONContent => ({ type, content: [{ type: 'text', text: t }] });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

describe('exportFDX — working notes never export', () => {
  it('omits outline sections, markers and to-do lines from the FDX XML', () => {
    const xml = exportFDX(doc(
      node('general', '# Act One'),
      node('general', '⚑ remember the reversal'),
      node('general', '[ ] fix Sarah motivation'),
      node('general', '[x] rename the diner'),
      node('sceneHeading', 'INT. DINER - DAY'),
      node('action', 'Sarah enters.'),
      node('general', 'An ordinary general note.'),
    ), 'Test');

    expect(xml).not.toContain('Act One');
    expect(xml).not.toContain('remember the reversal');
    expect(xml).not.toContain('fix Sarah motivation');
    expect(xml).not.toContain('rename the diner');

    // Real content and legitimate general text still export.
    expect(xml).toContain('INT. DINER - DAY');
    expect(xml).toContain('Sarah enters.');
    expect(xml).toContain('An ordinary general note.');
  });

  it('still produces a well-formed FDX envelope', () => {
    const xml = exportFDX(doc(node('action', 'Beat.')), 'Test');
    expect(xml).toContain('<FinalDraft');
    expect(xml).toContain('<Content>');
    expect(xml).toContain('Beat.');
  });
});

describe('exportFDX — cast list descriptions', () => {
  it('decodes HTML entities instead of exporting them literally (stripHtml consolidation)', () => {
    const profiles = [{
      name: 'SARAH',
      description: '<p>Sharp-eyed &mdash; wary &amp; quick.</p><p>Ex-analyst.</p>',
    }] as unknown as Parameters<typeof exportFDX>[2];
    const xml = exportFDX(doc(node('action', 'Beat.')), 'Test', profiles);
    // &mdash; decodes to the em dash; & re-escapes once as XML's &amp;;
    // block boundary becomes a space.
    expect(xml).toContain('<Description>Sharp-eyed — wary &amp; quick. Ex-analyst.</Description>');
    expect(xml).not.toContain('&mdash;');
  });
});
