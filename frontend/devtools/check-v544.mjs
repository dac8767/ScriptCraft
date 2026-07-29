// devtools/check-v544.mjs — the Pages tool batch: header reorder (+ Add Page,
// Go to page, Pages per row — all LEFT, gap = Design knob), the + Add Page
// dropdown (custom page after a chosen page / title page), thumbnails at the
// REAL page ratio (the A4 hardcode left a dead strip), custom-thumb drag +
// ⋮ Move / Delete, script thumbs immovable.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const labels = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.page-thumb-number')].map((e) => e.textContent.trim()));

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Pages');
await page.waitForSelector('.page-thumbnail', { timeout: 8000 });

// ── header: order, alignment, old button gone ────────────────────────────
const head = await page.evaluate(() => {
  const r = (el) => el?.getBoundingClientRect();
  const row = r(document.querySelector('.fs-pages-actions'));
  const add = r(document.querySelector('.fs-pages-addpage'));
  const goto_ = r(document.querySelector('label[for="fs-pages-goto"]'));
  const perrow = r(document.querySelector('#fs-pages-perrow-label'));
  const perrowGroup = r(document.querySelector('#fs-pages-perrow-label')?.parentElement);
  return {
    oldBtn: !!document.querySelector('.fs-pages-addcustom'),
    addText: document.querySelector('.fs-pages-addpage')?.textContent,
    have: !!(row && add && goto_ && perrow),
    addFirst: add && goto_ && (add.top < goto_.top - 2 || add.left < goto_.left),
    gotoBeforePerrow: goto_ && perrow && (goto_.top < perrow.top - 2 || goto_.left < perrow.left),
    stepperNotPinnedRight: perrowGroup && row && (row.right - perrowGroup.right > 24),
  };
});
ok(!head.oldBtn && head.addText === '+ Add Page', 'the button is "+ Add Page" (old + Custom Page gone)');
ok(head.have && head.addFirst && head.gotoBeforePerrow,
  'order: + Add Page, then Go to page, then Pages per row');
ok(head.stepperNotPinnedRight, 'the per-row stepper is LEFT-aligned, not pinned to the right edge');

// ── the gap is the Design knob ───────────────────────────────────────────
const gapDefault = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.fs-pages-actions')).gap);
await page.evaluate(() => window.__scStore.getState().setDesignVar('pagesCtlGap', 26));
await page.waitForTimeout(120);
const gapSet = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.fs-pages-actions')).gap);
await page.evaluate(() => window.__scStore.getState().resetDesignVar('pagesCtlGap'));
ok(gapDefault === '10px' && gapSet === '26px',
  `header spacing rides --dz-pages-ctl-gap (${gapDefault} → ${gapSet})`);

// ── thumbnails at the REAL page ratio (US Letter, not A4) ────────────────
const ratio = await page.evaluate(() => {
  const clip = document.querySelector('.page-thumb-content-clip').getBoundingClientRect();
  return clip.height / clip.width;
});
ok(Math.abs(ratio - 11 / 8.5) < 0.02 && Math.abs(ratio - 11.69 / 8.26) > 0.05,
  `thumbs are Letter-proportioned (${ratio.toFixed(3)} ≈ ${(11 / 8.5).toFixed(3)}, not A4 ${(11.69 / 8.26).toFixed(3)})`);
await page.screenshot({ path: `${SHOTS}/v544-header.png` });

// ── + Add Page menu: custom page after page 1 ────────────────────────────
await page.click('.fs-pages-addpage');
await page.waitForSelector('.fs-pages-pop', { timeout: 4000 });
const menu = await page.evaluate(() =>
  [...document.querySelectorAll('.fs-pages-pop-item')].map((e) => e.textContent.trim()));
ok(menu.length === 2 && menu[0] === 'Add Custom Page' && menu[1] === 'Add Title Page',
  `dropdown holds the two options (${menu.join(' / ')})`);
await page.click('.fs-pages-pop-item:has-text("Add Custom Page")');
await page.waitForSelector('#fs-pages-addafter', { timeout: 4000 });
const afterLabel = await page.evaluate(() =>
  document.querySelector('label[for="fs-pages-addafter"]')?.textContent);
ok(afterLabel === 'Add after page #:', `the flow asks "${afterLabel}"`);
await page.fill('#fs-pages-addafter', '1');
await page.click('.fs-pages-pop-form button[type="submit"]');
await page.waitForFunction(
  () => [...document.querySelectorAll('.page-thumb-number')].some((e) => e.textContent.includes('Custom')),
  { timeout: 6000 },
);
let seq = await labels(page);
ok(seq[0] === 'Page 1' && seq[1] === 'Custom Page' && seq[2] === 'Page 2',
  `typed 1 → the custom page sits between pages 1 and 2 (${seq.join(', ')})`);

// ── custom thumbs: draggable + ⋮; script thumbs: neither ─────────────────
const per = await page.evaluate(() => {
  const custom = document.querySelector('.page-thumbnail[data-cp-id]');
  const script = document.querySelector('.page-thumbnail[data-page="1"]');
  return {
    customDraggable: custom?.getAttribute('draggable') === 'true',
    customKebab: !!custom?.querySelector('.page-thumb-kebab'),
    scriptDraggable: script?.hasAttribute('draggable'),
    scriptKebab: !!script?.querySelector('.page-thumb-kebab'),
  };
});
ok(per.customDraggable && per.customKebab, 'the custom thumb is draggable and carries the ⋮');
ok(!per.scriptDraggable && !per.scriptKebab, 'script thumbs are NOT draggable and have no ⋮');
await page.screenshot({ path: `${SHOTS}/v544-custom-thumb.png` });

// ── ⋮ → Move page → after page 2 ─────────────────────────────────────────
await page.click('.page-thumbnail[data-cp-id] .page-thumb-kebab');
await page.waitForSelector('.fs-pages-pop', { timeout: 4000 });
const kebabMenu = await page.evaluate(() =>
  [...document.querySelectorAll('.fs-pages-pop-item')].map((e) => e.textContent.trim()));
ok(kebabMenu.join('/') === 'Move page/Delete page', `⋮ menu: ${kebabMenu.join(' / ')}`);
await page.click('.fs-pages-pop-item:has-text("Move page")');
await page.waitForSelector('#fs-pages-moveafter', { timeout: 4000 });
await page.fill('#fs-pages-moveafter', '2');
await page.click('.fs-pages-pop-form button[type="submit"]');
await page.waitForFunction(
  () => {
    const seq2 = [...document.querySelectorAll('.page-thumb-number')].map((e) => e.textContent.trim());
    return seq2[2] === 'Custom Page';
  },
  { timeout: 6000 },
);
seq = await labels(page);
ok(seq[0] === 'Page 1' && seq[1] === 'Page 2' && seq[2] === 'Custom Page',
  `Move after 2 → the custom page follows page 2 (${seq.join(', ')})`);

// ── drag the custom thumb onto page 1 → lands right after it ─────────────
await page.evaluate(() => {
  const src = document.querySelector('.page-thumbnail[data-cp-id]');
  window.__dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));
});
await page.waitForTimeout(150);   // dragstart state write is deferred a tick (WebKit rule)
const midDrag = await page.evaluate(() => {
  const tgt = document.querySelector('.page-thumbnail[data-page="1"]');
  tgt.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));
  return true;
});
await page.waitForTimeout(120);
const hasHint = await page.evaluate(() =>
  !!document.querySelector('.page-thumbnail[data-page="1"].drop-after'));
await page.evaluate(() => {
  const tgt = document.querySelector('.page-thumbnail[data-page="1"]');
  tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));
  document.querySelector('.page-thumbnail[data-cp-id]')
    ?.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
});
await page.waitForFunction(
  () => [...document.querySelectorAll('.page-thumb-number')].map((e) => e.textContent.trim())[1] === 'Custom Page',
  { timeout: 6000 },
);
seq = await labels(page);
ok(midDrag && hasHint, 'while dragging, the hovered page shows the landing edge');
ok(seq[0] === 'Page 1' && seq[1] === 'Custom Page',
  `dropped on page 1 → the custom page lands right after it (${seq.join(', ')})`);

// ── ⋮ → Delete page (confirmed) removes the run from the script ──────────
await page.click('.page-thumbnail[data-cp-id] .page-thumb-kebab');
await page.click('.fs-pages-pop-item:has-text("Delete page")');
await page.waitForSelector('.fs-confirm-overlay', { timeout: 4000 });
await page.click('.fs-confirm-ok');
await page.waitForFunction(
  () => ![...document.querySelectorAll('.page-thumb-number')].some((e) => e.textContent.includes('Custom')),
  { timeout: 6000 },
);
const remaining = await page.evaluate(() => {
  let n = 0;
  window.__scEditor.state.doc.forEach((node) => { if (node.type.name === 'customPage') n++; });
  return n;
});
ok(remaining === 0, 'Delete page (after the confirm) removes the run from the doc');

// ── + Add Page → Add Title Page opens the Title Page window ──────────────
await page.click('.fs-pages-addpage');
await page.waitForSelector('.fs-pages-pop', { timeout: 4000 });
await page.click('.fs-pages-pop-item:has-text("Title Page")');
const titleOpened = await page.waitForSelector('.tp-preview-scroll', { timeout: 6000 }).then(() => true).catch(() => false);
ok(titleOpened, 'Add Title Page opens the Title Page window');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
