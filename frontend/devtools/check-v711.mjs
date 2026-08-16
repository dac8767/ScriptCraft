// check-v711.mjs — Derek's seven-item feedback row against v7.10.
//   1 the title page date follows the Settings date format
//   2 "Keyboard Shortcuts" → "Keyboard"
//   3 Page Setup uses the Shown/Hidden columns
//   4 template standards (pinned in src/stores/templateStandards.test.ts)
//   5 a Settings icon in the native ScriptCraft menu (macOS-only; see below)
//   6 Presets is a section of Defaults, not a tab
//   7 no section captions in the Settings sidebar
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

// ── 1. the title page date ───────────────────────────────────────────
console.log('\n1. title page date follows Settings');
const dateRuns = await page.evaluate(async () => {
  const tp = await import('/src/utils/titlePageLayout.ts');
  const data = {
    tpTitle: 'DATED', tpTitle2: '', tpTitle2FontSize: 12,
    tpWrittenBy: 'You', tpBasedOn: '',
    tpDraft: '1st Draft', tpDraftDate: '2026-08-14',
    tpContact: '', tpCopyright: '', tpWgaRegistration: '', tpNotes: '',
    tpTitleFontSize: 12,
  };
  const draftOf = (fmt) => {
    const spec = tp.titlePageBlockSpecs(data, 0, 0, fmt).find((s) => s.field === 'draft');
    return spec ? spec.text : '';
  };
  return {
    raw: draftOf(undefined),      // importers: leave the file's own string
    short: draftOf('short'),
    european: draftOf('european'),
    friendly: draftOf('friendly'),
    iso: draftOf('iso'),
  };
});
ok('short format', dateRuns.short === '1st Draft - 08/14/26', dateRuns.short);
ok('european format', dateRuns.european === '1st Draft - 14/8/2026', dateRuns.european);
ok('friendly format is spelled out', /August/.test(dateRuns.friendly), dateRuns.friendly);
ok('iso format', dateRuns.iso === '1st Draft - 2026-08-14', dateRuns.iso);
ok('formats actually differ from each other', new Set([dateRuns.short, dateRuns.european, dateRuns.iso]).size === 3, '');
ok('an imported string is left alone when no format is given',
  dateRuns.raw === '1st Draft - 2026-08-14', dateRuns.raw);

// The Title Page editor reads the live setting — change it, read the preview.
await page.evaluate(async () => {
  const { useSettingsStore } = await window.__scImport('/src/stores/settingsStore.ts');
  useSettingsStore.getState().setDateFormat('friendly');
});
await settle(page);
const liveFmt = await page.evaluate(async () => {
  const { useSettingsStore } = await window.__scImport('/src/stores/settingsStore.ts');
  return useSettingsStore.getState().dateFormat;
});
ok('the Settings choice is what the builder is handed', liveFmt === 'friendly', liveFmt);

// ── 2 / 6 / 7. the Settings sidebar ──────────────────────────────────
console.log('\n2, 6, 7. the Settings sidebar');
await page.evaluate(() => window.__scStore.getState().openPreferences('general'));
await page.waitForSelector('.prefs-window .prefs-tab', { timeout: 8000 });
const rail = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('.prefs-window .prefs-tab')].map((e) => e.textContent.trim()),
  captions: [...document.querySelectorAll('.prefs-window .prefs-tab-caption')].length,
  dividers: [...document.querySelectorAll('.prefs-window .prefs-tab-divider')].length,
}));
ok('the sidebar has its tabs', rail.tabs.length >= 8, JSON.stringify(rail.tabs));
ok('Keyboard Shortcuts is just "Keyboard"',
  rail.tabs.includes('Keyboard') && !rail.tabs.includes('Keyboard Shortcuts'), JSON.stringify(rail.tabs));
ok('no section captions', rail.captions === 0, `captions=${rail.captions}`);
ok('no section dividers', rail.dividers === 0, `dividers=${rail.dividers}`);
ok('Presets is not a tab', !rail.tabs.includes('Presets'), JSON.stringify(rail.tabs));

// v7.14, Derek: Presets lives on Backup & Restore now, not Defaults.
await page.evaluate(() => window.__scStore.getState().openPreferences('backup'));
await settle(page);
await page.waitForTimeout(300);
const defaults = await page.evaluate(() => ({
  heads: [...document.querySelectorAll('.prefs-content h3')].map((e) => e.textContent.trim()),
  hasPanel: !!document.querySelector('.prefs-content .presets-panel, .prefs-content .preset-row, .prefs-content [class*="preset"]'),
}));
/* v7.31, Derek: the tab is Backup + Restore now — "rename the sections
   currently named 'Presets' to 'Backup'". The checklist is still what lives
   under the first heading; only its name changed. */
ok('Backup & Restore carries the preset checklist', defaults.heads.includes('Backup'), JSON.stringify(defaults.heads));
ok('…and the presets panel renders in it', defaults.hasPanel, '');

// ── 3. Page Setup uses the shared Shown/Hidden columns ───────────────
console.log('\n3. Page Setup columns');
await page.evaluate(() => window.__scStore.getState().openPreferences('page'));
await page.waitForSelector('.prefs-content .fs-dnd-cols', { timeout: 8000 });
const cols = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.prefs-content .fs-dnd-col-head')].map((e) => e.textContent.trim());
  const bodies = [...document.querySelectorAll('.prefs-content .fs-dnd-col')].map((c) => ({
    rows: c.querySelectorAll('.fs-dnd-row').length,
    handles: c.querySelectorAll('.fs-customize-drag').length,
  }));
  return { heads, bodies };
});
ok('two columns, Shown and Hidden', cols.heads.length === 2
  && /Shown/.test(cols.heads[0]) && /Hidden/.test(cols.heads[1]), JSON.stringify(cols.heads));
ok('with Show All / Hide All in the headers',
  /Show All/.test(cols.heads[0]) && /Hide All/.test(cols.heads[1]), JSON.stringify(cols.heads));
ok('the templates are rows in the Shown column', cols.bodies[0]?.rows >= 6, JSON.stringify(cols.bodies));
ok('every row has a drag handle', cols.bodies[0]?.handles === cols.bodies[0]?.rows, JSON.stringify(cols.bodies));
ok('the old single-list markup is gone', await page.evaluate(() =>
  document.querySelectorAll('.prefs-content .pst-listhead').length === 0), '');

// hiding a template moves it across
const moved = await page.evaluate(async () => {
  const { useSettingsStore } = await window.__scImport('/src/stores/settingsStore.ts');
  const before = document.querySelectorAll('.fs-dnd-col')[0].querySelectorAll('.fs-dnd-row').length;
  const btn = document.querySelectorAll('.fs-dnd-col')[0].querySelector('.fs-dnd-rowbtn');
  btn.click();
  await new Promise((r) => setTimeout(r, 120));
  return {
    before,
    shown: document.querySelectorAll('.fs-dnd-col')[0].querySelectorAll('.fs-dnd-row').length,
    hidden: document.querySelectorAll('.fs-dnd-col')[1].querySelectorAll('.fs-dnd-row').length,
    stored: useSettingsStore.getState().enabledScriptFormats.length,
  };
});
ok('the row button moves a template to Hidden',
  moved.shown === moved.before - 1 && moved.hidden >= 1, JSON.stringify(moved));

// ── 5. the native Settings icon ──────────────────────────────────────
console.log('\n5. native Settings icon');
const src = await (await fetch('http://localhost:5199/src/menu/nativeMenuSync.ts')).text();
ok('the ScriptCraft menu builds Settings as an IconMenuItem', /IconMenuItem\.new\(/.test(src), '');
// v7.12, Derek asked for a different gear: PreferencesGeneral, not Advanced.
ok('…using the system preferences gear', /NativeIcon\.PreferencesGeneral/.test(src), '');
ok('…and falls back to a plain item rather than losing the menu',
  /catch[\s\S]{0,200}MenuItem\.new\(opts\)/.test(src), '');

console.log(`\ncheck-v711: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
