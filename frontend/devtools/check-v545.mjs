// devtools/check-v545.mjs — AI Writer: the footer button exists ONLY in the
// side panel (new text), never popped out; the tool is gone from the Tools
// menu. Pages header: + Add Page left, Go to page + Pages per row RIGHT.
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

// ── Pages header: left button, right pair ────────────────────────────────
await openTool(page, 'Pages');
await page.waitForSelector('.fs-pages-actions', { timeout: 8000 });
const head = await page.evaluate(() => {
  const r = (el) => el?.getBoundingClientRect();
  const row = r(document.querySelector('.fs-pages-actions'));
  const add = r(document.querySelector('.fs-pages-addpage'));
  const right = r(document.querySelector('.fs-pages-right'));
  const stepper = r(document.querySelector('#fs-pages-perrow-label')?.parentElement);
  return {
    have: !!(row && add && right && stepper),
    addLeft: add && row && (add.left - row.left < 20),
    pairRight: right && row && (row.right - right.right < 14),
    stepperRight: stepper && row && (row.right - stepper.right < 14),
  };
});
ok(head.have && head.addLeft, '+ Add Page holds the left edge');
ok(head.pairRight && head.stepperRight, 'Go to page + Pages per row hug the right edge');
await page.screenshot({ path: `${SHOTS}/v545-pages-header.png` });

// ── Tools menu: AI Writer is gone ────────────────────────────────────────
await page.click('.menu-label:has-text("Tools")');
await page.waitForSelector('.menu-dropdown', { timeout: 4000 });
const toolsMenu = await page.evaluate(() => document.querySelector('.menu-dropdown').textContent);
ok(!toolsMenu.includes('AI Writer'), 'the Tools menu no longer lists AI Writer');
ok(toolsMenu.includes('Analytics') && toolsMenu.includes('Scrapbook'),
  'its neighbors are still there (Analytics, Scrapbook)');
await page.keyboard.press('Escape');

// ── docked in the panel: the button, with the new text ───────────────────
await openTool(page, 'AI Writer');
await page.waitForSelector('.fs-aiwriter', { timeout: 6000 });
const docked = await page.evaluate(() => ({
  btn: document.querySelector('.fs-aiwriter-remove')?.textContent.trim() ?? null,
  mode: window.__scStore.getState().toolMode.aiwriter ?? 'docked',
}));
ok(docked.mode === 'docked' && docked.btn === 'Remove AI Writer from side panel',
  `in the panel the button reads "${docked.btn}"`);
await page.screenshot({ path: `${SHOTS}/v545-aiwriter-docked.png` });

// ── popped out: no button at all ─────────────────────────────────────────
await page.evaluate(() => window.__scStore.getState().setToolMode('aiwriter', 'floating'));
await page.waitForTimeout(300);
const floated = await page.evaluate(() => ({
  body: !!document.querySelector('.fs-aiwriter'),
  btn: !!document.querySelector('.fs-aiwriter-remove'),
  mode: window.__scStore.getState().toolMode.aiwriter,
}));
ok(floated.mode === 'floating' && floated.body && !floated.btn,
  `popped out the window shows NO remove button (${floated.mode}, body ${floated.body})`);
await page.screenshot({ path: `${SHOTS}/v545-aiwriter-float.png` });

// ── back in the panel, the button removes-and-stashes ────────────────────
await page.evaluate(() => window.__scStore.getState().setToolMode('aiwriter', 'docked'));
await page.waitForTimeout(250);
await page.click('.fs-aiwriter-remove');
await page.waitForTimeout(250);
const gone = await page.evaluate(() => ({
  body: !!document.querySelector('.fs-aiwriter'),
  row: [...document.querySelectorAll('.tool-dock-item')].some((r) => r.textContent.includes('AI Writer')),
  enabled: window.__scStore.getState().toolConfig.aiwriter?.enabled,
}));
ok(!gone.body && !gone.row && gone.enabled === false,
  'the panel button still removes-and-stashes (window closed, dock row gone, enabled=false)');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
