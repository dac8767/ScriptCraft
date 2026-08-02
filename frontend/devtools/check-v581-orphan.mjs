/**
 * check-v581-orphan — connecting a location to a pin MOVES it off whatever
 * place held it. If that place is left with no location and no pin it is
 * unreachable, and the description typed in the List view would be stranded
 * on it, out of sight. The target absorbs it and the husk goes.
 */
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';
const MAP = writeMapFixture('/tmp/check-v577-map.png');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const { browser, page } = await launch({ width: 1500, height: 950 });
try {
  await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
  await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover');
  await settle(page);
  // write a description in the LIST view, then pin that location on the map
  await page.fill('.location-group:first-child .location-desc-field', 'Star-field prologue');
  await settle(page);
  const name = await page.$eval('.location-group:first-child .location-name', (e) => e.textContent.trim());
  if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]');
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")');
  await page.waitForSelector('.locmap');
  await page.setInputFiles('.locmap input[type="file"]', MAP);
  await page.waitForSelector('.locmap-import-bar');
  await page.click('.locmap-import-confirm');
  await page.waitForTimeout(400);
  const b = await page.$eval('.locmap-stage', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.click('.locmap-addpin-btn');
  await page.mouse.click(b.x + b.w * 0.4, b.y + b.h * 0.4);
  await settle(page);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Connect to location…")');
  await page.click(`.locmap-pin-menu .locmap-pin-menu-item:has-text("${name}")`);
  await page.waitForTimeout(350);
  const st = await page.evaluate(() => window.__scStore.getState().locationPlaces.map((p) => ({ n: p.scriptNames, d: p.description, x: p.x })));
  ok(st.length === 1, `no stray place is left behind (${st.length} place${st.length === 1 ? '' : 's'})`);
  ok(st[0].d === 'Star-field prologue', `and the description came with it ("${st[0].d}")`);
  const rows = await page.$$eval('.locmap-rail-item', (e) => e.map((x) => x.textContent.trim().slice(0, 22)));
  ok(!rows.some((r) => /Unnamed place/.test(r)), `no "Unnamed place" row (${rows.length} rows)`);
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v581-orphan: ${pass} passed, ${fail} failed`);
await browser.close();
