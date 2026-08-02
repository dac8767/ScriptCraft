/**
 * check-v582 — the pin lands on the click, whatever the map's shape.
 *
 * Derek's report: the dropdown appeared at the click (it is placed from
 * clientX/clientY) while the pin sat at the very top of the map (placed from
 * clientY minus a measured rect top, clamped). The guard here is that the
 * two agree: the MENU's corner and the pin's marker must describe the same
 * point, across map shapes and window sizes.
 */
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
import { writeMapFixture } from './mapFixture.mjs';

const MAPS = {
  square: writeMapFixture('/tmp/map-square.png', 1024, 1024),
  tall: writeMapFixture('/tmp/map-tall.png', 700, 1500),
  wide: writeMapFixture('/tmp/map-wide2.png', 1800, 600),
};
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

async function run(label, { map, w, h, fullscreen = true, rotate = false }) {
  const { browser, page } = await launch({ width: w, height: h });
  try {
    await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
    if (fullscreen) { await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover'); }
    await page.waitForTimeout(300);
    if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]').catch(() => {});
    await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")').catch(() => {});
    await page.waitForSelector('.locmap', { timeout: 8000 });
    await page.setInputFiles('.locmap input[type="file"]', MAPS[map]);
    await page.waitForSelector('.locmap-import-bar', { timeout: 8000 });
    await page.click('.locmap-import-confirm');
    await page.waitForTimeout(500);
    if (rotate) {
      await page.click('.locmap-mapopts-btn');
      await page.click('.locmap-mapopts-menu button:text-is("Rotate 90 degrees")');
      await page.waitForTimeout(400);
      await page.mouse.click(4, 4).catch(() => {});
    }
    const b = await page.$eval('.locmap-stage', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    for (const [fx, fy] of [[0.53, 0.46], [0.12, 0.08], [0.9, 0.93]]) {
      const cx = Math.round(b.x + b.w * fx), cy = Math.round(b.y + b.h * fy);
      await page.click('.locmap-addpin-btn');
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(120);
      // the GHOST must already be on the point the pin will take
      const ghostTip = await page.evaluate(() => {
        const g = document.querySelector('.locmap-pin-ghost');
        if (!g) return null;
        const m = g.querySelector('.locmap-pin-icon').getBoundingClientRect();
        return [Math.round(m.left + m.width / 2), Math.round(m.bottom)];
      });
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(300);
      const res = await page.evaluate(() => {
        const pins = document.querySelectorAll('.locmap-pin:not(.locmap-pin-ghost)');
        const pin = pins[pins.length - 1];
        const m = pin.querySelector('.locmap-pin-icon').getBoundingClientRect();
        const menu = document.querySelector('.locmap-pin-menu')?.getBoundingClientRect();
        return { tip: [Math.round(m.left + m.width / 2), Math.round(m.bottom)],
                 menu: menu ? [Math.round(menu.left), Math.round(menu.top)] : null };
      });
      const dx = res.tip[0] - cx, dy = res.tip[1] - cy;
      ok(Math.abs(dx) <= 4 && Math.abs(dy) <= 6,
        `${label} @(${fx},${fy}) pin lands on the click (Δ ${dx},${dy})`);
      if (ghostTip) ok(Math.abs(ghostTip[0] - res.tip[0]) <= 3 && Math.abs(ghostTip[1] - res.tip[1]) <= 3,
        `${label} @(${fx},${fy}) the pin takes the ghost's place (ghost ${ghostTip} → pin ${res.tip})`);
      // the menu is placed from clientX/clientY — pin and menu must agree
      if (res.menu) ok(Math.abs(res.menu[0] - cx) <= 260 && Math.abs(res.menu[1] - (cy + 10)) <= 300,
        `${label} @(${fx},${fy}) the menu opens at the same click`);
      await page.mouse.click(4, 4).catch(() => {});
      await page.waitForTimeout(150);
    }
    ok(await page.$eval('.locmap-img-wrap', (el) => getComputedStyle(el).pointerEvents) === 'none',
      `${label} the picture takes no pointer events — the stage is the target`);
  } catch (e) { console.log(`  ✗ SCRIPT ERROR (${label}):`, e.message); fail++; }
  await browser.close();
}

await run('1731×1113 square', { map: 'square', w: 1731, h: 1113 });
await run('tall map', { map: 'tall', w: 1440, h: 900 });
await run('wide map', { map: 'wide', w: 1200, h: 1000 });
await run('rotated 90°', { map: 'square', w: 1440, h: 900, rotate: true });
await run('floating window', { map: 'square', w: 1440, h: 900, fullscreen: false });
console.log(`\ncheck-v582: ${pass} passed, ${fail} failed`);

// A press that wobbles (every trackpad click) must still be a PRESS: the pin
// stays put and its dropdown opens.
{
  const { browser, page } = await launch({ width: 1440, height: 900 });
  try {
    await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
    await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover');
    await page.waitForTimeout(300);
    if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]').catch(() => {});
    await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")').catch(() => {});
    await page.waitForSelector('.locmap', { timeout: 8000 });
    await page.setInputFiles('.locmap input[type="file"]', MAPS.square);
    await page.waitForSelector('.locmap-import-bar', { timeout: 8000 });
    await page.click('.locmap-import-confirm');
    await page.waitForTimeout(400);
    const b = await page.$eval('.locmap-stage', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const cx = Math.round(b.x + b.w * 0.5), cy = Math.round(b.y + b.h * 0.5);
    await page.click('.locmap-addpin-btn');
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);
    await page.mouse.click(4, 4).catch(() => {});
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => { const p = window.__scStore.getState().locationPlaces[0]; return [Math.round(p.x*1000), Math.round(p.y*1000)]; });
    // press the pin, wobble 2px, release — a trackpad click
    const pin = await page.$eval('.locmap-pin:not(.locmap-pin-ghost)', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; });
    await page.mouse.move(pin.x, pin.y);
    await page.mouse.down();
    await page.mouse.move(pin.x + 2, pin.y + 1);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const p = window.__scStore.getState().locationPlaces[0]; return [Math.round(p.x*1000), Math.round(p.y*1000)]; });
    ok(before[0] === after[0] && before[1] === after[1], `a 2px click wobble does not move the pin (${before} → ${after})`);
    ok(await page.$('.locmap-pin-menu') !== null, 'and the press still opens its dropdown');
    // a real drag still moves it
    await page.mouse.click(4, 4).catch(() => {});
    await page.waitForTimeout(200);
    await page.mouse.move(pin.x, pin.y);
    await page.mouse.down();
    await page.mouse.move(pin.x + 60, pin.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const dragged = await page.evaluate(() => { const p = window.__scStore.getState().locationPlaces[0]; return [Math.round(p.x*1000), Math.round(p.y*1000)]; });
    ok(dragged[0] !== after[0] || dragged[1] !== after[1], `a real drag still moves it (${after} → ${dragged})`);
  } catch (e) { console.log('  ✗ SCRIPT ERROR (wobble):', e.message); fail++; }
  await browser.close();
}
console.log(`\ncheck-v582 total: ${pass} passed, ${fail} failed`);

/* ── Derek's failure, manufactured (v5.83) ────────────────────────────
   His pin's x was right and its y sat on the map's top edge — the shape of
   a stage measurement whose left/width are sound and whose TOP is not. That
   cannot be reproduced in Chromium, so here it is forced: the stage's client
   rect is made to report a top 400px below the truth, exactly the lie the
   symptom implies. The pin must still land under the cursor.                */
{
  const { browser, page } = await launch({ width: 1731, height: 1113 });
  try {
    await boot(page); await seedScript(page, SCENES_4); await openTool(page, 'Locations');
    await page.click('button[title="Fullscreen"]'); await page.waitForSelector('.fs-tool-takeover');
    await page.waitForTimeout(300);
    if (!(await page.$('.tool-ctl-menu'))) await page.click('.tool-ctl[title="View"]').catch(() => {});
    await page.click('.tool-ctl-menu .tool-ctl-menu-item:text-is("Map")').catch(() => {});
    await page.waitForSelector('.locmap', { timeout: 8000 });
    await page.setInputFiles('.locmap input[type="file"]', MAPS.square);
    await page.waitForSelector('.locmap-import-bar', { timeout: 8000 });
    await page.click('.locmap-import-confirm');
    await page.waitForTimeout(400);
    const b = await page.$eval('.locmap-stage', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.evaluate(() => {
      const stage = document.querySelector('.locmap-stage');
      const real = stage.getBoundingClientRect.bind(stage);
      Object.defineProperty(stage, 'getBoundingClientRect', {
        value: () => { const r = real(); return new DOMRect(r.x, r.y + 400, r.width, r.height); },
      });
    });
    const cx = Math.round(b.x + b.w * 0.34), cy = Math.round(b.y + b.h * 0.33);
    await page.click('.locmap-addpin-btn');
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(150);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(350);
    const res = await page.evaluate(() => {
      const p = window.__scStore.getState().locationPlaces.filter((q) => q.x !== null).pop();
      const pin = document.querySelector('.locmap-pin:not(.locmap-pin-ghost)');
      const m = pin?.querySelector('.locmap-pin-icon')?.getBoundingClientRect();
      return { stored: [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000],
               tip: m ? [Math.round(m.left + m.width / 2), Math.round(m.bottom)] : null };
    });
    ok(res.stored[1] > 0.05, `a lying rect cannot pin the marker to the top edge (y ${res.stored[1]})`);
    ok(Math.abs(res.tip[0] - cx) <= 4 && Math.abs(res.tip[1] - cy) <= 6,
      `and the pin still lands on the click (Δ ${res.tip[0] - cx},${res.tip[1] - cy})`);
  } catch (e) { console.log('  ✗ SCRIPT ERROR (lying rect):', e.message); fail++; }
  await browser.close();
}
console.log(`\ncheck-v582 with the v5.83 guard: ${pass} passed, ${fail} failed`);
