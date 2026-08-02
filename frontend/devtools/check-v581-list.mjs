/**
 * check-v581-list — Derek: "in the location list view, make the format the
 * same as the scene view: item name, an adjustable side column for
 * Description, and the text Times used: and then the number icon."
 *
 * The column-alignment assertion is the point: every row's Description field
 * must start at ONE x. That is what a fixed-track grid buys and what `auto`
 * tracks would quietly lose.
 */
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const { browser, page } = await launch({ width: 1400, height: 900, dpr: 2 });
try {
  await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
  await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover');
  await page.waitForTimeout(400);
  ok(await page.$('.location-list-header') !== null, '#5 the list has a column header, like Scenes');
  const heads = await page.$$eval('.location-list-header > *', (e) => e.map((x) => x.textContent.trim()).filter(Boolean));
  ok(heads.join(' · ').includes('Location') && heads.join(' · ').includes('Description'),
    `#5 headed ${heads.join(' · ')}`);
  ok(await page.$('.location-desc-field') !== null, '#5 every row has a Description field');
  const times = await page.$eval('.location-group .location-times', (e) => e.textContent.replace(/\s+/g, ' ').trim());
  ok(/^Times used:\s*\d+$/.test(times), `#5 the row reads "${times}"`);
  // the field writes the same description the Map sidebar shows
  await page.fill('.location-group:first-child .location-desc-field', 'Windswept ridge above the bay');
  await page.waitForTimeout(350);
  const stored = await page.evaluate(() => window.__scStore.getState().locationPlaces.map((p) => p.description).filter(Boolean));
  ok(stored[0] === 'Windswept ridge above the bay', `#5 typing a description stores it (${JSON.stringify(stored)})`);
  // columns line up: every row's description field starts at the same x
  const xs = await page.$$eval('.location-desc-field', (e) => [...new Set(e.map((x) => Math.round(x.getBoundingClientRect().x)))]);
  ok(xs.length === 1, `#5 the Description column starts at one x on every row (${xs.join(', ')})`);
  // and it is adjustable
  const grip = await page.$('.location-list-header .scene-col-grip');
  ok(grip !== null, '#5 the name column has a drag grip');
  const box = await grip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const xs2 = await page.$$eval('.location-desc-field', (e) => [...new Set(e.map((x) => Math.round(x.getBoundingClientRect().x)))]);
  ok(xs2.length === 1 && xs2[0] > xs[0] + 40, `#5 dragging it widens the column (${xs[0]} → ${xs2[0]})`);
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v581-list: ${pass} passed, ${fail} failed`);
await browser.close();
