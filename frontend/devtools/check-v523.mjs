// devtools/check-v523.mjs — Derek's batch:
//  1. compact blue add buttons (26px)
//  2. Sort menu order: Type · Date Created · Manual (manual LAST)
//  3. the bottom-left resize grip moves the LEFT edge of a dragged window
//     (the right edge stays put — the reported bug was the inverse)
//  4. "Items per row:" stepper in the popped-out shape, right-aligned,
//     driving the grid; absent when docked
//  5. Pages: Go-to leads left, the per-row stepper holds the right edge
import { launch, boot, seedScript, openTool, SCENES_4, shot } from './driver.mjs';

const results = [];
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(54)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await seedScript(page, SCENES_4);
await page.evaluate(() => {
  window.__scStore.getState().setShelfCards([
    { id: 'n1', type: 'comment', color: '#fff8b8', text: 'note one', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', type: 'comment', color: '#fff8b8', text: 'note two', createdAt: '2026-01-02T00:00:00Z' },
  ]);
});

// ── float the Sticky Notes window ───────────────────────────────────────────
await page.evaluate(() => {
  const st = window.__scStore.getState();
  st.setToolMode('sticky', 'floating');
  st.openTool('sticky');
});
await page.waitForSelector('.tool-window[data-tool="sticky"]');

// 1. compact buttons
const btnH = await page.$eval('.tool-window[data-tool="sticky"] .sticky-add-btn', (b) => getComputedStyle(b).height);
check('add buttons are compact (26px)', btnH, '26px');

// 2. sort order — manual last
await page.click('.tool-window[data-tool="sticky"] .tool-ctl:has-text("Sort")');
const sortItems = await page.evaluate(() =>
  [...document.querySelectorAll('.tool-ctl-menu .tool-ctl-menu-item')].map((i) => i.textContent));
// v5.36: the Type sort died with the note KINDS; Manual leads now.
check('Sort lists Manual · Date Created', sortItems, ['Manual', 'Date Created']);
// ControlDropdown closes on an outside PRESS (not Escape). NOT a click into
// the editor — clicking the script MINIMIZES the open tool window by design
// (v1.77) — so press on document.body instead.
await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await page.waitForSelector('.tool-ctl-menu', { state: 'detached' });

// 4. Items per row — present in the popped shape, right-aligned, drives grid
const stepper = await page.evaluate(() => {
  const row = document.querySelector('.tool-window[data-tool="sticky"] .tool-action-row');
  const grp = row.querySelector('.tool-action-group.tool-action-right');
  const rr = row.getBoundingClientRect();
  return {
    label: grp?.querySelector('.tool-action-label')?.textContent,
    rightGap: grp ? Math.round(rr.right - grp.getBoundingClientRect().right) : null,
  };
});
check('popped shape shows "# of Columns:" right-aligned', { l: stepper.label, ok: stepper.rightGap <= 12 }, { l: 'Notes per row:'   /* renamed in v5.50 */, ok: true });
await page.click('.tool-window[data-tool="sticky"] button[title="More columns (smaller cards)"]');
const cols = await page.$eval('.tool-window[data-tool="sticky"] .swn-scroll', (el) =>
  getComputedStyle(el).columnCount);
check('+ makes it a 2-column masonry', cols, '2');

// 3. THE RESIZE BUG — drag the window (it becomes left-anchored), then pull
// the bottom-left grip leftward: the LEFT edge must move, the RIGHT stay.
const header = await page.$('.tool-window[data-tool="sticky"] .tool-window-header .tool-window-title');
const hb = await header.boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x + hb.width / 2 - 120, hb.y + hb.height / 2 + 40, { steps: 8 });
await page.mouse.up();
const before = await page.$eval('.tool-window[data-tool="sticky"]', (el) => {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right) };
});
const grip = await page.$('.tool-window[data-tool="sticky"] .tool-window-resize');
const gb = await grip.boundingBox();
await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
await page.mouse.down();
await page.mouse.move(gb.x + gb.width / 2 - 80, gb.y + gb.height / 2 + 30, { steps: 8 });
await page.mouse.up();
const after = await page.$eval('.tool-window[data-tool="sticky"]', (el) => {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right) };
});
check('left grip moves the LEFT edge of a dragged window', after.left < before.left - 60, true);
check('…and the RIGHT edge stays put', Math.abs(after.right - before.right) <= 1, true);
await shot(page, '.tool-window[data-tool="sticky"]', new URL('./last-sticky-v523.png', import.meta.url).pathname, 620);

// docked: no stepper
await page.evaluate(() => {
  const st = window.__scStore.getState();
  st.closeTool('sticky');
  st.setToolMode('sticky', 'docked');
  st.openTool('sticky');
});
await page.waitForSelector('.tool-inline[data-tool="sticky"] .tool-action-row');
const dockedStepper = await page.evaluate(() =>
  !!document.querySelector('.tool-inline[data-tool="sticky"] .tool-action-group.tool-action-right'));
check('docked shape has NO per-row stepper', dockedStepper, false);

// ── 5. Pages swap: Go-to left, stepper right ────────────────────────────────
await openTool(page, 'Pages');
await page.waitForSelector('.tool-inline[data-tool="pages"] .tool-action-row');
const pages = await page.evaluate(() => {
  const row = document.querySelector('.tool-inline[data-tool="pages"] .tool-action-row');
  const rr = row.getBoundingClientRect();
  const form = row.querySelector('form');
  const grp = row.querySelector('.tool-action-group.tool-action-right');
  return {
    gotoLeft: Math.round(form.getBoundingClientRect().left - rr.left),
    stepperRight: Math.round(rr.right - grp.getBoundingClientRect().right),
    stepperLabel: grp.querySelector('.tool-action-label')?.textContent,
  };
});
check('Pages: Go-to leads the row', pages.gotoLeft <= 14, true);
check('Pages: per-row stepper hugs the right edge', { ok: pages.stepperRight <= 12, l: pages.stepperLabel }, { ok: true, l: 'Pages per row:' });

await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
