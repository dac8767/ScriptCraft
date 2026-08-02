// check-v578 — Derek's six follow-ups on the Locations map.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';

const MAP = writeMapFixture('/tmp/check-v577-map.png');
const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`); cond ? pass++ : fail++; };
const places = () => page.evaluate(() => window.__scStore.getState().locationPlaces);
const menuItem = (t) => page.click(`.locmap-pin-menu .locmap-pin-menu-item:text-is("${t}")`);
const stageBox = () => page.$eval('.locmap-stage', (el) => {
  const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
});
/** Where the pin's MARKER actually sits, as a % across the map. */
const markerAt = (i = 0) => page.evaluate((idx) => {
  const el = document.querySelectorAll('.locmap-pin .locmap-pin-icon')[idx];
  const s = el.closest('.locmap-stage').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return Math.round(((r.left + r.width / 2) - s.left) / s.width * 1000) / 10;
}, i);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Locations');
  await page.click('button[title="Fullscreen"]');
  await page.waitForSelector('.fs-tool-takeover', { timeout: 8000 });
  if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]');
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")');
  await page.waitForSelector('.locmap', { timeout: 8000 });
  await page.setInputFiles('.locmap input[type="file"]', MAP);
  await page.waitForSelector('.locmap-import-bar', { timeout: 8000 });
  await page.click('.locmap-import-confirm');
  await settle(page);

  const rowCount = () => page.$$eval('.locmap-rail-item', (e) => e.length);
  const startRows = await rowCount();

  // ── 4. "+ Add Pin" ──────────────────────────────────────────────────
  ok(await page.$('.locmap-addpin-btn') !== null, '#4 there is a blue "+ Add Pin" button');
  const blue = await page.$eval('.locmap-addpin-btn', (el) => getComputedStyle(el).backgroundColor);
  ok(blue !== 'rgba(0, 0, 0, 0)' && blue !== 'transparent', `#4 in the blue button format (${blue})`);
  await page.click('.locmap-addpin-btn');
  await settle(page);
  ok((await places()).length === 0, '#4 arming does NOT place a pin yet');

  // the pin rides the cursor
  const b0 = await stageBox();
  await page.mouse.move(b0.x + b0.w * 0.4, b0.y + b0.h * 0.4);
  await settle(page);
  const ghost = await page.$('.locmap-pin-ghost');
  ok(ghost !== null, '#4 a ghost pin follows the cursor');
  const g1 = await page.$eval('.locmap-pin-ghost', (el) => el.getBoundingClientRect().x);
  await page.mouse.move(b0.x + b0.w * 0.6, b0.y + b0.h * 0.4);
  await settle(page);
  const g2 = await page.$eval('.locmap-pin-ghost', (el) => el.getBoundingClientRect().x);
  ok(Math.abs(g2 - g1) > 50, `#4 and it moves with the cursor (${Math.round(g1)} → ${Math.round(g2)})`);

  // clicking sets it
  await page.mouse.click(b0.x + b0.w * 0.5, b0.y + b0.h * 0.5);
  await settle(page);
  ok((await places()).length === 1, '#4 clicking the map sets the pin');
  ok(await page.$('.locmap-pin-ghost') === null, '#4 and the ghost is gone');
  ok(await page.$('.locmap-pin-menu') !== null, '#4 the new pin opens its dropdown');
  const centred = (await places())[0];
  ok(Math.abs(centred.x - 0.5) < 0.03 && Math.abs(centred.y - 0.5) < 0.03, '#4 where the cursor was');

  // ── 5. attaching must NOT move the marker ───────────────────────────
  await page.mouse.click(5, 5);                       // close the menu
  await settle(page);
  // put the pin near the left edge, where the old bug pushed it off
  const box = await stageBox();
  // Grab the pin by its own box: the marker sits ABOVE its anchor point (as
  // map pins do), so pressing at the point itself lands on the map.
  const dragPinTo = async (xf, yf) => {
    const p = await page.$eval('.locmap-pin', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.w * xf, box.y + box.h * yf, { steps: 8 });
    await page.mouse.up();
    await settle(page);
  };
  await dragPinTo(0.08, 0.5);
  ok((await places()).length === 1, '#4 dragging a pin does NOT drop a second one');
  const beforeAttach = await markerAt();
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Connect to location…');
  const attached = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await settle(page);
  const afterAttach = await markerAt();
  ok(Math.abs(beforeAttach - afterAttach) < 1,
    `#5 the marker stays put when a location is attached (${beforeAttach}% → ${afterAttach}%)`);
  ok(afterAttach > 0, `#5 and it is still ON the map (${afterAttach}%)`);

  // ── 1. one sidebar row per PLACE ────────────────────────────────────
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Connect to location…');
  const second = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await settle(page);
  ok((await places())[0].scriptNames.length === 2, `two locations on the pin (${attached} + ${second})`);
  ok(await rowCount() === startRows - 1,
    `#1 the sidebar shows ONE row for both (${await rowCount()} rows, was ${startRows})`);
  const badge = await page.$eval('.locmap-rail-badge', (e) => e.textContent.trim()).catch(() => null);
  ok(badge === '2', `#1 and the row carries the count (${badge})`);

  // ── 2. the expanded row lists its script locations ──────────────────
  await page.click('.locmap-rail-row:has(.locmap-rail-badge)');
  await page.waitForSelector('.locmap-rail-detail', { timeout: 5000 });
  const listed = await page.$$eval('.locmap-attached-name', (e) => e.map((x) => x.textContent.trim()));
  ok(listed.length === 2 && listed.includes(attached) && listed.includes(second),
    `#2 the expanded row lists both script locations (${listed.join(', ')})`);

  // ── 3. connect another script location FROM THE SIDEBAR ─────────────
  /* v5.85: "Connect to location" moved out of the expanded detail into the
     row's MAP-icon menu. */
  await page.mouse.click(6, 6).catch(() => {});
  await settle(page);
  await page.click('.locmap-rail-item:has(.locmap-rail-detail) .locmap-rail-btn[title="Map options"]');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Connect to location…")');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  const third = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await settle(page);
  ok((await places())[0].scriptNames.length === 3,
    `#3 the sidebar connects another location (${third} — now ${(await places())[0].scriptNames.length})`);

  // ── 6. the lock, from the sidebar AND the pin dropdown ──────────────
  /* v5.85: the lock lives in the row's PIN-icon menu now. */
  await page.mouse.click(6, 6).catch(() => {});
  await settle(page);
  await page.click('.locmap-rail-item:has(.locmap-rail-detail) .locmap-rail-btn[title="Pin options"]');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Lock pin")');
  await settle(page);
  ok((await places())[0].locked === true, '#6 the sidebar locks the pin');
  const lockedX = (await places())[0].x;
  await dragPinTo(0.8, 0.8);
  ok(Math.abs((await places())[0].x - lockedX) < 0.001, '#6 a locked pin refuses to be dragged');

  // The attempted drag was a press-without-move, so the locked pin has ALREADY
  // opened its dropdown — which is the only way back to unlocked, so check it.
  ok(await page.$('.locmap-pin-menu') !== null, '#6 a locked pin still opens its dropdown');
  const lockItem = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  ok(lockItem.some((t) => /Unlock this pin/.test(t)), `#6 the dropdown offers the lock too (${lockItem.find((t) => /lock/i.test(t))})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Unlock this pin")');
  await settle(page);
  ok((await places())[0].locked === false, '#6 and unlocks it again');
  await dragPinTo(0.75, 0.7);
  ok(Math.abs((await places())[0].x - 0.75) < 0.05, '#6 an unlocked pin drags normally again');
  // ── v5.79 #2: a pin in the RIGHT half draws on its own point, and
  //             locking it (which widens the capsule) doesn't move it ──
  const b4 = await stageBox();
  const idsBefore = new Set((await places()).map((p) => p.id));
  await page.click('.locmap-addpin-btn');
  await page.mouse.click(b4.x + b4.w * 0.85, b4.y + b4.h * 0.35);
  await settle(page);
  await menuItem('Connect to location…');
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await settle(page);
  // by ID, not by position — an earlier pin was dragged into the right half too
  const rightPin = (await places()).find((p) => !idsBefore.has(p.id));
  const drawnAt = await page.evaluate((id) => {
    const el = [...document.querySelectorAll('.locmap-pin')].find((n) => n.dataset.placeId === id);
    const s = el.closest('.locmap-stage').getBoundingClientRect();
    const m = el.querySelector('.locmap-pin-icon').getBoundingClientRect();
    return Math.round(((m.left + m.width / 2) - s.left) / s.width * 1000) / 10;
  }, rightPin.id);
  ok(Math.abs(drawnAt - rightPin.x * 100) < 1.5,
    `#2 a right-half pin draws ON its point (stored ${(rightPin.x * 100).toFixed(1)}%, drawn ${drawnAt}%)`);
  await page.evaluate((id) => window.__scStore.getState().toggleLocationPlaceLock(id), rightPin.id);
  await settle(page);
  const afterLock = await page.evaluate((id) => {
    const el = [...document.querySelectorAll('.locmap-pin')].find((n) => n.dataset.placeId === id);
    const s = el.closest('.locmap-stage').getBoundingClientRect();
    const m = el.querySelector('.locmap-pin-icon').getBoundingClientRect();
    return Math.round(((m.left + m.width / 2) - s.left) / s.width * 1000) / 10;
  }, rightPin.id);
  ok(Math.abs(afterLock - drawnAt) < 0.5, `#2 and LOCKING it does not move it (${drawnAt}% → ${afterLock}%)`);

  // ── v5.79 #1: "+ Connect to location" lists every script location AND
  //             the location groups ────────────────────────────────────
  // A GROUP is "locations linked together with one display name" — give the
  // other pin a display name so one exists to be offered.
  await page.evaluate((id) => window.__scStore.getState().updateLocationPlace(id, { displayName: 'The Bridge' }), rightPin.id);
  await settle(page);

  // (the row may already be open from the earlier assertions — clicking an
  //  open row closes it, so only open it if it isn't)
  if (!(await page.$('.locmap-rail-detail'))) await page.click('.locmap-rail-row:has(.locmap-rail-badge)');
  await page.waitForSelector('.locmap-rail-detail', { timeout: 5000 });
  await page.mouse.click(6, 6).catch(() => {});
  await settle(page);
  await page.click('.locmap-rail-item:has(.locmap-rail-detail) .locmap-rail-btn[title="Map options"]');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  const connectBtn = await page.$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.textContent.trim());
  ok(connectBtn === 'Connect to location…', `#1 the map menu leads with "${connectBtn}"`);
  /* v5.85: "Connect to location" moved out of the expanded detail into the
     row's MAP-icon menu. */
  await page.mouse.click(6, 6).catch(() => {});
  await settle(page);
  await page.click('.locmap-rail-item:has(.locmap-rail-detail) .locmap-rail-btn[title="Map options"]');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:text-is("Connect to location…")');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  const heads = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-subhead', (e) => e.map((x) => x.textContent.trim()));
  ok(heads.includes('Script locations') && heads.includes('Location groups'),
    `#1 the list has both sections (${heads.join(' / ')})`);
  const groupNames = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim()));
  ok(groupNames.includes('The Bridge'), `#1 and the group is offered by its display name (${groupNames.join(', ')})`);
  const offered = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim()));
  const alreadyPlaced = (await places()).filter((p) => p.x !== null).flatMap((p) => p.scriptNames);
  ok(offered.some((o) => alreadyPlaced.includes(o)),
    `#1 including locations that are already on the map (${offered.join(', ')})`);
  const fromHints = await page.$$eval('.locmap-pin-menu-item-from', (e) => e.map((x) => x.textContent.trim()));
  ok(fromHints.length > 0, `#1 and it says where one would move from (${fromHints.join(', ')})`);
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v578: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
