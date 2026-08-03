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
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';

/* v5.96: the option buttons live in the expanded row's BODY. Expanding an
   already-open row folds it, so collapse-first, expand, then press. */
async function railOption(page, rowSel, title) {
  if (await page.$('.locmap-rail-item-open')) {
    await page.click('.locmap-rail-item-open .locmap-rail-name');
    await settle(page);
  }
  await page.locator(`${rowSel} .locmap-rail-name`).first().click();
  await page.waitForSelector('.locmap-rail-detail');
  await settle(page);
  await page.click(`.locmap-rail-detail button[title="${title}"]`);
  await page.waitForSelector('.locmap-pin-menu');
  await settle(page);
}


const MAP = writeMapFixture('/tmp/check-v577-map.png');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const { browser, page } = await launch({ width: 1500, height: 950 });

try {
  await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
  await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover');
  await settle(page);

  // ── the List view ───────────────────────────────────────────────────
  const names = await page.$$eval('.location-group .location-name', (e) => e.map((x) => x.textContent.trim()));
  ok(names.length > 0 && names.every((n) => n === n.toUpperCase()),
    `#3 the list shows the script's own names (${names.slice(0, 2).join(' · ')})`);

  ok(await page.$('.tool-fs-header button:has-text("Group")') !== null,
    '#3 the Group button sits in the HEADER (v5.96), right of View');
  const headerOrder = await page.$$eval('.tool-fs-header .tool-ctl', (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  ok(headerOrder.indexOf('Group') > headerOrder.findIndex((t) => /List|Map/.test(t)),
    `#3 to the right of the View control (${headerOrder.slice(0, 3).join(' · ')})`);
  // give two locations one display name so grouping has something to do
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    const id = s.addLocationPin(0.4, 0.4);
    s.attachLocationToPlace(id, 'SPACE - OPENING SCROLL');
    s.attachLocationToPlace(id, 'SPACE - BELKADAN');
    s.updateLocationPlace(id, { displayName: 'Belkadan System' });
  });
  await settle(page);
  const ungrouped = await page.$$eval('.location-group .location-name', (e) => e.map((x) => x.textContent.trim()));
  ok(ungrouped.includes('SPACE - OPENING SCROLL') && !ungrouped.includes('Belkadan System'),
    '#3 ungrouped, each location still stands under its own name');
  ok(await page.$('.location-group-head') === null, '#3 and there are no group headings');

  await page.click('.tool-fs-header button:has-text("Group")');
  await settle(page);
  const heads = await page.$$eval('.location-group-head', (e) => e.map((x) => x.textContent.trim()));
  ok(heads.some((h) => h.includes('Belkadan System')), `#3 Group folds them under the display name (${heads.join(' · ')})`);
  ok(heads.some((h) => h.includes('No Group')),
    `#3 and everything without a group gathers under "No Group" (v5.96)`);
  ok(heads[heads.length - 1].includes('No Group'), '#3 with No Group at the end');
  const groupedNames = await page.$$eval('.location-group .location-name', (e) => e.map((x) => x.textContent.trim()));
  ok(groupedNames.includes('SPACE - OPENING SCROLL') && groupedNames.includes('SPACE - BELKADAN'),
    '#3 and the rows underneath still carry the FULL script names');
  await page.click('.tool-fs-header button:has-text("Group")');
  await settle(page);

  // ── the map sidebar's two row menus ─────────────────────────────────
  if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]');
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")');
  await page.waitForSelector('.locmap');
  await page.setInputFiles('.locmap input[type="file"]', MAP);
  await page.waitForSelector('.locmap-import-bar');
  await page.click('.locmap-import-confirm');
  await page.waitForTimeout(400);

  // v5.96: the options are the TOP ROW of the expanded row's body.
  await page.click('.locmap-rail-item:first-child .locmap-rail-name');
  await page.waitForSelector('.locmap-rail-detail');
  const btns = await page.$$eval('.locmap-rail-detail .locmap-detail-actions button', (e) => e.map((x) => x.title));
  ok(JSON.stringify(btns) === JSON.stringify(['Map options', 'Pin options']),
    `#1/#2 the expanded row's body leads with the two option buttons (${btns.join(' · ')})`);
  const detailKids = await page.$eval('.locmap-rail-detail', (el) => el.children.length);
  ok(detailKids === 1, `#4 and the body holds ONLY them — the fields moved to the panel (${detailKids} child)`);
  await page.click('.locmap-rail-detail button[title="Map options"]');
  await page.waitForSelector('.locmap-pin-menu');
  const mapItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(JSON.stringify(mapItems) === JSON.stringify(['Connect to location…', 'Hide from locations list']),
    `#1 the map menu offers ${mapItems.join(' · ')}`);

  // hide it — the row leaves the list, and the Filter brings it back
  const before = await page.$$eval('.locmap-rail-item', (e) => e.length);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Hide from locations list")');
  await settle(page);
  const after = await page.$$eval('.locmap-rail-item', (e) => e.length);
  ok(after === before - 1, `#1 hiding takes the row out of the list (${before} → ${after})`);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.hidden)),
    '#1 the place is kept, only marked hidden');

  await page.click('.tool-ctl[title="Show only interior or exterior locations"]');
  await page.waitForSelector('.tool-ctl-menu');
  const filterItems = await page.$$eval('.tool-ctl-menu .tool-ctl-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(filterItems.includes('Show hidden locations'), `#1 the Filter menu offers the way back (${filterItems.join(' · ')})`);
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Show hidden locations")');
  await settle(page);
  await page.mouse.click(6, 6).catch(() => {});
  await settle(page);
  ok(await page.$$eval('.locmap-rail-item', (e) => e.length) === before,
    '#1 and the hidden row comes back');
  ok(await page.$('.locmap-rail-item-hidden') !== null, '#1 marked as hidden while it is shown');

  // unhide through the same menu
  await railOption(page, '.locmap-rail-item-hidden', 'Map options');
  const backItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(backItems.includes('Show in locations list'), `#1 and the menu now offers to show it (${backItems.join(' · ')})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Show in locations list")');
  await settle(page);
  ok(!(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.hidden))), '#1 unhidden again');

  // ── the pin menu ────────────────────────────────────────────────────
  await railOption(page, '.locmap-rail-item:has(.locmap-rail-icon-pinned)', 'Pin options');
  const pinItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(pinItems.length === 2 && /Lock pin/.test(pinItems[0]) && pinItems[1] === 'Delete pin',
    `#2 the pin menu offers ${pinItems.join(' · ')}`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Lock pin")');
  await settle(page);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.locked)), '#2 it locks the pin');
  await railOption(page, '.locmap-rail-item:has(.locmap-rail-icon-pinned)', 'Pin options');
  const locked = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(/Unlock pin/.test(locked[0]), `#2 and then offers to unlock (${locked[0]})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Unlock pin")');
  await settle(page);

  // delete the pin
  const pinnedBefore = await page.evaluate(() => window.__scStore.getState().locationPlaces.filter((p) => p.x !== null).length);
  await railOption(page, '.locmap-rail-item:has(.locmap-rail-icon-pinned)', 'Pin options');
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Delete pin")');
  await settle(page);
  const pinnedAfter = await page.evaluate(() => window.__scStore.getState().locationPlaces.filter((p) => p.x !== null).length);
  ok(pinnedAfter === pinnedBefore - 1, `#2 Delete pin takes it off the map (${pinnedBefore} → ${pinnedAfter})`);

  // a row with no pin says so rather than pretending
  await railOption(page, '.locmap-rail-item:not(:has(.locmap-rail-icon-pinned))', 'Pin options');
  ok(await page.$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.disabled),
    '#2 an unpinned row offers the items disabled, not silently dead');
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v585: ${pass} passed, ${fail} failed`);
await browser.close();
