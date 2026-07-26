// @vitest-environment jsdom
/**
 * v4.79, Derek: presets. Three contracts worth pinning, because each one
 * fails silently if it drifts:
 *   1. Filenames carry their TYPE (his rule) — typedExportName is the only
 *      builder, so every caller inherits it.
 *   2. A customization export ROUND-TRIPS: export → change everything →
 *      import → back to the exported state. A field missing from the export
 *      (or from CUSTOMIZATION_FIELDS) reads as "import did nothing" for that
 *      setting, which is exactly the silent no-op this repo keeps re-learning.
 *   3. Import REFUSES a file that isn't ours, rather than half-applying it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  typedExportName, stampedBase,
  buildCustomizeExport, applyCustomizeExport, parseCustomizeExport,
  buildFullPreset, applyFullPreset,
  applySettingsFromScriptFile,
} from './presets';
import { useEditorStore } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';

const ed = () => useEditorStore.getState();

describe('typedExportName', () => {
  it('puts the type at the END of the filename, before .json', () => {
    expect(typedExportName('scriptcraft-2026-07-26', 'customize')).toBe('scriptcraft-2026-07-26_customize.json');
    expect(typedExportName('My Theme', 'theme')).toBe('My Theme_theme.json');
    expect(typedExportName(stampedBase('2026-07-26T12:00:00.000Z'), 'preset')).toBe('scriptcraft-2026-07-26_preset.json');
  });
});

describe('customize export round-trip', () => {
  beforeEach(() => {
    useEditorStore.setState({
      toolbarLeft: ['b:save'],
      qatItems: ['save', 'undo'],
      contextMenuHidden: [],
      panelNameCase: 'title',
      suggestionMode: 'smart',
    });
    useFormattingTemplateStore.setState({ elementHidden: [] });
  });

  it('restores chrome, context menu, panel case and element visibility', () => {
    // A distinctive "before" state…
    useEditorStore.setState({
      toolbarLeft: ['b:bold', 'b:italic'],
      qatItems: ['save'],
      contextMenuHidden: ['cut'],
      panelNameCase: 'upper',
      suggestionMode: 'all',
    });
    useFormattingTemplateStore.getState().setElementHidden(['shot']);
    const json = buildCustomizeExport('2026-07-26T00:00:00.000Z');

    // …clobber every one of them…
    useEditorStore.setState({
      toolbarLeft: ['b:undo'],
      qatItems: [],
      contextMenuHidden: [],
      panelNameCase: 'title',
      suggestionMode: 'smart',
    });
    useFormattingTemplateStore.getState().setElementHidden([]);

    // …and the import must put ALL of it back.
    applyCustomizeExport(json);
    expect(ed().toolbarLeft).toEqual(['b:bold', 'b:italic']);
    expect(ed().qatItems).toEqual(['save']);
    expect(ed().contextMenuHidden).toEqual(['cut']);
    expect(ed().panelNameCase).toBe('upper');
    expect(ed().suggestionMode).toBe('all');
    expect(useFormattingTemplateStore.getState().elementHidden).toEqual(['shot']);
  });

  it('carries Mores & Continueds', () => {
    const cur = ed();
    cur.setPageLayout({ ...cur.pageLayout, moresContds: { characterContd: false, dialogueBreakContd: false, contdText: '(CONT)', moreText: '(MORE!)' } });
    const json = buildCustomizeExport('2026-07-26T00:00:00.000Z');
    const after = ed();
    after.setPageLayout({ ...after.pageLayout, moresContds: { characterContd: true, dialogueBreakContd: true, contdText: "(CONT'D)", moreText: '(MORE)' } });
    applyCustomizeExport(json);
    expect(ed().pageLayout.moresContds).toMatchObject({ contdText: '(CONT)', moreText: '(MORE!)', characterContd: false });
  });

  it('refuses a file that is not a customization export', () => {
    expect(() => parseCustomizeExport('not json')).toThrow(/valid JSON/);
    expect(() => parseCustomizeExport(JSON.stringify({ kind: 'settings-backup', data: {} }))).toThrow(/customization export/);
  });
});

describe('full preset', () => {
  it('collects opendraft:* settings and refuses a foreign file', () => {
    localStorage.setItem('opendraft:presetProbe', 'yes');
    const json = buildFullPreset('2026-07-26T00:00:00.000Z');
    expect(JSON.parse(json).settings['opendraft:presetProbe']).toBe('yes');

    localStorage.removeItem('opendraft:presetProbe');
    const { imported } = applyFullPreset(json);
    expect(imported).toBeGreaterThan(0);
    expect(localStorage.getItem('opendraft:presetProbe')).toBe('yes');

    expect(() => applyFullPreset(JSON.stringify({ kind: 'customize-export' }))).toThrow(/full preset/);
  });

  it('never carries credentials (settings backup exclusions apply)', () => {
    localStorage.setItem('opendraft:collabAuth', 'secret-token');
    const doc = JSON.parse(buildFullPreset('2026-07-26T00:00:00.000Z'));
    expect(doc.settings['opendraft:collabAuth']).toBeUndefined();
    localStorage.removeItem('opendraft:collabAuth');
  });
});

// v4.83, Derek: "they can import a customize file OR choose an existing
// scriptcraft file, and copy the customization settings from that file."
// A .odraft carries LESS than a preset — themes, page layout (with Mores &
// Continueds) and the format — so the reader reports what it actually applied
// instead of quietly doing nothing for the rest.
describe('customize from an existing script (.odraft)', () => {
  const odraft = (over: Record<string, unknown> = {}) => JSON.stringify({
    odraft_version: 1,
    format: 'opendraft-script',
    meta: { title: 'T', author: '', color: '', page_count: 1 },
    content: {},
    ...over,
  });

  it('copies themes, page layout and the format, and says which', () => {
    const json = odraft({
      themes: [{ id: 'custom-x', label: 'My Look', vars: { '--fd-bg': '#123456' } }],
      content: {
        _pageLayout: { rightMargin: 1.25, moresContds: { characterContd: false, dialogueBreakContd: false, contdText: '(C)', moreText: '(M)' } },
        _templateId: '__stage_play__',
      },
    });
    const r = applySettingsFromScriptFile(json);
    expect(r).toEqual({ themes: 1, pageLayout: true, moresContds: true, templateId: '__stage_play__' });
    expect(useEditorStore.getState().pageLayout.rightMargin).toBe(1.25);
    expect(useEditorStore.getState().pageLayout.moresContds?.contdText).toBe('(C)');
  });

  it('a script with nothing to copy reports nothing rather than throwing', () => {
    expect(applySettingsFromScriptFile(odraft())).toEqual({
      themes: 0, pageLayout: false, moresContds: false, templateId: null,
    });
  });

  it('refuses a file that is not a ScriptCraft script', () => {
    expect(() => applySettingsFromScriptFile('nope')).toThrow(/valid JSON/);
    expect(() => applySettingsFromScriptFile(JSON.stringify({ kind: 'customize-export' }))).toThrow(/not a ScriptCraft script/);
  });
});
