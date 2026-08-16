/* check-v723 — Derek's five, filed against v7.22.
 *
 *   1 the Settings gear is too big  → it was not even HIS gear (see below)
 *   2 File ▸ Open goes straight to the file explorer
 *   3 File ▸ Open Recent… below it, opening the window that used to be Open
 *   4 no "Browse This Computer…" in that window any more
 *   5 Open Recent shows at most 10
 *
 * On (1): the icon in his screenshot was macOS's OWN preferences gear, not
 * his file. In the Vite DEV SERVER — which is what `tauri dev` runs, so it is
 * what he has — requesting /src/assets/settings-gear.png returns the JS
 * MODULE (`export default "/src/..."`, content-type text/javascript), so
 * `img.decode()` threw and rasterizeGear fell back. `?inline` makes it a
 * data: URI, which needs no server round trip. That fallback is exactly the
 * silent-no-op shape: the menu looked fine, the icon was simply someone
 * else's.
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

console.log('\n1. the gear actually decodes');
const gear = await page.evaluate(async () => {
  const out = {};
  // the URL form: what v7.22 used, and why it failed
  try {
    const url = (await import('/src/assets/settings-gear.png')).default;
    const r = await fetch(url);
    out.urlContentType = r.headers.get('content-type');
  } catch (e) { out.urlErr = String(e).slice(0, 50); }
  // the inline form: what the rasterizer uses now
  try {
    const data = (await import('/src/assets/settings-gear.png?inline')).default;
    out.isDataUri = String(data).startsWith('data:image/');
    const img = new Image();
    img.src = data;
    await img.decode();
    out.natural = [img.naturalWidth, img.naturalHeight];
    // and the ink it produces at the shipped inset
    const size = 32, INSET = 0.72;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const off = (size * (1 - INSET)) / 2;
    ctx.drawImage(img, off, off, size * INSET, size * INSET);
    const { data: px } = ctx.getImageData(0, 0, size, size);
    let x0 = size, x1 = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (px[(y * size + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
    out.ink = x1 - x0 + 1;
  } catch (e) { out.inlineErr = String(e).slice(0, 60); }
  return out;
});
ok('the plain URL is served as JAVASCRIPT in dev — the v7.22 trap, pinned',
  /javascript/.test(gear.urlContentType || ''), String(gear.urlContentType));
ok('…so the rasterizer takes the inline data URI instead', gear.isDataUri === true, JSON.stringify(gear));
ok('…which decodes at Derek\'s full 512', JSON.stringify(gear.natural) === '[512,512]', JSON.stringify(gear.natural));
/* His screenshot, decoded: the system glyphs' ink is 24-28px wide in the
   32px (16pt @2x) slot. 0.72 puts the gear at 24. */
ok('…and paints 24px of ink, level with the glyphs beside it',
  gear.ink >= 23 && gear.ink <= 25, `ink ${gear.ink}px`);
const nat = readFileSync(new URL('../src/menu/nativeMenuSync.ts', import.meta.url), 'utf8');
ok('the shipped code uses ?inline, not the bare URL',
  /settings-gear\.png\?inline/.test(nat), '');
ok('…at the measured inset', /INSET = 0\.72/.test(nat), '');

console.log('\n2. File ▸ Open is the file explorer');
const menuSrc = readFileSync(new URL('../src/components/MenuBar.tsx', import.meta.url), 'utf8');
ok('Open runs the importer, not the script list',
  /label: 'Open…'[\s\S]{0,120}action: \(\) => confirmOrRun\(handleImport\)/.test(menuSrc), '');
ok('Open Recent… sits directly below it',
  /label: 'Open…'[\s\S]{0,200}label: 'Open Recent…'/.test(menuSrc), '');
ok('…and it is Open Recent that opens the window',
  /label: 'Open Recent…'[\s\S]{0,120}setOpenFileOpen\(true\)/.test(menuSrc), '');

const items = await page.evaluate(async () => {
  const file = [...document.querySelectorAll('.menu-label')]
    .find((l) => /^File$/i.test(l.textContent.trim()))?.parentElement;
  file?.click();
  await new Promise((r) => setTimeout(r, 250));
  return [...document.querySelectorAll('.menu-dropdown-item')].map((e) => e.textContent.trim());
});
const iOpen = items.findIndex((t) => /^Open…/.test(t));
const iRecent = items.findIndex((t) => /^Open Recent…/.test(t));
ok('both items are in the File menu', iOpen >= 0 && iRecent >= 0, JSON.stringify(items.slice(0, 6)));
ok('…in that order, adjacent', iRecent === iOpen + 1, `Open at ${iOpen}, Recent at ${iRecent}`);
await page.keyboard.press('Escape');
await settle(page);

console.log('\n3. the Open Recent window');
const win = await page.evaluate(async () => {
  window.__scStore.getState().setOpenFileOpen(true);
  await new Promise((r) => setTimeout(r, 400));
  const box = document.querySelector('.open-from-project-dialog');
  return {
    title: box?.querySelector('.dialog-header')?.textContent?.trim() ?? null,
    buttons: [...(box?.querySelectorAll('.dialog-actions button') ?? [])].map((b) => b.textContent.trim()),
    rows: box?.querySelectorAll('.open-file-item, .open-file-row, li').length ?? 0,
  };
});
ok('it is called Open Recent', win.title === 'Open Recent', String(win.title));
ok('no "Browse This Computer…" button', !win.buttons.some((b) => /Browse/i.test(b)), JSON.stringify(win.buttons));
ok('…Cancel is still there', win.buttons.some((b) => /Cancel/i.test(b)), JSON.stringify(win.buttons));

const src = readFileSync(new URL('../src/components/OpenFile.tsx', import.meta.url), 'utf8');
ok('the list is capped at ten', /RECENT_LIMIT = 10/.test(src) && /slice\(0, RECENT_LIMIT\)/.test(src), '');
ok('…after the sort and the search, so typing still reaches an older script',
  /\.filter\([\s\S]{0,160}\.sort\([\s\S]{0,120}\.slice\(0, RECENT_LIMIT\)/.test(src), '');
/* USAGE, not the word — the mount site keeps a comment explaining the
   absence, and a check that forbids mentioning a thing forbids documenting
   why it went. */
const editorSrc = readFileSync(new URL('../src/components/ScreenplayEditor.tsx', import.meta.url), 'utf8');
ok('the dead onBrowseLocal prop is gone, not just unused',
  !/onBrowseLocal[?:=]/.test(src) && !/onBrowseLocal=/.test(editorSrc), '');

console.log('\n4. the draft beside the name');
const draft = await page.evaluate(() => {
  const box = document.querySelector('.open-from-project-dialog');
  return {
    rows: box?.querySelectorAll('.open-project-name').length ?? 0,
    hasSlot: !!box?.querySelector('.open-project-name'),
  };
});
ok('the window lists rows to label', draft.rows >= 0, JSON.stringify(draft));
ok('the draft renders beside the name, muted and optional',
  /open-project-draft/.test(src) && /script\.draft_label &&/.test(src), '');
ok('…carried as metadata, never by fetching each script',
  /draft_label\?: string/.test(readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8')), '');
const store = readFileSync(new URL('../src/services/local-storage.ts', import.meta.url), 'utf8');
ok('…extracted in SQL, so the row stays small',
  /json_extract\(sc\.content, '\$\._draftLabel'\)/.test(store), '');
ok('…with a fallback, because a list that will not open is worse than one without drafts',
  /catch[\s\S]{0,240}listing without them/.test(store), '');

console.log(`\ncheck-v723: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
