/* check-v728 — queue #6, the ONE PRESET EXPORT WINDOW, part (c).
 *
 * Derek, 2026-07-31: "anywhere in the app, if you click export theme preset,
 * export settings preset, export workspace… whatever you choose, they all
 * lead to the same preset export window."
 *
 * Parts (a) the checklist and (b) workspaces-as-a-category shipped in v6.63.
 * What was left was the doors: four of them still ran their own single-
 * category flow. The assertion that matters is NEGATIVE — that none of them
 * writes a file on its own any more. "The window opens" would pass on a door
 * that opened the window AND exported behind it.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const { browser, page } = await launch();
await boot(page);
await settle(page);

console.log('\n1. every door opens the window, and none exports on its own');
const DOORS = [
  ['components/CustomizePanelsDialog.tsx', 'customize', 'the Customize footer'],
  ['components/PreferencesDialog.tsx', 'settings', 'Settings ▸ Backup & Restore'],
  ['components/ThemesTab.tsx', 'themes', 'Export All Themes'],
  ['components/BeatBoard.tsx', 'outline', 'the outline presets menu'],
];
for (const [file, part, label] of DOORS) {
  const s = src(file);
  ok(`${label} opens the one window, pre-ticking ${part}`,
    new RegExp(`openPresetExport\\(\\['${part}'\\]\\)`).test(s), file);
}
/* The negative. A door that still called saveFile/downloadBackup would look
   identical from outside — the window opens either way. */
ok('the Customize footer no longer runs its own export flow',
  !/exportCustomizationsFlow\(\)/.test(src('components/CustomizePanelsDialog.tsx')), '');
ok('Settings no longer writes its own backup file',
  !/downloadBackup\(/.test(src('components/PreferencesDialog.tsx')), '');
ok('…and downloadBackup is gone rather than left lying around',
  !/export function downloadBackup/.test(src('utils/settingsBackup.ts')), '');
ok('the outline menu no longer saves its own file',
  !/__export'[\s\S]{0,300}saveFile\(/.test(src('components/BeatBoard.tsx')), '');

/* applyBackup STAYS — a file exported before v7.28 must still import. */
ok('…but applyBackup stays, so pre-v7.28 backup files still load',
  /export function applyBackup/.test(src('utils/settingsBackup.ts')), '');

console.log('\n2. the window is ONE window, reachable from anywhere');
const menu = src('components/MenuBar.tsx');
ok('its open state is the store\'s bus, not a local flag',
  !/\[presetsOpen, setPresetsOpen\]/.test(menu) && /presetExportRequest\.open/.test(menu),
  'a door in another component cannot reach a useState in MenuBar');
/* 'settings' and 'customize', not 'themes' — a category the app has NONE of
   is filtered out of the ticks (you cannot export nothing), so a fresh
   profile would have shown an empty checklist and passed a test of nothing. */
const opened = await page.evaluate(async () => {
  window.__scStore.getState().openPresetExport(['settings']);
  await new Promise((r) => setTimeout(r, 450));
  const box = document.querySelector('.fs-presets-dialog');
  const rows = [...document.querySelectorAll('.fs-presets-row')];
  return {
    up: !!box,
    ticked: rows.filter((r) => r.querySelector('input')?.checked)
      .map((r) => r.textContent.trim().split('\n')[0]),
    rowCount: rows.length,
  };
});
ok('a door\'s request really opens it', opened.up === true, JSON.stringify(opened));
ok('…with only that door\'s category ticked', opened.ticked.length === 1, JSON.stringify(opened.ticked));
ok('…and every other category is right there to add', opened.rowCount > 1, String(opened.rowCount));

/* A second door must RE-SEED the checklist. Without the key on the panel,
   useState keeps the first door's ticks and the second door silently exports
   the wrong thing. */
const second = await page.evaluate(async () => {
  window.__scStore.getState().closePresetExport();
  await new Promise((r) => setTimeout(r, 200));
  window.__scStore.getState().openPresetExport(['customize']);
  await new Promise((r) => setTimeout(r, 450));
  return [...document.querySelectorAll('.fs-presets-row')]
    .filter((r) => r.querySelector('input')?.checked)
    .map((r) => r.textContent.trim().split('\n')[0]);
});
ok('a SECOND door re-seeds the ticks rather than keeping the first door\'s',
  second.length === 1 && second[0] !== opened.ticked[0], `${JSON.stringify(opened.ticked)} → ${JSON.stringify(second)}`);

console.log('\n3. the export/import pair still agrees with itself');
/* Settings ▸ Export now writes a preset BUNDLE. The Import button beside it
   read backup files only — an export whose own file will not load back in is
   the silent no-op this project treats as the cardinal sin. */
const prefs = src('components/PreferencesDialog.tsx');
ok('Import beside it reads a preset bundle', /readPresetFile\(text\)/.test(prefs), '');
ok('…and still reads a legacy backup file', /applyBackup\(text\)/.test(prefs), '');
ok('…choosing by what the file IS, not by what wrote it',
  /bundleIds \? [\s\S]{0,400}applyPresetFile\(text\)/.test(prefs), '');

console.log('\n4. one theme is not "all themes"');
/* The bundle has no way to say "just this one", so routing a single-theme
   export to the window would quietly export ALL of them — a wrong answer
   wearing the right button's label. */
const themes = src('components/ThemesTab.tsx');
ok('a single theme still exports as a single theme',
  /else void exportThemes\(\[v\]\)/.test(themes), '');
ok('…and the preset route is reachable even with one theme',
  !/customThemes\.length > 1[\s\S]{0,120}Export All Themes/.test(themes), '');

console.log(`\ncheck-v728: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
