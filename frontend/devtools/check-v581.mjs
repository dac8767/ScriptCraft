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
import { launch, boot, seedScript, openTool, SCENES_4, settle, dismiss } from './driver.mjs';
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
  await page.waitForSelector('canvas.locmap-img', { timeout: 8000 });
  await page.waitForTimeout(400);

  const geom = () => page.evaluate(() => {
    const bar = document.querySelector('.locmap-actionbar').getBoundingClientRect();
    const st = document.querySelector('.locmap-stage').getBoundingClientRect();
    return { barH: Math.round(bar.height), top: Math.round(st.top) };
  });
  const g0 = await geom();
  await page.click('.locmap-addpin-btn');
  await settle(page);
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

  await dismiss(page);
  await settle(page);
  const before = await page.evaluate(() => window.__scStore.getState().locationPlaces.length);
  await page.mouse.click(cx + 20, cy + 12);
  await settle(page);
  const after = await page.evaluate(() => window.__scStore.getState().locationPlaces.length);
  ok(before === after, `#2 a plain click no longer drops a pin (${before} → ${after})`);
  await page.click('.locmap-addpin-btn');
  await page.mouse.click(cx + 20, cy + 12);
  await settle(page);
  ok(await page.evaluate(() => window.__scStore.getState().locationPlaces.length) === after + 1,
    '#2 pressing + Add Pin again places the next one');
  await dismiss(page);
  await settle(page);

  // ── #3 Map Options ────────────────────────────────────────────────
  const optBtn = await page.$('.locmap-mapopts-btn');
  ok(optBtn !== null, '#3 the "Options" button exists');
  /* v6.38, Derek: moved INTO the window header (reversing v5.81) — so NOT
     on the + Add Pin row anymore. */
  const inHeader = await page.evaluate(() => {
    const b = document.querySelector('.locmap-mapopts-btn');
    return !!b && !!b.closest('.tool-inline-header, .tool-window-header, .tool-fs-header');
  });
  ok(inHeader, '#3 and it sits in the window header (v6.38)');
  await page.click('.locmap-mapopts-btn');
  await page.waitForSelector('.locmap-mapopts-menu');
  const items = await page.$$eval('.locmap-mapopts-menu button', (e) => e.map((x) => x.textContent.trim()));
  ok(JSON.stringify(items) === JSON.stringify(['Replace Map', 'Rotate 90 degrees', 'Delete Map']),
    `#3 offering ${items.join(' · ')}`);
  await page.click('.locmap-mapopts-menu button:text-is("Replace Map")');
  await settle(page);
  const subs = await page.$$eval('.locmap-mapopts-menu button', (e) => e.map((x) => x.textContent.trim()));
  ok(subs.includes('From local device…') && subs.includes('From Asset Manager…'),
    `#3 Replace Map opens its two sources (${subs.join(' · ')})`);
  await page.keyboard.press('Escape').catch(() => {});
  await dismiss(page);
  await settle(page);

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
  await dismiss(page);
  await settle(page);
  // a row may already be open from an earlier step, and clicking an open
  // row folds it shut — collapse first, then open the pinned one.
  if (await page.$('.locmap-rail-item-open')) {
    await page.click('.locmap-rail-item-open .locmap-rail-row');
    await settle(page);
  }
  await page.locator('.locmap-rail-row:has(.locmap-rail-icon-pinned) .locmap-rail-name').first().click();
  await page.waitForSelector('.locmap-rail-detail');
  /* v5.85, Derek: the lock/delete pair moved off the expanded row into the
     row header's PIN-icon menu — same two actions, one gesture earlier. */
  await dismiss(page);
  await settle(page);
  await page.click('.locmap-rail-item-open .locmap-rail-menu-btn');
  await page.waitForSelector('.locmap-pin-menu');
  const tools = await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.map((x) => x.textContent.trim()));
  /* v6.38: the ⋮ menu combines Map+Pin options; lock + delete close it. */
  ok(tools.length === 4 && /Lock pin/.test(tools[2]) && tools[3] === 'Delete pin',
    `#4 the ⋮ menu carries the lock and the delete (${tools.join(' · ')})`);
  await page.click('.locmap-pin-menu .locmap-pin-menu-item:has-text("Lock pin")');
  await settle(page);
  await dismiss(page);
  await settle(page);
  await page.click('.locmap-rail-item-open .locmap-rail-menu-btn');
  await page.waitForSelector('.locmap-pin-menu');
  ok(await page.$$eval('.locmap-pin-menu .locmap-pin-menu-item', (e) => e.some((x) => /Unlock pin/.test(x.textContent))),
    '#4 and it flips to Unlock once locked');
  await dismiss(page);

  // ── #6 no title/count in the map sidebar ──────────────────────────
  ok(await page.$('.locmap-rail-head') === null, '#6 the sidebar LOCATIONS title and count are gone');
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
console.log(`\ncheck-v581: ${pass} passed, ${fail} failed`);
await browser.close();
