// devtools/check-scenes-v520.mjs — Derek's four-item Scenes batch:
//  1. the Filter popover fits INSIDE the tool window (was spilling out),
//  2. "Cards per row:" stepper left + Reorder right-aligned on the action row,
//  3. Filter and View menus are mutually exclusive,
//  4. cards wear the lighter surface (--fd-toolbar-bg, #353535 dark).
import { launch, boot, seedScript, openTool, waitScenes, shot, SCENES_4, useSceneList, settle } from './driver.mjs';

const results = [];
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n.padEnd(48)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await seedScript(page, SCENES_4);
/* v7.70: the shipped defaults remember Scenes as fullscreen; the panel below
   is the docked one. */
await page.evaluate(() => window.__scStore.getState().setToolMode('scenes', 'docked'));
await settle(page);
await openTool(page, 'Scenes');
await useSceneList(page);
await waitScenes(page, 4);

// ── 1. Filter popover contained in the docked window ────────────────────────
await page.click('.tool-chrome-controls button.tool-ctl:has-text("Filter")');
await page.waitForSelector('.fs-scene-filterpop');
const pop = await page.evaluate(() => {
  const p = document.querySelector('.fs-scene-filterpop');
  const win = document.querySelector('.tool-inline[data-tool="scenes"]');
  const pr = p.getBoundingClientRect(), wr = win.getBoundingClientRect();
  const dots = [...p.querySelectorAll('.scene-filter-color-dot')].map((d) => d.getBoundingClientRect());
  return {
    insideWin: pr.left >= wr.left - 0.5 && pr.right <= wr.right + 0.5,
    noOverflow: p.scrollWidth <= p.clientWidth + 1,
    dotsInside: dots.every((d) => d.left >= pr.left && d.right <= pr.right),
    dotCount: dots.length,
  };
});
check('popover stays inside the docked window', pop.insideWin, true);
check('popover content does not overflow its box', pop.noOverflow, true);
check('all color dots inside the popover', { in: pop.dotsInside, n: pop.dotCount }, { in: true, n: 10 });
await shot(page, '.tool-inline[data-tool="scenes"]', new URL('./last-scenes-filterpop.png', import.meta.url).pathname, 500);

// ── 3. mutual exclusion (popover still open from step 1) ────────────────────
await page.click('.tool-chrome-controls button.tool-ctl[title="View"]');
const afterView = await page.evaluate(() => ({
  pop: !!document.querySelector('.fs-scene-filterpop'),
  menu: !!document.querySelector('.tool-ctl-menu'),
}));
check('opening View closes the Filter popover', afterView, { pop: false, menu: true });
await page.click('.tool-chrome-controls button.tool-ctl:has-text("Filter")');
const afterFilter = await page.evaluate(() => ({
  pop: !!document.querySelector('.fs-scene-filterpop'),
  menu: !!document.querySelector('.tool-ctl-menu'),
}));
check('opening Filter closes the View menu', afterFilter, { pop: true, menu: false });
await page.keyboard.press('Escape');

// ── 2 + 4. cards view: stepper left, Reorder right, lighter cards ───────────
await page.click('.tool-chrome-controls button.tool-ctl[title="View"]');
await page.click('.tool-ctl-menu-item:has-text("Cards")');
await page.waitForSelector('.index-card');
const cards = await page.evaluate(() => {
  const row = document.querySelector('.scenes-tool .tool-action-row');
  const rr = row.getBoundingClientRect();
  const label = row.querySelector('.tool-action-label');
  const stepper = row.querySelector('.tool-action-group.tool-action-right');
  const btn = row.querySelector('.scene-reorder-btn');
  const grid = document.querySelector('.index-cards-grid');
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const bg = getComputedStyle(document.querySelector('.index-card')).backgroundColor;
  return {
    label: label?.textContent,
    // v5.23 swap: Reorder leads (left), the stepper holds the right edge.
    reorderLeft: Math.round(btn.getBoundingClientRect().left - rr.left),
    stepperRight: Math.round(rr.right - stepper.getBoundingClientRect().right),
    cols, bg,
  };
});
check('stepper labelled "Cards per row:"', cards.label, 'Cards per row:');
check('Reorder leads the row (v5.23 swap)', cards.reorderLeft <= 14, true);
check('stepper hugs the row\'s right edge', cards.stepperRight <= 12, true);
check('grid renders the default 3 columns', cards.cols, 3);
check('cards wear the lighter surface', cards.bg, 'rgb(53, 53, 53)');

await page.click('button[title="More cards per row (smaller cards)"]');
const colsAfter = await page.evaluate(() => getComputedStyle(document.querySelector('.index-cards-grid')).gridTemplateColumns.split(' ').length);
check('+ steps the column count to 4', colsAfter, 4);
await shot(page, '.tool-inline[data-tool="scenes"]', new URL('./last-scenes-cards.png', import.meta.url).pathname, 500);

await browser.close();
console.log(results.every(Boolean) ? 'ALL OK' : 'FAILURES');
process.exit(results.every(Boolean) ? 0 : 1);
