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
  buildPresetBundle, readPresetFile, applyPresetFile, PRESET_PARTS,
  type PresetBundle, type PresetPartId,
} from './presets';
import { useEditorStore } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { useThemeStore } from '../stores/themeStore';
import { useOutlinePresetStore } from '../stores/outlinePresetStore';

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

/* ── v6.63, Derek: ONE preset file, built from a checklist ────────────────
   "I want one single preset file that can include all the information for
   each item on the current preset list… If you check an item, preset
   information for that item will be included in the single preset file."
   Two things must hold or the feature lies: only the CHECKED parts go in,
   and every file the app has ever written still opens. */
describe('preset bundle (v6.63)', () => {
  beforeEach(() => {
    useThemeStore.setState({ customThemes: [] });
    useOutlinePresetStore.setState({ presets: [] });
    useEditorStore.setState({ workspaces: {}, workspaceOrder: [] });
  });

  const parse = (json: string) => JSON.parse(json) as PresetBundle;

  it('includes exactly the ticked items — and nothing else', () => {
    const doc = parse(buildPresetBundle(['themes', 'settings'], '2026-08-09T00:00:00.000Z'));
    expect(doc.kind).toBe('preset-bundle');
    expect(doc.includes).toEqual(['settings', 'themes']);       // registry order
    expect(Object.keys(doc.parts).sort()).toEqual(['settings', 'themes']);
    expect(doc.parts.customize).toBeUndefined();
    expect(doc.parts.workspaces).toBeUndefined();
    expect(doc.parts.outline).toBeUndefined();
  });

  it('an empty checklist writes a file with no parts, not a broken one', () => {
    const doc = parse(buildPresetBundle([], '2026-08-09T00:00:00.000Z'));
    expect(doc.includes).toEqual([]);
    expect(doc.parts).toEqual({});
    expect(() => readPresetFile(JSON.stringify(doc))).toThrow(/empty/);
  });

  it('every item on the list can be included, and reads back', () => {
    useThemeStore.getState().saveCustomTheme({ id: 'mine', label: 'Mine', colors: {} } as never);
    useEditorStore.setState({ workspaces: { Writing: { tools: {} } as never }, workspaceOrder: ['Writing'] });
    useOutlinePresetStore.setState({ presets: [{ id: 'p1', name: 'Mine', columns: ['A'], pages: [10] }] as never });
    const ids: PresetPartId[] = PRESET_PARTS.map((p) => p.id);
    const json = buildPresetBundle(ids, '2026-08-09T00:00:00.000Z');
    expect(readPresetFile(json).ids).toEqual(ids);
    const doc = parse(json);
    expect(Array.isArray(doc.parts.themes) && (doc.parts.themes as unknown[]).length).toBe(1);
    expect((doc.parts.workspaces as { workspaceOrder: string[] }).workspaceOrder).toEqual(['Writing']);
  });

  it('a bundle round-trips its parts back into the app', () => {
    useThemeStore.getState().saveCustomTheme({ id: 'roundtrip', label: 'Round Trip', colors: {} } as never);
    useEditorStore.setState({ workspaces: { Deck: { tools: {} } as never }, workspaceOrder: ['Deck'] });
    const json = buildPresetBundle(['themes', 'workspaces'], '2026-08-09T00:00:00.000Z');

    useThemeStore.setState({ customThemes: [] });
    useEditorStore.setState({ workspaces: {}, workspaceOrder: [] });
    const { applied, failed } = applyPresetFile(json);
    expect(failed).toEqual([]);
    expect(applied).toEqual(['1 theme', '1 workspace']);
    expect(useThemeStore.getState().customThemes.map((t) => t.id)).toEqual(['roundtrip']);
    expect(Object.keys(useEditorStore.getState().workspaces)).toEqual(['Deck']);
  });

  it('`only` applies just the parts asked for', () => {
    useThemeStore.getState().saveCustomTheme({ id: 'a', label: 'A', colors: {} } as never);
    useEditorStore.setState({ workspaces: { W: { tools: {} } as never }, workspaceOrder: ['W'] });
    const json = buildPresetBundle(['themes', 'workspaces'], '2026-08-09T00:00:00.000Z');
    useThemeStore.setState({ customThemes: [] });
    useEditorStore.setState({ workspaces: {}, workspaceOrder: [] });
    applyPresetFile(json, ['themes']);
    expect(useThemeStore.getState().customThemes).toHaveLength(1);
    expect(Object.keys(useEditorStore.getState().workspaces)).toHaveLength(0);
  });

  /* A preset the app wrote must never stop opening. Every single-type file
     from before v6.63 reads as the one part it holds. */
  it('still opens every older single-type preset file', () => {
    expect(readPresetFile(buildFullPreset('2026-01-01T00:00:00.000Z')).ids).toEqual(['settings']);
    expect(readPresetFile(JSON.stringify({ kind: 'settings-backup', data: { 'opendraft:x': '1' } })).ids).toEqual(['settings']);
    expect(readPresetFile(buildCustomizeExport('2026-01-01T00:00:00.000Z')).ids).toEqual(['customize']);
    expect(readPresetFile(JSON.stringify({ kind: 'scriptcraft-themes', version: 1, themes: [{ id: 'a', label: 'A' }] })).ids).toEqual(['themes']);
    expect(readPresetFile(JSON.stringify({ kind: 'workspaces-export', workspaces: { A: {} }, workspaceOrder: ['A'] })).ids).toEqual(['workspaces']);
    expect(readPresetFile(JSON.stringify([{ name: 'P', columns: ['A'], pages: [1] }])).ids).toEqual(['outline']);
  });

  it('refuses a file that is not ours instead of half-applying it', () => {
    expect(() => readPresetFile('nope')).toThrow(/valid JSON/);
    expect(() => readPresetFile(JSON.stringify({ hello: 'world' }))).toThrow(/not a ScriptCraft preset/);
  });

  /* One part failing must not take the rest of the file down with it. */
  it('reports a part that cannot be applied and still applies the others', () => {
    useThemeStore.getState().saveCustomTheme({ id: 'ok', label: 'OK', colors: {} } as never);
    const json = buildPresetBundle(['themes'], '2026-08-09T00:00:00.000Z');
    const doc = parse(json);
    doc.includes = ['themes', 'outline'];
    doc.parts.outline = 'not an array';                    // a corrupt part
    useThemeStore.setState({ customThemes: [] });
    const res = applyPresetFile(JSON.stringify(doc));
    expect(res.applied).toEqual(['1 theme']);
    expect(res.failed).toEqual(['Outline Presets']);
    expect(useThemeStore.getState().customThemes).toHaveLength(1);
  });
});
