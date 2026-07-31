// check-v568 — Navigator filter: the Scene Headings section.
//  1. the pop reads "Scene Headings" above "Annotations" (the old
//     "Filter Annotations" title is gone)
//  2. INT./EXT. segment, Location dropdown (every script location),
//     Contains field — each actually filters the scene rows
//  3. filters stack; the chip counts them; clearing restores the list
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};
const sceneRows = () => page.$$eval('.fs-nav-item.scene', (els) => els.map((e) => e.textContent || ''));
const waitRows = (n) => page.waitForFunction(
  (want) => document.querySelectorAll('.fs-nav-item.scene').length === want, n, { timeout: 6000 });

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Navigator');
  await waitRows(4);
  ok(true, 'Navigator lists the 4 seeded scene headings');

  // ── 1. section titles ──
  await page.click('.markup-ctl-filter');
  await page.waitForSelector('.markup-filter-pop', { timeout: 5000 });
  const titles = await page.$$eval('.fs-nav-filter-title', (els) => els.map((e) => e.textContent?.trim()));
  ok(titles[0] === 'Scene Headings' && titles[1] === 'Annotations',
    `titles read Scene Headings then Annotations (${titles.join(' / ')})`);
  ok(!titles.includes('Filter Annotations'), 'the old "Filter Annotations" title is gone');

  // ── 2a. INT./EXT. segment ──
  await page.click('.markup-filter-pop .markup-seg button:has-text("EXT.")');
  await waitRows(2);
  let rows = await sceneRows();
  ok(rows.every((r) => r.includes('EXT.')), `EXT. keeps the two exteriors (${rows.length} rows)`);
  await page.click('.markup-filter-pop .markup-seg button:has-text("INT.")');
  await waitRows(2);
  rows = await sceneRows();
  ok(rows.every((r) => r.includes('INT.')), `INT. keeps the two interiors (${rows.length} rows)`);

  // ── 2b. Location dropdown — options + effect (stacks with INT.) ──
  const opts = await page.$$eval('.fs-nav-scnf-select option', (els) => els.map((e) => e.textContent));
  ok(opts[0] === 'All locations' && ['CARRIER - HANGER BAY', 'SPACE - BELKADAN', 'SPACE - OPENING SCROLL', 'SPACE CARRIER - BRIDGE']
      .every((l) => opts.includes(l)),
    `the dropdown lists every script location (${opts.length - 1} + All)`);
  await page.selectOption('.fs-nav-scnf-select', 'SPACE CARRIER - BRIDGE');
  await waitRows(1);
  rows = await sceneRows();
  ok(rows[0].includes('SPACE CARRIER - BRIDGE'), 'Location narrows to the one matching scene');

  // chip counts the two active scene filters
  const chip = await page.$eval('.markup-ctl-filter .tool-ctl-chip', (e) => e.textContent);
  ok(chip === '2', `the Filter chip counts the active scene filters (${chip})`);

  // ── 2c. Contains — alone ──
  await page.click('.markup-filter-pop .markup-seg button:has-text("All")');
  await page.selectOption('.fs-nav-scnf-select', '');
  await waitRows(4);
  await page.fill('.fs-nav-scnf-input', 'hanger');
  await waitRows(1);
  rows = await sceneRows();
  ok(rows[0].includes('HANGER BAY'), 'Contains "hanger" keeps only the hanger-bay scene');

  // ── 3. clearing restores everything ──
  await page.fill('.fs-nav-scnf-input', '');
  await waitRows(4);
  const chipGone = await page.$('.markup-ctl-filter .tool-ctl-chip');
  ok(!chipGone, 'cleared filters drop the chip and restore all 4 rows');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v568: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
