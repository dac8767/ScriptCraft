// devtools/check-v557.mjs — the v2 rewrite design lands in the UI: the
// intent steer is No steer / Tighten only, and live targeting still works
// (regression on the v5.54 selection layer after the type changes).
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-tool', { timeout: 8000 });
const intents = await page.evaluate(() =>
  [...document.querySelectorAll('.rw-intent option')].map((o) => o.textContent));
ok(intents.join('|') === 'No steer|Tighten',
  `intent steer is the v2 pair only (${intents.join(', ')})`);
await page.evaluate(() => {
  const ed = window.__scEditor;
  let pos = -1;
  ed.state.doc.forEach((node, offset) => {
    if (pos === -1 && node.type.name === 'action') pos = offset + 2;
  });
  ed.chain().focus().setTextSelection(pos).run();
});
await page.waitForTimeout(500);
const target = await page.evaluate(() => document.querySelector('.rw-target')?.textContent ?? '');
ok(target.includes('Target: 1 action paragraph'),
  `targeting still live after the type changes (${target.trim()})`);
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
