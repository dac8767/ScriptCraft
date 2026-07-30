// devtools/check-v564.mjs — the shared-language rule is live in the prompt,
// and the panel still resolves (the Rerun path's resolver is unit-tested;
// the button renders only with live results, which need the API).
import { readFileSync } from 'node:fs';
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const prompt = readFileSync('/home/user/ScriptCraft/src-tauri/prompts/action_line_rewrite.md', 'utf8');
ok(prompt.includes('Variants must not share language'),
  'the prompt carries the shared-language rule');
ok(prompt.includes('may appear in only one of the three'),
  'the rule scopes to invented phrasing across variants');
ok(!/[—–]/.test(prompt.split('Variants must not share language')[1].split('\n\n')[0]),
  'the new rule prose stays dash-free (prompt discipline)');
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-tool', { timeout: 8000 });
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
  'targeting still live after the rerun refactor');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
