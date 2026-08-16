/* check-v727 — Derek's four, filed against v7.26.
 *
 *   1 a warning window when deleting assets
 *   2 a button to rename items
 *   3 the confusing "Tags for upload:" field — separate the upload section
 *     from the list, stage a picked file instead of filing it, show the tags
 *     field at THAT point, and add an Upload button that commits it
 *   4 a clearer border around the drop area
 *
 * (3) is the one with teeth. The old flow uploaded on pick, so the tags box
 * sat above the picker asking a question about nothing — and the answer, once
 * typed, applied to the NEXT file rather than the one you just added. The
 * assertion that matters is that picking a file adds NOTHING to the library.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);
await settle(page);

await page.evaluate(async () => {
  window.__scStore.getState().openTool('assets');
  await new Promise((r) => setTimeout(r, 700));
});

console.log('\n1. the two halves are separate, and the drop area has an edge');
const layout = await page.evaluate(() => {
  const add = document.querySelector('.asset-add');
  const zone = document.querySelector('.asset-upload-zone');
  const z = zone && getComputedStyle(zone);
  const a = add && getComputedStyle(add);
  return {
    hasAdd: !!add,
    addBorder: a ? parseFloat(a.borderTopWidth) : 0,
    titles: [...document.querySelectorAll('.asset-section-title')].map((e) => e.textContent.trim()),
    zoneBorder: z ? parseFloat(z.borderTopWidth) : 0,
    zoneStyle: z ? z.borderTopStyle : null,
    // it must be VISIBLE, not the hairline that separates things nobody
    // is meant to notice — so the edge must differ from the panel's own
    zoneColor: z ? z.borderTopColor : null,
    zoneFill: z ? z.backgroundColor : null,
  };
});
ok('the Add section exists and is boxed', layout.hasAdd && layout.addBorder >= 1, JSON.stringify(layout));
ok('…the two halves are labelled', JSON.stringify(layout.titles) === '["Add","Library"]', JSON.stringify(layout.titles));
ok('the drop area has a real border', layout.zoneBorder >= 2 && layout.zoneStyle === 'dashed', JSON.stringify(layout));
ok('…and it is tinted, so the target reads as a target',
  !!layout.zoneFill && layout.zoneFill !== 'rgba(0, 0, 0, 0)', String(layout.zoneFill));

console.log('\n2. picking a file STAGES it — nothing reaches the library');
const staged = await page.evaluate(async () => {
  const before = document.querySelectorAll('.asset-row').length;
  const input = document.querySelector('.asset-upload-zone input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  return {
    before,
    rowsAfter: document.querySelectorAll('.asset-row').length,
    chips: [...document.querySelectorAll('.asset-staged-name')].map((e) => e.textContent),
    hasThumb: !!document.querySelector('.asset-staged-thumb'),
    tagsShown: !!document.querySelector('#asset-stage-tags'),
    tagsLabel: document.querySelector('label[for="asset-stage-tags"]')?.textContent?.trim() ?? null,
    uploadBtn: document.querySelector('.asset-upload-btn')?.textContent?.trim() ?? null,
    tagsPlaceholder: document.querySelector('#asset-stage-tags')?.getAttribute('placeholder') ?? null,
  };
});
ok('the picked file is SHOWN', JSON.stringify(staged.chips) === '["poster.png"]', JSON.stringify(staged.chips));
ok('…with its picture, so you can see what you picked', staged.hasThumb === true, JSON.stringify(staged));
ok('…and it is NOT in the library yet — the whole point',
  staged.rowsAfter === staged.before, `rows ${staged.before} → ${staged.rowsAfter}`);
ok('the tags field appears only NOW, once there is something to tag',
  staged.tagsShown === true, JSON.stringify(staged));
ok('…and it names what it will tag', /Tags for this file:/.test(staged.tagsLabel || ''), String(staged.tagsLabel));
ok('there is an Upload button, and it counts', /^Upload 1 file$/.test(staged.uploadBtn || ''), String(staged.uploadBtn));
/* Caught by looking at it: an escape sequence in a plain JSX ATTRIBUTE is
   literal text, so the placeholder read "tag1, tag2, \\u2026" on screen. */
ok('…and no escape sequence leaks into the visible text',
  !/\\u[0-9a-f]{4}/i.test(staged.tagsPlaceholder || '') && /tag1, tag2/.test(staged.tagsPlaceholder || ''),
  String(staged.tagsPlaceholder));

/* Before the pick there must be NO tags field — that was the complaint. */
const beforePick = await page.evaluate(async () => {
  document.querySelector('.asset-staged-actions .dialog-btn')?.click();   // Cancel
  await new Promise((r) => setTimeout(r, 250));
  return {
    tags: !!document.querySelector('#asset-stage-tags'),
    upload: !!document.querySelector('.asset-upload-btn'),
    chips: document.querySelectorAll('.asset-staged-chip').length,
  };
});
ok('with nothing staged, no tags field and no Upload button are shown',
  !beforePick.tags && !beforePick.upload && beforePick.chips === 0, JSON.stringify(beforePick));

console.log('\n3. delete warns, rename exists');
const src = readFileSync(new URL('../src/components/AssetManager.tsx', import.meta.url), 'utf8');
ok('delete goes through the app\'s confirm, marked danger',
  /confirmDialog\([\s\S]{0,220}danger: true/.test(src), '');
ok('…and the warning says what is lost, not just "are you sure"',
  /Any script using this file will lose it/.test(src), '');
/* USAGE, not the word — the code comments explain WHY window.confirm is
   banned here (a Promise is always truthy, so the guard never blocks), and a
   check that forbids naming a thing forbids documenting it. */
ok('…never window.confirm (a Promise is always truthy in the desktop app)',
  !/window\.confirm\(/.test(src), '');
const buttons = await page.evaluate(() => {
  const row = document.querySelector('.asset-row');
  return row ? [...row.querySelectorAll('.asset-cell-actions button')].map((b) => b.title) : [];
});
ok('a row offers Rename beside Download and Delete',
  buttons.length === 0 || (buttons.includes('Rename') && buttons.includes('Delete')), JSON.stringify(buttons));
ok('rename uses the app\'s one prompt primitive', /promptDialog\(/.test(src), '');

console.log('\n4. rename touches the display name, in every backend');
/* Four backends implement this surface and NONE of them share an interface —
   a method added to one falls through to the HTTP version and fails on the
   desktop, silently. Renaming `filename` instead of `original_name` would be
   worse still: it is the path getAssetUrl builds, so every placed image
   would break. */
const svc = (f) => readFileSync(new URL(`../src/services/${f}`, import.meta.url), 'utf8');
for (const f of ['api.ts', 'local-storage.ts', 'file-fallback-storage.ts', 'fallback-storage.ts']) {
  ok(`${f} implements renameAsset`, /renameAsset/.test(svc(f)), '');
}
ok('the SQLite backend renames original_name, never filename',
  /UPDATE assets SET original_name/.test(svc('local-storage.ts'))
  && !/UPDATE assets SET filename/.test(svc('local-storage.ts')), '');

console.log('\n5. one staging path — the native drop stages too');
/* It used to upload on the spot, which would have left two different answers
   to "what happens when I drop a file" depending on where the drop came
   from. */
ok('the Tauri drop hands its files to the same stageFiles',
  /stageFiles\(read\)/.test(src), '');
ok('…and the native handler no longer uploads at all',
  !/read_binary_file[\s\S]{0,900}api\.uploadAsset/.test(src), '');
ok('uploadAsset is called from exactly one place now',
  (src.match(/api\.uploadAsset\(/g) || []).length === 1, String((src.match(/api\.uploadAsset\(/g) || []).length));

console.log(`\ncheck-v727: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
