// check-v572 — the Pages tabs read Script / Title / Custom / All, in that
// order, and each still lands on its view.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};

async function gotoTab(label) {
  const strip = await page.$(`.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:text-is("${label}")`);
  if (strip && await strip.isVisible()) { await strip.click(); return; }
  await page.click('.tool-chrome-tabs-dd .tool-ctl');
  await page.click(`.tool-ctl-menu .tool-ctl-menu-item:text-is("${label}")`);
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Pages');
  /* v7.70: Pages reopens on the tab it was last on, and the shipped defaults
     (Derek's preset) remember Title — so the thumbnail grid this check
     measures was never on screen. Start on Script; which tab it reopens on is
     not what any of this is about. */
  await page.evaluate(() => window.__scStore.getState().setPagesTab('script'));
  await settle(page);
  await page.waitForSelector('.page-thumbnails-grid', { timeout: 8000 });

  const tabTexts = await page.$$eval('.tool-chrome-tabs-measure .tool-chrome-tab',
    (els) => els.map((e) => e.textContent?.trim()));
  ok(tabTexts.join(' | ') === 'Script | Title | Custom | All',
    `the tabs read exactly Script | Title | Custom | All (saw: ${tabTexts.join(' | ')})`);

  await gotoTab('All');
  await page.waitForFunction(() => window.__scStore.getState().pagesTab === 'all', { timeout: 5000 });
  ok(true, 'All lands on the compiled grid');
  await gotoTab('Title');
  await page.waitForSelector('.fs-pages-titlehost .tp-editor-dialog', { timeout: 5000 });
  ok(true, 'Title lands on the title-page editor');
  await gotoTab('Custom');
  await page.waitForSelector('.fs-pages-addpage', { timeout: 5000 });
  ok(true, 'Custom lands on the custom-pages view');
  await gotoTab('Script');
  await page.waitForFunction(() => window.__scStore.getState().pagesTab === 'script', { timeout: 5000 });
  ok(true, 'Script lands back on the script grid');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v572: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
