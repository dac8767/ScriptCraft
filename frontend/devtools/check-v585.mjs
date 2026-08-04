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
import { launch, boot, seedScript, openTool, SCENES_4, settle, dismiss } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';

/* v5.96: the option buttons live in the expanded row's BODY. Expanding an
   already-open row folds it, so collapse-first, expand, then press. */
async function railOption(page, rowSel, title) {
  await dismiss(page);   // an open filter/menu popup covers the rail's rows
  if (await page.$('.locmap-rail-item-open')) {
    await page.click('.locmap-rail-item-open .locmap-rail-name');
    await settle(page);
  }
  await page.locator(`${rowSel} .locmap-rail-name`).first().click();
  await page.waitForSelector('.locmap-rail-detail');
  await settle(page);
  await page.click(`.locmap-rail-detail button:has-text("${title}")`);
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

  // v5.97: fullscreen map — the rail lives in the LEFT PANEL now.
  ok(await page.$('.fs-tool-takeover .locmap-rail') === null,
    '#map the takeover holds no rail of its own');
  ok(await page.$('.locmap-rail-panel .locmap-rail') !== null,
    '#map the rail stands in the side panel (the scrapbook pattern)');
  await page.click('.locmap-rail-panel .locmap-rail-item:first-child .locmap-rail-name');
  await page.waitForSelector('.locmap-rail-detail');
  const btns = await page.$$eval('.locmap-rail-detail .locmap-detail-actions button', (e) => e.map((x) => x.title));
  ok(JSON.stringify(btns) === JSON.stringify(['Map options', 'Pin options']),
    `#1/#2 the expanded row's body leads with the two option buttons (${btns.join(' · ')})`);
  /* v6.00, Derek: the List view's dropdown block rides along under the
     buttons — the body is [actions, LocationPlaceDetails], nothing else. */
  const detailKids = await page.$eval('.locmap-rail-detail', (el) => [...el.children].map((c) => c.className.split(' ')[0]));
  ok(JSON.stringify(detailKids) === JSON.stringify(['locmap-detail-actions', 'locplace-details']),
    `#v600 the body leads with the buttons, then the List view's details block (${detailKids.join(' · ')})`);
  await page.click('.locmap-rail-detail button:has-text("Map Options")');
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

  await page.click('.tool-ctl[title="Filter locations"]');
  await page.waitForSelector('.locfilter-pop');
  const filterItems = await page.$$eval('.locfilter-pop .tool-ctl-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(filterItems.includes('Show hidden locations'), `#1 the Filter menu offers the way back (${filterItems.join(' · ')})`);
  await page.click('.locfilter-pop .tool-ctl-menu-item:text-is("Show hidden locations")');
  await settle(page);
  await dismiss(page);
  await settle(page);
  ok(await page.$$eval('.locmap-rail-item', (e) => e.length) === before,
    '#1 and the hidden row comes back');
  ok(await page.$('.locmap-rail-item-hidden') !== null, '#1 marked as hidden while it is shown');

  // unhide through the same menu
  await railOption(page, '.locmap-rail-item-hidden', 'Map Options');
  const backItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(backItems.includes('Show in locations list'), `#1 and the menu now offers to show it (${backItems.join(' · ')})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Show in locations list")');
  await settle(page);
  ok(!(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.hidden))), '#1 unhidden again');

  // ── the pin menu ────────────────────────────────────────────────────
  await railOption(page, '.locmap-rail-item:has(.locmap-rail-icon-pinned)', 'Pin Options');
  const pinItems = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(pinItems.length === 2 && /Lock pin/.test(pinItems[0]) && pinItems[1] === 'Delete pin',
    `#2 the pin menu offers ${pinItems.join(' · ')}`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Lock pin")');
  await settle(page);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.some((p) => p.locked)), '#2 it locks the pin');
  await railOption(page, '.locmap-rail-item:has(.locmap-rail-icon-pinned)', 'Pin Options');
  const locked = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(/Unlock pin/.test(locked[0]), `#2 and then offers to unlock (${locked[0]})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Unlock pin")');
  await settle(page);

  // delete the pin
  const pinnedBefore = await page.evaluate(() => window.__scStore.getState().locationPlaces.filter((p) => p.x !== null).length);
  await railOption(page, '.locmap-rail-item:has(.locmap-rail-icon-pinned)', 'Pin Options');
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Delete pin")');
  await settle(page);
  const pinnedAfter = await page.evaluate(() => window.__scStore.getState().locationPlaces.filter((p) => p.x !== null).length);
  ok(pinnedAfter === pinnedBefore - 1, `#2 Delete pin takes it off the map (${pinnedBefore} → ${pinnedAfter})`);

  // a row with no pin says so rather than pretending
  await railOption(page, '.locmap-rail-item:not(:has(.locmap-rail-icon-pinned))', 'Pin Options');
  ok(await page.$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.disabled),
    '#2 an unpinned row offers the items disabled, not silently dead');
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v585: ${pass} passed, ${fail} failed`);
await browser.close();

/* ── v5.97 additions, appended so one file covers the Locations window ──
   Run in a fresh browser: the main flow above leaves heavy state behind. */
{
  const { browser: b2, page: p2 } = await launch({ width: 1500, height: 950 });
  try {
    await boot(p2); await seedScript(p2, SCENES_4); await openTool(p2, 'Locations');
    await p2.click('button[title="Fullscreen"]'); await p2.waitForSelector('.fs-tool-takeover');
    await settle(p2);

    // item 1: the scenes list is gone from the expanded row
    await p2.click('.location-group .location-name');
    await p2.waitForSelector('.locplace-details');
    ok(await p2.$('.location-detail .location-scenes') === null,
      '#v597-1 the scene list is out of the expanded location row');

    // item 3: Location Group replaces Display Name — create, then ungroup
    const labels = await p2.$$eval('.locplace-details .locmap-field-label', (e) => e.map((x) => x.textContent.trim()));
    ok(labels.includes('Location Group') && !labels.includes('Display Name'),
      `#v597-3 the label reads Location Group (${labels.slice(0, 2).join(' · ')})`);
    ok(await p2.$('.locplace-details button:has-text("Create a group")') !== null,
      '#v597-3 with a Create a group button');
    const addBtn = await p2.$('.locplace-details button:has-text("Add to group")');
    ok(addBtn !== null && await addBtn.isDisabled(),
      '#v597-3 Add to group is disabled while no group exists');
    await p2.click('.locplace-details button:has-text("Create a group")');
    await p2.fill('.locplace-details .locmap-field-input', 'Belkadan System');
    await p2.keyboard.press('Enter');
    await settle(p2);
    ok(await p2.evaluate(() => window.__scStore.getState().locationPlaces.some((q) => q.displayName === 'Belkadan System')),
      '#v597-3 creating a group stores its name');
    ok(await p2.$('.locplace-details button:has-text("Ungroup")') !== null,
      '#v597-3 a grouped place offers Ungroup');

    // another row can now JOIN it
    await p2.click('.location-group .location-name');   // collapse
    await settle(p2);
    await p2.click('.location-group:nth-of-type(3) .location-name');
    await p2.waitForSelector('.locplace-details');
    const join = await p2.$('.locplace-details button:has-text("Add to group")');
    ok(join !== null && !(await join.isDisabled()), '#v597-3 Add to group is live once a group exists');
    await join.click();
    await p2.waitForSelector('.locmap-pin-menu');
    await p2.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Belkadan System")');
    await settle(p2);
    ok(await p2.evaluate(() => window.__scStore.getState().locationPlaces.find((q) => q.displayName === 'Belkadan System')?.scriptNames.length === 2),
      '#v597-3 joining merges the location into the group');

    // item 5: INT./EXT. chips on one row
    await dismiss(p2);
    await p2.click('.tool-ctl[title="Filter locations"]');
    await p2.waitForSelector('.locfilter-pop');
    const chips = await p2.$$eval('.locfilter-row .locfilter-chip', (e) => e.map((x) => x.textContent.trim()));
    ok(JSON.stringify(chips) === JSON.stringify(['INT.', 'EXT.']), `#v597-5 the chips read ${chips.join(' · ')}`);
    const before = await p2.$$eval('.location-group', (e) => e.length);
    await p2.click('.locfilter-row .locfilter-chip:has-text("INT.")');
    await settle(p2);
    const intOnly = await p2.$$eval('.location-group', (e) => e.length);
    ok(intOnly < before, `#v597-5 selecting INT. narrows the list (${before} → ${intOnly})`);
    await p2.click('.locfilter-row .locfilter-chip:has-text("EXT.")');
    await settle(p2);
    ok(await p2.$$eval('.location-group', (e) => e.length) === before,
      '#v597-5 selecting BOTH shows everything again');
    await p2.click('.locfilter-row .locfilter-chip:has-text("INT.")');
    await p2.click('.locfilter-row .locfilter-chip:has-text("EXT.")');
    await settle(p2);

    // item 6: the group option in the filter
    const groupItems = await p2.$$eval('.locfilter-pop .tool-ctl-menu-item', (e) => e.map((x) => x.textContent.trim()));
    ok(groupItems.includes('Belkadan System') && groupItems.includes('No Group'),
      `#v597-6 the filter offers the groups (${groupItems.join(' · ')})`);
    await p2.click('.locfilter-pop .tool-ctl-menu-item:has-text("Belkadan System")');
    await settle(p2);
    ok(await p2.$$eval('.location-group', (e) => e.length) === 2,
      '#v597-6 filtering to the group keeps its two locations');
    await p2.click('.locfilter-pop .tool-ctl-menu-item:has-text("Belkadan System")');
    await dismiss(p2);

    // item 2: fullscreen map — the rail stands in the side panel
    if (!(await p2.$('.tool-ctl-menu'))) await p2.click('.tool-ctl[title="View"]');
    await p2.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")');
    await p2.waitForSelector('.locmap');
    await settle(p2);
    ok(await p2.$('.fs-tool-takeover .locmap-rail') === null, '#v597-2 the takeover holds no rail');
    ok(await p2.$('.locmap-rail-panel .locmap-rail') !== null, '#v597-2 the rail stands in the side panel');
    ok(await p2.$('.tool-dock .locmap-rail-panel') !== null,
      '#v597-2 INSIDE the dock column — not a second column beside it (the v5.97 screenshot bug)');
    // v5.99, Derek: the panel hangs UNDER the Locations row, in whichever
    // dock holds the tool — not pinned to the top of the left panel.
    ok(await p2.$eval('.locmap-rail-panel', (el) => el.previousElementSibling?.getAttribute('data-tool-row')) === 'locations',
      '#v599 the panel sits directly under the Locations row');
    ok(await p2.$('.locmap-rail-panel .tool-inline-header') === null,
      '#v599 no second "Locations" header — the row above is the label');
    await p2.click('.locmap-rail-panel .locmap-rail-row .locmap-rail-name');
    await p2.waitForSelector('.locmap-rail-panel .locmap-rail-detail');
    ok(await p2.$('.locmap-rail-panel .locmap-rail-detail button:has-text("Map Options")') !== null,
      '#v597-2 and its rows still open their option buttons');
    ok(await p2.$('.locmap-rail-panel .locplace-details .locmap-field-textarea') !== null,
      '#v600 the panel rail carries the List view\'s details — description and all');
    // leaving fullscreen brings the inline rail back
    await p2.click('.tool-fs-header button[title="Return to editor"]');
    await settle(p2);
    ok(await p2.$('.locmap-rail-panel') === null, '#v597-2 the panel rail leaves with fullscreen');
  } catch (e) { console.log('  ✗ SCRIPT ERROR (v597):', e.message); fail++; }
  await b2.close();
  console.log(`\ncheck-v585 with v5.97: ${pass} passed, ${fail} failed`);
}
