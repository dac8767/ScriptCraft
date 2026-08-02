// check-v567 — Pages window tabs: Script / Title Page / Custom.
//  1. the Pages header carries the three tabs (collapsed to the v4.53
//     "Section" dropdown in a narrow dock — the designed overflow — and a
//     full strip when the window is wide/fullscreen)
//  2. no separate Title Page dock row / tool anymore
//  3. Script tab lists script pages only; Custom holds the custom pages
//     (+ Add Custom Page flow, position note on the thumb)
//  4. Title Page tab hosts the real editor; a narrow host stacks its columns,
//     a wide one keeps two; Cancel returns to Script
//  5. Project ▸ Title Page opens Pages on the Title Page tab
import { launch, boot, seedScript, openTool, fullscreen, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};

/** Switch the Pages tab through whichever form the header shows — the strip
 *  button when it fits, the collapsed "Section" dropdown when it doesn't. */
async function gotoTab(label) {
  const strip = await page.$('.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:has-text("' + label + '")');
  if (strip && await strip.isVisible()) { await strip.click(); return 'strip'; }
  await page.click('.tool-chrome-tabs-dd .tool-ctl');
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:has-text("' + label + '")');
  return 'dropdown';
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);

  // ── 1. the tab set exists (measure strip carries the full labels) ──
  await openTool(page, 'Pages');
  await page.waitForSelector('.page-thumbnails-grid', { timeout: 8000 });
  const tabTexts = await page.$$eval('.tool-chrome-tabs-measure .tool-chrome-tab',
    (els) => els.map((e) => e.textContent?.trim()));
  // v5.71 added an All tab and shortened the labels; check-v571 owns the
  // tab NAMES now. This one only cares that the strip is there.
  ok(tabTexts.length >= 3, `the Pages header carries its tab strip (${tabTexts.join(' / ')})`);

  // ── 2. the standalone tool is gone ──
  ok(!(await page.$('.tool-dock-item:has-text("Title")')),
    'no separate Title Page row in the dock');

  // ── 3a. Script tab: script pages only ──
  const scriptThumbLabels = await page.$$eval('.page-thumb-number', (els) => els.map((e) => e.textContent));
  ok(scriptThumbLabels.length > 0 && scriptThumbLabels.every((t) => /^Page \d+$/.test(t || '')),
    `Script tab lists only numbered script pages (${scriptThumbLabels.join(' | ')})`);
  const scriptPageCount = scriptThumbLabels.length;

  // ── 3b. Custom tab: empty state, add flow, position note ──
  const how = await gotoTab('Custom');
  await page.waitForSelector('.navigator-empty:has-text("No custom pages yet")', { timeout: 5000 });
  ok(true, `Custom tab shows its empty state (switched via the ${how})`);
  ok(!(await page.$('.fs-pages-goto-btn')), 'the # go-to control hides off the Script tab');

  await page.click('.fs-pages-addpage');
  await page.waitForSelector('#fs-pages-addafter', { timeout: 5000 });
  await page.fill('#fs-pages-addafter', '1');
  await page.click('.fs-pages-pop-form button[type="submit"]');
  await page.waitForSelector('.page-thumb-number:has-text("Custom Page")', { timeout: 5000 });
  const posNote = await page.$eval('.page-thumb-pos', (e) => e.textContent);
  ok((posNote || '').includes('before page 2'),
    `the custom thumb carries its position ("${posNote?.trim()}")`);

  // ── 3c. back on Script: the custom page stays out of the grid ──
  await gotoTab('Script');
  await page.waitForSelector('.fs-pages-goto-btn', { timeout: 5000 });
  const scriptLabels2 = await page.$$eval('.page-thumb-number', (els) => els.map((e) => e.textContent));
  ok(scriptLabels2.every((t) => !/Custom/.test(t || '')) && scriptLabels2.length === scriptPageCount,
    'Script tab still lists only the script pages (custom page absent)');

  // ── 4a. Title Page tab in the NARROW dock: stacked single column ──
  await gotoTab('Title');
  await page.waitForSelector('.fs-pages-titlehost .tp-editor-dialog', { timeout: 5000 });
  const hostW = await page.$eval('.fs-pages-titlehost', (e) => e.clientWidth);
  const narrow = await page.$('.fs-pages-titlehost.fs-tp-narrow');
  const cols = await page.$eval('.tp-editor-body', (e) => getComputedStyle(e).gridTemplateColumns);
  const colCount = cols.trim().split(/\s+/).length;
  ok(hostW < 560 && !!narrow && colCount === 1,
    `narrow host stacks the editor (host ${hostW}px → ${colCount} column)`);

  // ── 4b. Cancel returns to Script ──
  await page.click('.tp-editor-dialog .dialog-actions button:has-text("Cancel")');
  await page.waitForSelector('.page-thumbnails-grid', { timeout: 5000 });
  ok((await page.evaluate(() => window.__scStore.getState().pagesTab)) === 'script',
    'Cancel returns to the Script tab');

  // ── 5. Project ▸ Title Page lands on the tab ──
  await page.click('.menu-item .menu-label:has-text("Project")');
  await page.click('.menu-dropdown-item:has-text("Title")');
  await page.waitForSelector('.fs-pages-titlehost .tp-editor-dialog', { timeout: 5000 });
  ok((await page.evaluate(() => window.__scStore.getState().pagesTab)) === 'title',
    'Project ▸ Title Page opens Pages on the Title Page tab');

  // ── 6. fullscreen: the strip uncollapses; the wide editor keeps 2 columns ──
  await fullscreen(page);
  await page.waitForSelector('.fs-tool-takeover .fs-pages-titlehost .tp-editor-dialog', { timeout: 5000 });
  const stripTab = await page.$('.fs-tool-takeover .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:has-text("Custom")');
  ok(!!stripTab && await stripTab.isVisible(), 'fullscreen: the tabs ride the strip (uncollapsed)');
  const wideCols = await page.$eval('.fs-tool-takeover .tp-editor-body',
    (e) => getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length);
  const wideNarrow = await page.$('.fs-tool-takeover .fs-pages-titlehost.fs-tp-narrow');
  ok(wideCols === 2 && !wideNarrow, `fullscreen: the editor keeps two columns (${wideCols})`);
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v567: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
