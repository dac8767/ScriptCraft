/**
 * check-v581 — Derek's Locations batch.
 *
 * #1 the pin lands where it was clicked. The bug it guards: the action row
 *    grew a line while armed, which pushed the map down; placing shrank it
 *    back and the pin appeared 26px above the click. So the assertion is not
 *    just "roughly right" — it measures that ARMING MOVES NOTHING.
 * #2 one press of + Add Pin, one pin.
 * #3 Map Options on that row: Replace Map (two sources) · Rotate · Delete.
 * #4 the sidebar's lock is an icon with a delete beside it.
 * #6 the sidebar's own title and count are gone (the header says both).
 *
 * The List view's table (#5) is check-v581-list.
 */
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';
const MAP = writeMapFixture('/tmp/map-land.png', 800, 600);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const { browser, page } = await launch({ width: 1500, height: 950 });
try {
  await boot(page); await seedScript(page, SCENES_4);
  await openTool(page, 'Locations');          // floating/docked — the shape that broke
  await page.waitForTimeout(400);
  if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]').catch(() => {});
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")').catch(() => {});
  await page.waitForSelector('.locmap');
  await page.setInputFiles('.locmap input[type="file"]', MAP);
  await page.waitForSelector('.locmap-import-bar');
  await page.click('.locmap-import-confirm');
  await page.waitForTimeout(400);

  const geom = () => page.evaluate(() => {
    const bar = document.querySelector('.locmap-actionbar').getBoundingClientRect();
    const st = document.querySelector('.locmap-stage').getBoundingClientRect();
    return { barH: Math.round(bar.height), top: Math.round(st.top) };
  });
  const g0 = await geom();
  await page.click('.locmap-addpin-btn');
  await page.waitForTimeout(250);
  const g1 = await geom();
  ok(g0.top === g1.top, `#1 arming does NOT move the map (top ${g0.top} → ${g1.top}, bar ${g0.barH} → ${g1.barH}px)`);

  const b = await page.$eval('.locmap-stage', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cx = Math.round(b.x + b.w * 0.5), cy = Math.round(b.y + b.h * 0.5);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(400);
  const tip = await page.evaluate(() => {
    const pin = document.querySelector('.locmap-pin:not(.locmap-pin-ghost)');
    const m = pin.querySelector('.locmap-pin-icon').getBoundingClientRect();
    return { x: Math.round(m.left + m.width / 2), y: Math.round(m.bottom) };
  });
  ok(Math.abs(tip.x - cx) <= 3 && Math.abs(tip.y - cy) <= 4,
    `#1 the pin lands where it was clicked (clicked ${cx},${cy} → tip ${tip.x},${tip.y})`);

  await page.mouse.click(6, 6).catch(() => {});
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__scStore.getState().locationPlaces.length);
  await page.mouse.click(cx + 20, cy + 12);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__scStore.getState().locationPlaces.length);
  ok(before === after, `#2 a plain click no longer drops a pin (${before} → ${after})`);
  await page.click('.locmap-addpin-btn');
  await page.mouse.click(cx + 20, cy + 12);
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.length) === after + 1,
    '#2 pressing + Add Pin again places the next one');
  await page.mouse.click(6, 6).catch(() => {});
  await page.waitForTimeout(200);

  // ── #3 Map Options ────────────────────────────────────────────────
  const optBtn = await page.$('.locmap-mapopts-btn');
  ok(optBtn !== null, '#3 "Map Options" sits on the + Add Pin row');
  const sameRow = await page.evaluate(() => {
    const a = document.querySelector('.locmap-addpin-btn').getBoundingClientRect();
    const b = document.querySelector('.locmap-mapopts-btn').getBoundingClientRect();
    return Math.abs(a.top - b.top) < 6;
  });
  ok(sameRow, '#3 on the same row as + Add Pin');
  await page.click('.locmap-mapopts-btn');
  await page.waitForSelector('.locmap-mapopts-menu');
  const items = await page.$$eval('.locmap-mapopts-menu button', (e) => e.map((x) => x.textContent.trim()));
  ok(JSON.stringify(items) === JSON.stringify(['Replace Map', 'Rotate 90 degrees', 'Delete Map']),
    `#3 offering ${items.join(' · ')}`);
  await page.click('.locmap-mapopts-menu button:text-is("Replace Map")');
  await page.waitForTimeout(200);
  const subs = await page.$$eval('.locmap-mapopts-menu button', (e) => e.map((x) => x.textContent.trim()));
  ok(subs.includes('From local device…') && subs.includes('From Asset Manager…'),
    `#3 Replace Map opens its two sources (${subs.join(' · ')})`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(6, 6).catch(() => {});
  await page.waitForTimeout(200);

  // rotate carries the pins round with the picture
  const beforeRot = await page.evaluate(() => window.__scStore.getState().locationPlaces.map((p) => [Math.round(p.x*100)/100, Math.round(p.y*100)/100]));
  await page.click('.locmap-mapopts-btn');
  await page.click('.locmap-mapopts-menu button:text-is("Rotate 90 degrees")');
  await page.waitForTimeout(400);
  const afterRot = await page.evaluate(() => ({
    rot: window.__scStore.getState().locationMapImage.rotation,
    pins: window.__scStore.getState().locationPlaces.map((p) => [Math.round(p.x*100)/100, Math.round(p.y*100)/100]),
  }));
  ok(afterRot.rot === 90, `#3 Rotate 90 degrees turns the map (rotation ${afterRot.rot})`);
  ok(JSON.stringify(afterRot.pins) !== JSON.stringify(beforeRot),
    `#3 and the pins turn with it (${JSON.stringify(beforeRot[0])} → ${JSON.stringify(afterRot.pins[0])})`);

  // ── #4 sidebar lock + delete ──────────────────────────────────────
  await page.click('.locmap-rail-row:has(.locmap-rail-icon-pinned)');
  await page.waitForSelector('.locmap-rail-detail');
  const tools = await page.$$eval('.locmap-pin-tools .locmap-pin-tool', (e) => e.map((x) => x.getAttribute('title')));
  ok(tools.length === 2 && tools[0] === "Lock pin's location" && tools[1] === 'Delete this pin',
    `#4 the row shows a lock icon and a delete (${tools.join(' · ')})`);
  ok(await page.$eval('.locmap-pin-tools .locmap-pin-tool', (e) => e.textContent.trim() === ''),
    '#4 icon only — no sentence on the button');
  await page.click('.locmap-pin-tools .locmap-pin-tool');
  await page.waitForTimeout(250);
  ok(await page.$eval('.locmap-pin-tools .locmap-pin-tool', (e) => e.getAttribute('title')) === "Unlock pin's location",
    '#4 and it flips to Unlock once locked');

  // ── #6 no title/count in the map sidebar ──────────────────────────
  ok(await page.$('.locmap-rail-head') === null, '#6 the sidebar LOCATIONS title and count are gone');
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v581: ${pass} passed, ${fail} failed`);
await browser.close();
