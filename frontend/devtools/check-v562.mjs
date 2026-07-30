// devtools/check-v562.mjs — the writer's note clears when a NEW set of text
// is targeted (disjoint range), and survives caret moves within the same
// passage and focus trips into the panel.
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

const spots = await page.evaluate(() => {
  const ed = window.__scEditor;
  const actions = [];
  ed.state.doc.forEach((node, offset) => {
    if (node.type.name === 'action') actions.push(offset + 2);
  });
  return actions;
});
await page.evaluate((p) => window.__scEditor.chain().focus().setTextSelection(p).run(), spots[0]);
await page.waitForTimeout(400);
await page.fill('.rw-note', 'keep the arrows');
ok(await page.evaluate(() => document.querySelector('.rw-note').value) === 'keep the arrows',
  'a note is written for the first passage');

await page.evaluate((p) => window.__scEditor.chain().focus().setTextSelection(p + 6).run(), spots[0]);
await page.waitForTimeout(400);
ok(await page.evaluate(() => document.querySelector('.rw-note').value) === 'keep the arrows',
  'caret move inside the same passage keeps the note');

await page.evaluate((p) => window.__scEditor.chain().focus().setTextSelection(p).run(), spots[2]);
await page.waitForTimeout(400);
ok(await page.evaluate(() => document.querySelector('.rw-note').value) === '',
  'a new set of text clears the old note');

await page.fill('.rw-note', 'this beat opens the fight');
await page.click('.rw-note');
await page.waitForTimeout(400);
ok(await page.evaluate(() => document.querySelector('.rw-note').value) === 'this beat opens the fight',
  'focusing the field never clears it');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
