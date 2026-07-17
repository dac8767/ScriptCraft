// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { ribMoveTitle } from '../components/ribbonDrag';
import { parseRibbon, serializeRibbon, type RibbonSection } from '../components/toolbarBuiltins';

/**
 * v3.49 — the Customize window's Save / Cancel rests on two things:
 *   1. captureCustomizations() / restoreCustomizations() round-trip EVERY
 *      persistent customization, so Cancel can put the layout back exactly.
 *      A field left out of one but not the other is the classic two-lists-
 *      that-drift bug — a Cancel that quietly keeps some edits.
 *   2. dragging a ribbon section title moves it onto another section.
 */
const store = () => useEditorStore.getState();

const sec = (over: Partial<RibbonSection>): RibbonSection =>
  ({ top: [], bottom: [], hasBreak: false, breakLine: false, ...over });

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

describe('ribMoveTitle — drag a section title onto another section', () => {
  const setBar = (sections: RibbonSection[], splitAt: number | null = null) =>
    useEditorStore.setState({ toolbarLeft: serializeRibbon({ sections, splitAt }), toolbarRight: [] });
  const titles = () => parseRibbon(store().toolbarLeft).sections.map((s) => s.title);

  it('moves the title off its source section onto the target', () => {
    setBar([sec({ top: ['b:save'], title: 'One' }), sec({ top: ['b:undo'] })]);
    ribMoveTitle(0, 1);
    expect(titles()).toEqual([undefined, 'One']);
  });

  it('swaps when the target already has a title', () => {
    setBar([sec({ top: ['b:save'], title: 'A' }), sec({ top: ['b:undo'], title: 'B' })]);
    ribMoveTitle(0, 1);
    expect(titles()).toEqual(['B', 'A']);
  });

  it('dropping a title on its own section is a no-op', () => {
    setBar([sec({ top: ['b:save'], title: 'Keep' })]);
    ribMoveTitle(0, 0);
    expect(titles()).toEqual(['Keep']);
  });
});
