/* check-v731 — Derek's two feedback rows, both filed against v7.30, both
 * tails of the two versions before them.
 *
 *   A (from v7.27) "shorten the tags field so it can be on the same row as
 *     cancel and Upload 1 file"
 *   B (from v7.28) "remove the old 'backup and restore' section… rename the
 *     sections currently named 'Presets' to 'Backup'… move the import preset
 *     button to a new section called 'Restore'"
 *
 * B is the tail of routing Export into the one preset window: it left a
 * heading whose only remaining control was an Import. The assertion that
 * matters is that ONE import door survives and still reads BOTH shapes —
 * the preset files Backup writes, and the whole-app files written before
 * v7.28. An export/import pair that cannot read its own output is the
 * failure this project treats as the cardinal sin.
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

console.log('\nA. the tags field shares the row with Cancel and Upload');
const row = await page.evaluate(async () => {
  localStorage.setItem('opendraft:feedbackProfile', JSON.stringify({ name: 'T', email: 't@e.com' }));
  window.__scStore.getState().openTool('assets');
  await new Promise((r) => setTimeout(r, 700));
  const input = document.querySelector('.asset-upload-zone input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const tags = document.querySelector('#asset-stage-tags');
  const btns = [...document.querySelectorAll('.asset-staged-actions .dialog-btn')];
  if (!tags || btns.length < 2) return { found: false, tags: !!tags, btns: btns.length };
  const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  return {
    found: true,
    labels: btns.map((b) => b.textContent.trim()),
    // same row = their vertical centres agree
    tagsMid: Math.round(mid(tags)),
    cancelMid: Math.round(mid(btns[0])),
    uploadMid: Math.round(mid(btns[1])),
    tagsW: Math.round(tags.getBoundingClientRect().width),
    // the tags field must not be squeezed to nothing to fit
    rowW: Math.round(document.querySelector('.asset-staged-actions').getBoundingClientRect().width),
  };
});
ok('the staged row has the field and both buttons', row.found === true, JSON.stringify(row));
ok('…Cancel and Upload are the buttons',
  JSON.stringify(row.labels) === '["Cancel","Upload 1 file"]', JSON.stringify(row.labels));
ok('…the tags field sits on the SAME row as Cancel',
  Math.abs(row.tagsMid - row.cancelMid) <= 2, `tags ${row.tagsMid} vs cancel ${row.cancelMid}`);
ok('…and as Upload', Math.abs(row.tagsMid - row.uploadMid) <= 2, `tags ${row.tagsMid} vs upload ${row.uploadMid}`);
ok('…and it is still usable, not squeezed to a sliver',
  row.tagsW >= 90, `${row.tagsW}px of ${row.rowW}px`);
const am = src('components/AssetManager.tsx');
ok('the old full-width tags row is gone', !/asset-tag-input-row/.test(am), '');

console.log('\nB. Backup and Restore');
const tab = await page.evaluate(async () => {
  const S = window.__scStore.getState();
  S.openPreferences();
  await new Promise((r) => setTimeout(r, 500));
  const rail = [...document.querySelectorAll('.prefs-tab')].find((b) => /Backup/.test(b.textContent));
  rail?.click();
  await new Promise((r) => setTimeout(r, 400));
  const body = document.querySelector('.prefs-general');
  return {
    headings: [...(body?.querySelectorAll('h3') ?? [])].map((h) => h.textContent.trim()),
    buttons: [...(body?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()).filter(Boolean),
    hasChecklist: !!body?.querySelector('.fs-presets-row'),
  };
});
ok('the tab has exactly Backup and Restore',
  JSON.stringify(tab.headings) === '["Backup","Restore"]', JSON.stringify(tab.headings));
ok('…the old "Backup & Restore" section is gone',
  !tab.headings.some((h) => /&/.test(h)) && !tab.headings.includes('Presets'), JSON.stringify(tab.headings));
ok('…"Export Settings…" went with it', !tab.buttons.some((b) => /Export Settings/.test(b)), JSON.stringify(tab.buttons));
ok('Backup is the checklist', tab.hasChecklist === true, JSON.stringify(tab));
ok('Restore offers exactly one import door',
  tab.buttons.filter((b) => /Restore from a file|Import/i.test(b)).length === 1, JSON.stringify(tab.buttons));

const prefs = src('components/PreferencesDialog.tsx');
ok('the checklist renders without its own import half',
  /<PresetsPanel showImports=\{false\} \/>/.test(prefs), '');
/* The pair must still agree with itself — Backup writes a preset bundle, and
   files written before v7.28 are the other shape. */
ok('Restore reads a preset bundle', /readPresetFile\(text\)/.test(prefs), '');
ok('…and a pre-v7.28 settings file', /applyBackup\(text\)/.test(prefs), '');
ok('…deciding by what the file IS', /bundleIds \? [\s\S]{0,400}applyPresetFile\(text\)/.test(prefs), '');

console.log(`\ncheck-v731: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
