// @vitest-environment jsdom
/**
 * v7.10, Derek — per-template PAGE SETUP, built-ins included.
 *
 * "'page setup' used to have a full page of fields for the various measurement
 * options… make equivalents for the other templates", and when asked whether
 * the built-ins should be editable too: "Built ins".
 *
 * THE TRAP these tests exist to nail down: the six system templates are
 * immutable constants, NOT rows in `templates[]`. `updateTemplate()` on one is
 * a silent no-op — the exact shape of the v0.63–v0.70 Show/Hide bug, where a
 * control looked like it worked and wrote into the void. So an override map
 * carries the writer's page setup, and the resolver layers app defaults → the template's own → the override.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useFormattingTemplateStore } from './formattingTemplateStore';
import { INDUSTRY_STANDARD_ID } from './formattingTypes';
import { DEFAULT_PAGE_LAYOUT } from './editorStore';
import { MULTICAM_SITCOM_ID } from './templates/multicamSitcomTemplate';

const store = () => useFormattingTemplateStore.getState();

beforeEach(() => {
  localStorage.clear();
  useFormattingTemplateStore.setState({ templatePageLayouts: {} });
});

describe('per-template page setup (v7.10)', () => {
  it('a template with no override resolves to the app defaults', () => {
    expect(store().getTemplatePageLayout(INDUSTRY_STANDARD_ID).pageWidth)
      .toBe(DEFAULT_PAGE_LAYOUT.pageWidth);
    expect(store().getTemplatePageLayout(INDUSTRY_STANDARD_ID).leftMargin)
      .toBe(DEFAULT_PAGE_LAYOUT.leftMargin);
  });

  it('a BUILT-IN takes an override — the whole point of the map', () => {
    const a4 = { ...DEFAULT_PAGE_LAYOUT, pageWidth: 8.27, pageHeight: 11.69 };
    store().setTemplatePageLayout(INDUSTRY_STANDARD_ID, a4);
    expect(store().getTemplatePageLayout(INDUSTRY_STANDARD_ID).pageWidth).toBe(8.27);
    expect(store().getTemplatePageLayout(INDUSTRY_STANDARD_ID).pageHeight).toBe(11.69);
  });

  it('overrides are per template — one does not leak into another', () => {
    store().setTemplatePageLayout(INDUSTRY_STANDARD_ID, { ...DEFAULT_PAGE_LAYOUT, pageWidth: 8.27 });
    expect(store().getTemplatePageLayout(MULTICAM_SITCOM_ID).pageWidth)
      .toBe(DEFAULT_PAGE_LAYOUT.pageWidth);
  });

  it('reset drops the override and the base comes back', () => {
    store().setTemplatePageLayout(INDUSTRY_STANDARD_ID, { ...DEFAULT_PAGE_LAYOUT, leftMargin: 2 });
    expect(store().getTemplatePageLayout(INDUSTRY_STANDARD_ID).leftMargin).toBe(2);
    store().resetTemplatePageLayout(INDUSTRY_STANDARD_ID);
    expect(store().getTemplatePageLayout(INDUSTRY_STANDARD_ID).leftMargin)
      .toBe(DEFAULT_PAGE_LAYOUT.leftMargin);
  });

  it('the base layout ignores the override — it is what Reset Default returns to', () => {
    store().setTemplatePageLayout(INDUSTRY_STANDARD_ID, { ...DEFAULT_PAGE_LAYOUT, leftMargin: 2 });
    expect(store().getTemplateBasePageLayout(INDUSTRY_STANDARD_ID).leftMargin)
      .toBe(DEFAULT_PAGE_LAYOUT.leftMargin);
  });

  it('an override survives a reload — it is written to storage, not just state', () => {
    store().setTemplatePageLayout(INDUSTRY_STANDARD_ID, { ...DEFAULT_PAGE_LAYOUT, pageWidth: 8.27 });
    const raw = localStorage.getItem('opendraft:templatePageLayouts');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)[INDUSTRY_STANDARD_ID].pageWidth).toBe(8.27);
  });

  it('a corrupt stored value does not take the store down', () => {
    localStorage.setItem('opendraft:templatePageLayouts', '{ not json');
    expect(() => store().getTemplatePageLayout(INDUSTRY_STANDARD_ID)).not.toThrow();
  });

  it('an unknown template id still resolves to a complete layout', () => {
    const l = store().getTemplatePageLayout('no-such-template');
    expect(l.pageWidth).toBe(DEFAULT_PAGE_LAYOUT.pageWidth);
    expect(l.bottomMargin).toBe(DEFAULT_PAGE_LAYOUT.bottomMargin);
  });
});
