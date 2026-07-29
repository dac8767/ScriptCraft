// devtools/check-v535.mjs — Derek: "if there is a tool in a side panel
// toggled open, and i click into the script, that tool window should stay
// open." Docked panel tools survive script clicks; FLOATING windows (slot
// and temp) still dismiss — that behavior is pinned here too.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
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
await page.waitForTimeout(150);
const afterRight = await state();
ok(afterRight.right === 'markups', 'still open after clicking into the script');
ok(await page.$('.markup-ctl-filter') !== null, 'and its panel body is still rendered');

// ── docked LEFT (Navigator) stays open too ───────────────────────────────
await openTool(page, 'Navigator');
ok((await state()).left === 'navigator', 'Navigator docked left');
await page.click('.editor-center .ProseMirror');
await page.waitForTimeout(150);
ok((await state()).left === 'navigator', 'still open after clicking into the script');

// ── a FLOATING slot window still dismisses on a script click ─────────────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolMode('sticky', 'floating');
  s.openTool('sticky');
});
await page.waitForTimeout(150);
ok((await state()).right === 'sticky', 'Sticky Notes opened as a floating window');
await page.click('.editor-center .ProseMirror');
await page.waitForTimeout(150);
ok((await state()).right === null, 'floating window closed by the script click (unchanged rule)');

// ── a TEMP window (always-float tool) still dismisses too ────────────────
await page.evaluate(() => window.__scStore.getState().openTool('analytics'));
await page.waitForTimeout(150);
ok((await state()).temp === 'analytics', 'Analytics opened as a temp window');
// the temp window overlays the editor's middle — click an uncovered spot
const ec = await (await page.$('.editor-center')).boundingBox();
await page.mouse.click(ec.x + 30, ec.y + 160);
await page.waitForTimeout(150);
ok((await state()).temp === null, 'temp window closed by the script click (unchanged rule)');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
