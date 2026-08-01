// check-v578 — Derek's six follow-ups on the Locations map.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const MAP = '/tmp/check-v577-map.png';     // written by check-v577
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
  await page.waitForTimeout(300);

  const rowCount = () => page.$$eval('.locmap-rail-item', (e) => e.length);
  const startRows = await rowCount();

  // ── 4. "+ Add Pin" ──────────────────────────────────────────────────
  ok(await page.$('.locmap-actionbar button') !== null, '#4 there is an "+ Add Pin" button');
  await page.click('.locmap-actionbar button');
  await page.waitForTimeout(250);
  ok((await places()).length === 1, '#4 the button drops a pin');
  ok(await page.$('.locmap-pin-menu') !== null, '#4 and opens its dropdown');
  const centred = (await places())[0];
  ok(Math.abs(centred.x - 0.5) < 0.01 && Math.abs(centred.y - 0.5) < 0.01, '#4 in the middle of the map');

  // ── 5. attaching must NOT move the marker ───────────────────────────
  await page.mouse.click(5, 5);                       // close the menu
  await page.waitForTimeout(200);
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
    await page.waitForTimeout(250);
  };
  await dragPinTo(0.08, 0.5);
  ok((await places()).length === 1, '#4 dragging a pin does NOT drop a second one');
  const beforeAttach = await markerAt();
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Add a script location…');
  const attached = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await page.waitForTimeout(300);
  const afterAttach = await markerAt();
  ok(Math.abs(beforeAttach - afterAttach) < 1,
    `#5 the marker stays put when a location is attached (${beforeAttach}% → ${afterAttach}%)`);
  ok(afterAttach > 0, `#5 and it is still ON the map (${afterAttach}%)`);

  // ── 1. one sidebar row per PLACE ────────────────────────────────────
  await page.click('.locmap-pin');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  await menuItem('Add a script location…');
  const second = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await page.waitForTimeout(300);
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
  await page.click('.locmap-rail-detail .locmap-add-field:has-text("Connect a script location")');
  await page.waitForSelector('.locmap-pin-menu', { timeout: 5000 });
  const third = (await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item-name', (e) => e.map((x) => x.textContent.trim())))[0];
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has(.locmap-pin-menu-item-name)');
  await page.waitForTimeout(300);
  ok((await places())[0].scriptNames.length === 3,
    `#3 the sidebar connects another location (${third} — now ${(await places())[0].scriptNames.length})`);

  // ── 6. the lock, from the sidebar AND the pin dropdown ──────────────
  await page.click('.locmap-rail-detail .locmap-add-field:has-text("Lock this pin")');
  await page.waitForTimeout(250);
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
  await page.waitForTimeout(250);
  ok((await places())[0].locked === false, '#6 and unlocks it again');
  await dragPinTo(0.75, 0.7);
  ok(Math.abs((await places())[0].x - 0.75) < 0.05, '#6 an unlocked pin drags normally again');
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v578: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
