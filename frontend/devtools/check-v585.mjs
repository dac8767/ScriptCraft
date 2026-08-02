/**
 * check-v585 — Derek's Locations batch:
 *   · a MAP icon on each sidebar row → Connect to location · Hide from list
 *   · a PIN icon on each sidebar row → Lock/Unlock pin · Delete pin
 *   · the List view shows the FULL location name, always, and a Group button
 *     folds locations under their display name.
 *
 * Hiding must never be a one-way door, so the Filter menu's way back is
 * asserted too.
 */
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';

const MAP = writeMapFixture('/tmp/check-v577-map.png');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const { browser, page } = await launch({ width: 1500, height: 950 });

try {
  await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
  await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover');
  await page.waitForTimeout(300);

  // ── the List view ───────────────────────────────────────────────────
  const names = await page.$$eval('.location-group .location-name', (e) => e.map((x) => x.textContent.trim()));
  ok(names.length > 0 && names.every((n) => n === n.toUpperCase()),
    `#3 the list shows the script's own names (${names.slice(0, 2).join(' · ')})`);

  ok(await page.$('.tool-action-row button:text-is("Group")') !== null, '#3 there is a Group button');
  // give two locations one display name so grouping has something to do
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    const id = s.addLocationPin(0.4, 0.4);
    s.attachLocationToPlace(id, 'SPACE - OPENING SCROLL');
    s.attachLocationToPlace(id, 'SPACE - BELKADAN');
    s.updateLocationPlace(id, { displayName: 'Belkadan System' });
  });
  await page.waitForTimeout(300);
  const ungrouped = await page.$$eval('.location-group .location-name', (e) => e.map((x) => x.textContent.trim()));
  ok(ungrouped.includes('SPACE - OPENING SCROLL') && !ungrouped.includes('Belkadan System'),
    '#3 ungrouped, each location still stands under its own name');
  ok(await page.$('.location-group-head') === null, '#3 and there are no group headings');

  await page.click('.tool-action-row button:text-is("Group")');
  await page.waitForTimeout(300);
  const heads = await page.$$eval('.location-group-head', (e) => e.map((x) => x.textContent.trim()));
  ok(heads.some((h) => h.includes('Belkadan System')), `#3 Group folds them under the display name (${heads.join(' · ')})`);
  const groupedNames = await page.$$eval('.location-group .location-name', (e) => e.map((x) => x.textContent.trim()));
  ok(groupedNames.includes('SPACE - OPENING SCROLL') && groupedNames.includes('SPACE - BELKADAN'),
    '#3 and the rows underneath still carry the FULL script names');
  await page.click('.tool-action-row button:text-is("Group")');
  await page.waitForTimeout(250);

  // ── the map sidebar's two row menus ─────────────────────────────────
  if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]');
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")');
  await page.waitForSelector('.locmap');
  await page.setInputFiles('.locmap input[type="file"]', MAP);
  await page.waitForSelector('.locmap-import-bar');
  await page.click('.locmap-import-confirm');
  await page.waitForTimeout(400);

  const btns = await page.$$eval('.locmap-rail-item:first-child .locmap-rail-btn', (e) => e.map((x) => x.title));
  ok(JSON.stringify(btns) === JSON.stringify(['Map options', 'Pin options']),
    `#1/#2 every row carries a map icon and a pin icon (${btns.join(' · ')})`);

  await page.click('.locmap-rail-item:first-child .locmap-rail-btn[title="Map options"]');
  await page.waitForSelector('.locmap-pin-menu');
  const mapItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(JSON.stringify(mapItems) === JSON.stringify(['Connect to location…', 'Hide from locations list']),
    `#1 the map menu offers ${mapItems.join(' · ')}`);

  // hide it — the row leaves the list, and the Filter brings it back
  const before = await page.$$eval('.locmap-rail-item', (e) => e.length);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Hide from locations list")');
  await page.waitForTimeout(300);
  const after = await page.$$eval('.locmap-rail-item', (e) => e.length);
  ok(after === before - 1, `#1 hiding takes the row out of the list (${before} → ${after})`);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.hidden)),
    '#1 the place is kept, only marked hidden');

  await page.click('.tool-ctl[title="Show only interior or exterior locations"]');
  await page.waitForSelector('.tool-ctl-menu');
  const filterItems = await page.$$eval('.tool-ctl-menu .tool-ctl-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(filterItems.includes('Show hidden locations'), `#1 the Filter menu offers the way back (${filterItems.join(' · ')})`);
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Show hidden locations")');
  await page.waitForTimeout(300);
  await page.mouse.click(6, 6).catch(() => {});
  await page.waitForTimeout(200);
  ok(await page.$$eval('.locmap-rail-item', (e) => e.length) === before,
    '#1 and the hidden row comes back');
  ok(await page.$('.locmap-rail-item-hidden') !== null, '#1 marked as hidden while it is shown');

  // unhide through the same menu
  await page.click('.locmap-rail-item-hidden .locmap-rail-btn[title="Map options"]');
  await page.waitForSelector('.locmap-pin-menu');
  const backItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(backItems.includes('Show in locations list'), `#1 and the menu now offers to show it (${backItems.join(' · ')})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Show in locations list")');
  await page.waitForTimeout(300);
  ok(!(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.hidden))), '#1 unhidden again');

  // ── the pin menu ────────────────────────────────────────────────────
  await page.click('.locmap-rail-item:has(.locmap-rail-icon-pinned) .locmap-rail-btn[title="Pin options"]');
  await page.waitForSelector('.locmap-pin-menu');
  const pinItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(pinItems.length === 2 && /Lock pin/.test(pinItems[0]) && pinItems[1] === 'Delete pin',
    `#2 the pin menu offers ${pinItems.join(' · ')}`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Lock pin")');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.locked)), '#2 it locks the pin');
  await page.click('.locmap-rail-item:has(.locmap-rail-icon-pinned) .locmap-rail-btn[title="Pin options"]');
  await page.waitForSelector('.locmap-pin-menu');
  const locked = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(/Unlock pin/.test(locked[0]), `#2 and then offers to unlock (${locked[0]})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Unlock pin")');
  await page.waitForTimeout(250);

  // delete the pin
  const pinnedBefore = await page.evaluate(() => window.__scStore.getState().locationPlaces.filter((p) => p.x !== null).length);
  await page.click('.locmap-rail-item:has(.locmap-rail-icon-pinned) .locmap-rail-btn[title="Pin options"]');
  await page.waitForSelector('.locmap-pin-menu');
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Delete pin")');
  await page.waitForTimeout(300);
  const pinnedAfter = await page.evaluate(() => window.__scStore.getState().locationPlaces.filter((p) => p.x !== null).length);
  ok(pinnedAfter === pinnedBefore - 1, `#2 Delete pin takes it off the map (${pinnedBefore} → ${pinnedAfter})`);

  // a row with no pin says so rather than pretending
  await page.click('.locmap-rail-item:not(:has(.locmap-rail-icon-pinned)) .locmap-rail-btn[title="Pin options"]');
  await page.waitForSelector('.locmap-pin-menu');
  ok(await page.$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.disabled),
    '#2 an unpinned row offers the items disabled, not silently dead');
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v585: ${pass} passed, ${fail} failed`);
await browser.close();
