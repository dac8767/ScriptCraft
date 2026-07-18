// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { ribSetSectionTitle, ribRemoveSectionTitle } from '../components/ribbonDrag';
import { parseRibbon, serializeRibbon, type RibbonSection } from '../components/toolbarBuiltins';

const sec = (over: Partial<RibbonSection>): RibbonSection =>
  ({ top: [], bottom: [], hasBreak: false, breakLine: false, ...over });

/**
 * v3.49 — the Customize window's Save / Cancel rests on
 * captureCustomizations() / restoreCustomizations() round-tripping EVERY
 * persistent customization, so Cancel can put the layout back exactly. A
 * field left out of one but not the other is the classic two-lists-that-drift
 * bug — a Cancel that quietly keeps some edits.
 */
const store = () => useEditorStore.getState();

describe('captureCustomizations / restoreCustomizations', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolbarLeft: ['b:save'], toolbarRight: [],
      qatItems: ['save', 'undo', 'redo'],
      toolbarDdWidths: {},
      menuBarOrder: ['File', 'Edit'],
      chromeGapPx: { menu: 0, toolbar: 2, bigbtn: 0, scrapbook: 12 },
      outlineBarZoom: 0,
    });
  });

  it('restores every captured field after later edits', () => {
    const snap = store().captureCustomizations();

    // Change a spread of different customization surfaces.
    store().setToolbarZones(['b:save', 'b:undo', 'st:Scene'], []);
    store().setQatItems(['save']);
    store().setChromeGap('toolbar', 9);
    store().setOutlineBarZoom(40);

    // Sanity: the edits actually took.
    expect(store().toolbarLeft).toEqual(['b:save', 'b:undo', 'st:Scene']);
    expect(store().qatItems).toEqual(['save']);
    expect(store().chromeGapPx.toolbar).toBe(9);
    expect(store().outlineBarZoom).toBe(40);

    store().restoreCustomizations(snap);

    // Everything is back to the snapshot.
    expect(store().toolbarLeft).toEqual(['b:save']);
    expect(store().qatItems).toEqual(['save', 'undo', 'redo']);
    expect(store().chromeGapPx.toolbar).toBe(2);
    expect(store().outlineBarZoom).toBe(0);
  });

  it('the snapshot is a deep copy — later store edits do not mutate it', () => {
    const snap = store().captureCustomizations();
    store().setQatItems(['save', 'undo', 'redo', 'print']);
    // Snapshot still reflects the ORIGINAL, not the post-edit array.
    expect((snap.qatItems as string[])).toEqual(['save', 'undo', 'redo']);
  });
});

/**
 * v3.50 — every section carries a title field. Naming one sets it; clearing
 * the field drops the title so it neither serializes nor renders on the saved
 * bar (an empty title must not leave a stray `st:` token behind).
 */
describe('section titles — set, clear, and empty-does-not-persist', () => {
  const setBar = (sections: RibbonSection[]) =>
    useEditorStore.setState({ toolbarLeft: serializeRibbon({ sections, splitAt: null }), toolbarRight: [] });
  const titles = () => parseRibbon(store().toolbarLeft).sections.map((s) => s.title);

  it('naming a section stores the title', () => {
    setBar([sec({ top: ['b:save'] }), sec({ top: ['b:undo'] })]);
    ribSetSectionTitle(0, 'Format');
    expect(titles()).toEqual(['Format', undefined]);
  });

  it('clearing the title removes it entirely — no empty st: token survives', () => {
    setBar([sec({ top: ['b:save'], title: 'Format' })]);
    ribRemoveSectionTitle(0);
    expect(titles()).toEqual([undefined]);
    expect(store().toolbarLeft.some((t) => t.startsWith('st:'))).toBe(false);
  });
});
