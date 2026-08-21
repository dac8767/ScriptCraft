// devtools/check-v535.mjs — Derek: "if there is a tool in a side panel
// toggled open, and i click into the script, that tool window should stay
// open." Docked panel tools survive script clicks; FLOATING windows (slot
// and temp) still dismiss — that behavior is pinned here too.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

const state = () => page.evaluate(() => {
  const s = window.__scStore.getState();
  return { left: s.activeTool, right: s.activeToolRight, temp: s.tempTool };
});

// ── docked RIGHT (Annotations) stays open through a script click ─────────
await openTool(page, 'Annotations');
ok((await state()).right === 'markups', 'Annotations docked right');
await page.click('.editor-center .ProseMirror');
await settle(page);
const afterRight = await state();
ok(afterRight.right === 'markups', 'still open after clicking into the script');
ok(await page.$('.markup-ctl-filter') !== null, 'and its panel body is still rendered');

// ── docked LEFT (Navigator) stays open too ───────────────────────────────
await openTool(page, 'Navigator');
ok((await state()).left === 'navigator', 'Navigator docked left');
await page.click('.editor-center .ProseMirror');
await settle(page);
ok((await state()).left === 'navigator', 'still open after clicking into the script');

// ── a FLOATING slot window still dismisses on a script click ─────────────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolMode('sticky', 'floating');
  s.openTool('sticky');
});
await settle(page);
ok((await state()).right === 'sticky', 'Sticky Notes opened as a floating window');
await page.click('.editor-center .ProseMirror');
await settle(page);
ok((await state()).right === null, 'floating window closed by the script click (unchanged rule)');

// ── a TEMP window (always-float tool) still dismisses too ────────────────
await page.evaluate(() => window.__scStore.getState().openTool('analytics'));
await settle(page);
ok((await state()).temp === 'analytics', 'Analytics opened as a temp window');
/* The temp window overlays the editor's middle — click a spot the window is
   provably NOT over. v7.70: this used to be a fixed offset into .editor-center,
   which stopped being uncovered once the shipped defaults changed the layout
   around it. Measure the window and aim beside it. */
const spot = await page.evaluate(() => {
  const ec = document.querySelector('.editor-center').getBoundingClientRect();
  const w = document.querySelector('.tool-window')?.getBoundingClientRect();
  const clear = (x, y) => !w || x < w.left - 8 || x > w.right + 8 || y < w.top - 8 || y > w.bottom + 8;
  for (const y of [ec.bottom - 20, ec.top + 12, ec.top + ec.height / 2]) {
    for (const x of [ec.left + 30, ec.right - 30, ec.left + ec.width / 2]) {
      if (clear(x, y)) return { x, y };
    }
  }
  return null;
});
if (!spot) throw new Error('the temp window covers the whole editor — nowhere to click');
await page.mouse.click(spot.x, spot.y);
await settle(page);
ok((await state()).temp === null, 'temp window closed by the script click (unchanged rule)');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
