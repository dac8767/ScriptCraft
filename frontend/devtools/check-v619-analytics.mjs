/* check-v619-analytics — v6.19, Derek: "move the analytics tab options into
   the header of the analytics window." The Overview/Scenes/Dialogue/Gender
   strip leaves the body for the shared TOOL_CHROME useTabs slot (like Goals);
   the active tab lives in the store (analyticsTab). */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page); await seedScript(page, SCENES_4);
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolMode('analytics', 'floating');
    s.openTool('analytics');
    s.setToolSize('analytics', 900, 600);   // wide → tabs render, not the dropdown
  });
  await page.waitForSelector('.tool-window .fs-analytics');
  await settle(page); await settle(page);

  const tabs = await page.$$eval(
    '.tool-window .tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab',
    (els) => els.map((e) => e.textContent.trim()));
  ok(tabs.join(',') === 'Overview,Scenes,Dialogue,Gender',
    `the window header carries the four tabs (${tabs.join(',')})`);
  ok(await page.$('.fs-analytics-tabs') === null, 'the in-body tab strip is gone');

  await page.click('.tool-window .tool-chrome-tabs .tool-chrome-tab:text-is("Dialogue")');
  await settle(page);
  const show = await page.$eval('.fs-analytics-stats', (el) => el.dataset.show);
  ok(show === 'dialogue', `clicking a header tab drives the body (data-show=${show})`);

  const active = await page.$eval('.tool-window .tool-chrome-tabs .tool-chrome-tab.active', (el) => el.textContent.trim());
  ok(active === 'Dialogue', 'and the header marks it active');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v619a-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v619-analytics: ${pass} passed, ${fail} failed`);
