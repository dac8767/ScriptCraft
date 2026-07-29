// @vitest-environment jsdom
/**
 * Save-payload + header/footer field composition (extracted from ScreenplayEditor).
 *
 * composeSaveContent is the single source of truth for the save "extras" list.
 * Its history: a partial FORK of this list in the collab-teardown path once
 * saved a script with the Outline beats/columns/tabs stripped out. These tests
 * lock in that every save path carries the full set — especially the outline /
 * beat data that the fork dropped — so a future edit can't silently narrow it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { resolveHFFields, composeSaveContent, stripSaveExtras } from './screenplaySaveContent';

const S = () => useEditorStore.getState();

describe('resolveHFFields', () => {
  it('returns empty string for empty text', () => {
    expect(resolveHFFields('', 3, 10, 'My Script', 'Blue')).toBe('');
  });

  it('replaces {page}, {pages}, {title} and {revision}, case-insensitively', () => {
    expect(resolveHFFields('{title} — {PAGE}/{Pages} ({revision})', 3, 10, 'NIGHTFALL', 'Blue'))
      .toBe('NIGHTFALL — 3/10 (Blue)');
  });

  it('substitutes {date} (leaving no literal token behind) and passes other text through', () => {
    const out = resolveHFFields('Draft as of {date}.', 1, 1, 'X', 'White');
    expect(out.startsWith('Draft as of ')).toBe(true);
    expect(out).not.toContain('{date}');
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('composeSaveContent', () => {
  beforeEach(() => {
    // Reset the fields this test drives to known sentinels.
    S().setBeats([]);
    S().setBeatColumns([]);
    useEditorStore.setState({
      notes: {}, generalNotes: [], shelfCards: [],
      tags: [], tagCategories: [],
      characterProfiles: [], characterRelationships: [], characterCustomFields: [],
      referredTags: {}, scanResults: null,
      outlineTabs: [{ id: 'tab-1', name: 'Outline 1', arrangeMode: 'auto' }],
      viewedOutlineTab: 'tab-1', outlineBarTab: 'tab-1', outlineStash: {},
    } as never);
  });

  it('spreads the doc through unchanged', () => {
    const doc = { type: 'doc', content: [{ type: 'action', content: [{ type: 'text', text: 'hi' }] }] };
    const out = composeSaveContent(doc);
    expect(out.type).toBe('doc');
    expect(out.content).toEqual(doc.content);
  });

  it('carries the FULL extras list — every documented underscore key is present', () => {
    const out = composeSaveContent({ type: 'doc', content: [] });
    for (const key of [
      '_notes', '_markups', '_generalNotes', '_shelf', '_tags', '_tagCategories',
      '_characterProfiles', '_characterRelationships', '_characterCustomFields',
      '_referredTags', '_characterScan',
      '_beats', '_beatColumns', '_beatArrangeMode',
      '_outlineTabs', '_outlineViewedTab', '_outlineBarTab', '_outlineStash',
      '_draftLabel', '_templateId',
      '_ignoredWords', '_ignoredOnce', '_customDictWords', '_enabledGlobalDicts',
      '_projectDictEnabled', '_enabledLanguages',
      '_ignoredGrammarRules', '_ignoredGrammarOnce',
      '_spellCheckEnabled', '_grammarCheckEnabled',
      '_sceneNumbersVisible', '_sceneNumbersLocked', '_pageLayout',
    ]) {
      expect(out).toHaveProperty(key);
    }
  });

  it('round-trips the Outline / beat data the old forked list used to drop', () => {
    const col = S().addBeatColumn('Act I');
    const beatId = S().addBeat('Opening image', col);
    useEditorStore.setState({
      outlineTabs: [
        { id: 'tab-1', name: 'Outline 1', arrangeMode: 'auto' },
        { id: 'tab-2', name: 'Alt', arrangeMode: 'custom' },
      ],
      outlineStash: { 'tab-2': { columns: [], beatSlots: {} } },
    } as never);

    const out = composeSaveContent({ type: 'doc', content: [] });

    expect((out._beatColumns as { id: string }[]).map((c) => c.id)).toContain(col);
    expect((out._beats as { id: string }[]).map((b) => b.id)).toContain(beatId);
    expect((out._outlineTabs as { id: string }[]).map((t) => t.id)).toEqual(['tab-1', 'tab-2']);
    expect(out._outlineStash).toHaveProperty('tab-2');
    expect(out._outlineViewedTab).toBe(S().viewedOutlineTab);
  });
});

describe('stripSaveExtras', () => {
  it('is the exact inverse of composeSaveContent: strips every extra, keeps the doc', () => {
    const doc = { type: 'doc', content: [{ type: 'action', content: [{ type: 'text', text: 'hi' }] }] };
    const stripped = stripSaveExtras(composeSaveContent(doc));
    expect(stripped).toEqual(doc);
  });

  it('drops any underscore key — including ones invented after this test was written', () => {
    const stripped = stripSaveExtras({ type: 'doc', content: [], _someFutureExtra: 1, _another: { a: 1 } });
    expect(stripped).toEqual({ type: 'doc', content: [] });
  });

  it('leaves non-underscore keys untouched', () => {
    const stripped = stripSaveExtras({ type: 'doc', attrs: { x: 1 }, content: [] });
    expect(stripped).toEqual({ type: 'doc', attrs: { x: 1 }, content: [] });
  });
});
