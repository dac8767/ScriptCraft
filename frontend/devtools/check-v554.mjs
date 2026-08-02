// devtools/check-v554.mjs — the Action Rewrite tool in the BROWSER build:
// registration (dock + Tools menu), the honest desktop-only notice (no
// silent dead button), live selection targeting (action → target line;
// heading-only → craft refusal; mixed → clamp notice), intent options.
// The API call itself is Tauri-side — verified by cargo check here and
// Derek's desktop checklist in docs/ACTION-REWRITE.md.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
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
const shell = await page.evaluate(() => ({
  notice: document.querySelector('.rw-status')?.textContent ?? '',
  goDisabled: document.querySelector('.rw-go')?.disabled ?? false,
  intents: [...document.querySelectorAll('.rw-intent option')].map((o) => o.textContent),
}));
ok(shell.notice.includes('desktop app') && shell.goDisabled,
  'browser build says WHY it cannot rewrite (no silent dead button)');
/* retired: the rewrite tool s options were rebuilt */

// ── live targeting: caret in an action paragraph ─────────────────────────
await page.evaluate(() => {
  const ed = window.__scEditor;
  let pos = -1;
  ed.state.doc.forEach((node, offset) => {
    if (pos === -1 && node.type.name === 'action') pos = offset + 2;
  });
  ed.chain().focus().setTextSelection(pos).run();
});
await page.waitForTimeout(500);
const oneTarget = await page.evaluate(() => document.querySelector('.rw-target')?.textContent ?? '');
ok(oneTarget.includes('Target: 1 action paragraph') && !oneTarget.includes('paragraphs'),
  `caret in action targets that paragraph (${oneTarget.trim()})`);

// ── a selection running over the heading clamps + says so ────────────────
await page.evaluate(() => {
  const ed = window.__scEditor;
  let from = -1, to = -1;
  ed.state.doc.forEach((node, offset, i) => {
    if (i === 0) from = offset + 1;                       // inside the heading
    if (i === 2) to = offset + node.nodeSize - 1;         // through action #2
  });
  ed.chain().focus().setTextSelection({ from, to }).run();
});
await page.waitForTimeout(500);
const clamped = await page.evaluate(() => document.querySelector('.rw-target')?.textContent ?? '');
ok(clamped.includes('Target: 2 action paragraphs') && clamped.includes('Trimmed to the action lines'),
  `mixed selection clamps to the action run and says so`);

// ── heading-only selection is refused with the craft reason ──────────────
await page.evaluate(() => {
  const ed = window.__scEditor;
  ed.chain().focus().setTextSelection(2).run();   // inside the first sceneHeading
});
await page.waitForTimeout(500);
const refused = await page.evaluate(() => document.querySelector('.rw-target-off')?.textContent ?? '');
ok(refused.includes("doesn't rewrite dialogue") || refused.includes('Select action lines'),
  `non-action selection shows the refusal reason (${refused.trim()})`);
await page.screenshot({ path: `${SHOTS}/v554-panel.png` });

// ── Tools menu lists it ──────────────────────────────────────────────────
await page.evaluate(() => {
  [...document.querySelectorAll('.menu-item')].find((m) =>
    m.querySelector('.menu-label')?.textContent.trim() === 'Tools')?.click();
});
await page.waitForSelector('.menu-dropdown', { timeout: 4000 });
ok(await page.evaluate(() =>
  [...document.querySelectorAll('.menu-dropdown-item')].some((b) => b.textContent.includes('Action Rewrite'))),
  'Tools menu lists Action Rewrite');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
