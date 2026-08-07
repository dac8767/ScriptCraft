/* check-v606 — v6.06, Derek: dropping the floating Analytics window on a
   side panel must DOCK it (window leaves, tool lands inline, mode kept).
   The v1.2 ALWAYS_FLOAT early-out used to re-float it over the gesture. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL", m); } };
try {
  await boot(page); await seedScript(page, SCENES_4);
  await page.evaluate(() => window.__scStore.getState().openTool('analytics'));
  await settle(page);
  ok(await page.$('.tool-window') !== null, 'analytics opens floating (its default shape)');
  console.log('  pre-drag:', await page.evaluate(() => {
    const s = window.__scStore.getState();
    return JSON.stringify({ temp: s.tempTool, mode: s.toolMode.analytics ?? null });
  }));

  // drag the window header onto the RIGHT panel. Grab the TITLE, not the
  // header's center — v6.19 put the Overview/Scenes/Dialogue/Gender tabs in
  // the header, and a mousedown on a tab BUTTON is a click, not a drag
  // (same as any real user: you drag by the title or empty header).
  const head = await page.$eval('.tool-window .tool-window-title', (el) => {
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const dock = await page.$eval('.tool-dock-wrap.tool-dock-right', (el) => {
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(head.x, head.y);
  await page.mouse.down();
  /* v6.07: the temp window is CSS-centered (translateX(-50%)) — the switch
     to explicit left/top must kill the transform, or the window teleports
     half its width leftward on the first move and the grab point floats off
     its right edge for the whole drag. Assert 1:1 tracking. */
  const before = await page.$eval('.tool-window', (el) => el.getBoundingClientRect().left);
  await page.mouse.move(head.x + 40, head.y, { steps: 2 });
  await settle(page);
  const shift = (await page.$eval('.tool-window', (el) => el.getBoundingClientRect().left)) - before;
  ok(Math.abs(shift - 40) <= 2, `#v607 the window tracks the pointer 1:1 — no teleport (moved ${Math.round(shift)}px for 40px)`);
  await page.mouse.move(dock.x, dock.y, { steps: 12 });
  await settle(page);
  await page.mouse.up();
  await settle(page);

  const after = await page.evaluate(() => {
    const s = window.__scStore.getState();
    return {
      floating: !!document.querySelector('.tool-window'),
      inline: !!document.querySelector('.tool-inline[data-tool="analytics"]'),
      temp: s.tempTool, mode: s.toolMode.analytics,
      right: s.activeToolRight,
    };
  });
  console.log('  post-drop:', JSON.stringify(after));
  ok(!after.floating, 'the floating window LEFT on drop');
  ok(after.inline, 'and the tool renders inside the panel');
  ok(after.mode === 'docked' && after.temp === null, 'mode docked, no temp window');

  // close from the row, reopen from the row — the dock is remembered
  await page.click('[data-tool-row="analytics"]');
  await settle(page);
  ok(!(await page.evaluate(() => window.__scStore.getState().isToolOpen('analytics'))), 'row click closes it');
  await page.click('[data-tool-row="analytics"]');
  await settle(page);
  const re = await page.evaluate(() => ({
    inline: !!document.querySelector('.tool-inline[data-tool="analytics"]'),
    floating: !!document.querySelector('.tool-window'),
  }));
  ok(re.inline && !re.floating, 'reopening from the row lands in the panel, not a window');
  await page.screenshot({ path: '/tmp/v606-docked.png' });
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  await page.screenshot({ path: '/tmp/v606-err.png' }).catch(() => {});
} finally { await browser.close(); }
console.log(`\ncheck-v606: ${pass} passed, ${fail} failed`);
