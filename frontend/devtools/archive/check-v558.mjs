// devtools/check-v558.mjs — the writer's note replaces the steer enum: a
// single-line field with teaching placeholder and a live counter capped at
// 300; targeting still resolves (regression).
import { launch, boot, seedScript, openTool, SCENES_4, installAddon } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await installAddon(page, 'action-rewrite');   // v7.05: Rewrite ships as an add-on
await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-tool', { timeout: 8000 });
const field = await page.evaluate(() => {
  const n = document.querySelector('.rw-note');
  return n ? { placeholder: n.placeholder, max: n.maxLength, select: !!document.querySelector('.rw-intent') } : null;
});
ok(field && field.placeholder.includes('this beat for') && field.max === 300 && !field.select,
  `steer select is gone; the note field teaches (“${field?.placeholder}”, cap ${field?.max})`);
await page.fill('.rw-note', 'keep the arrows');
const counter = await page.evaluate(() => document.querySelector('.rw-note-count')?.textContent);
ok(counter === '15/300', `counter tracks the note (${counter})`);
await page.fill('.rw-note', 'x'.repeat(400));
const capped = await page.evaluate(() => ({
  len: document.querySelector('.rw-note').value.length,
  full: document.querySelector('.rw-note-count')?.classList.contains('full'),
}));
ok(capped.len === 300 && capped.full, `input hard-caps at 300 and the counter flags full`);
await page.evaluate(() => {
  const ed = window.__scEditor;
  let pos = -1;
  ed.state.doc.forEach((node, offset) => {
    if (pos === -1 && node.type.name === 'action') pos = offset + 2;
  });
  ed.chain().focus().setTextSelection(pos).run();
});
await page.waitForTimeout(500);
ok(await page.evaluate(() => (document.querySelector('.rw-target')?.textContent ?? '').includes('Target: 1 action paragraph')),
  'targeting still live');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
