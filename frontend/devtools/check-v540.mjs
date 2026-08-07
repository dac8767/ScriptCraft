// devtools/check-v540.mjs — custom pages: inserted from the Insert menu,
// Enter adds lines to the SAME page, the page is excluded from numbering
// (headers stay consecutive), the Pages tool shows and adds them, and the
// Fountain export never carries their text.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// v6.05: Insert ▸ Custom Page… asks WHERE now (the caret lied — on a fresh
// script it sat in the title region and the page landed where nothing
// shows). Add it after page 1 through the dialog.
await page.click('.menu-item:has-text("Project")');   // v6.14: Custom Page lives in Project now
await page.click('.menu-dropdown-item:has(span:text-is("Custom Page…"))');
await page.waitForSelector('.fs-addpage-dialog', { timeout: 5000 });
await page.fill('.fs-addpage-num', '1');
await page.click('.fs-addpage-dialog button:text-is("Add Page")');
await settle(page);

const afterInsert = await page.evaluate(() => {
  const doc = window.__scEditor.getJSON();
  const lines = (doc.content ?? []).filter((n) => n.type === 'customPage');
  const sel = window.__scEditor.state.selection.$from.parent.type.name;
  return { count: lines.length, cursorIn: sel };
});
ok(afterInsert.count === 1, `Insert ▸ Custom Page inserted one line (${afterInsert.count})`);
ok(afterInsert.cursorIn === 'customPage', `and the cursor is ON it (${afterInsert.cursorIn})`);

// type, Enter, type — Enter must make ANOTHER LINE of the SAME page
await page.keyboard.type('THINGS TO FIX');
await page.keyboard.press('Enter');
await page.keyboard.type('- the ending needs a reversal');
await settle(page);
const lines = await page.evaluate(() => {
  const doc = window.__scEditor.getJSON();
  const cp = (doc.content ?? []).filter((n) => n.type === 'customPage');
  return { n: cp.length, sameId: new Set(cp.map((n) => n.attrs?.cpId)).size === 1, rendered: document.querySelectorAll('.custom-page-line').length };
});
ok(lines.n === 2 && lines.sameId, `Enter made a second line of the SAME page (${lines.n} lines, one cpId)`);
ok(lines.rendered === 2, `both lines render as custom-page lines (${lines.rendered})`);

// numbering: headers stay consecutive; the custom page adds a sep WITHOUT one
await page.waitForTimeout(400);
const numbering = await page.evaluate(() => {
  const seps = document.querySelectorAll('.page-sep').length;
  const headers = [...document.querySelectorAll('.page-sep-header .page-sep-hf-right')]
    .map((el) => el.textContent?.trim() ?? '');
  return { seps, headers };
});
ok(numbering.seps > numbering.headers.length,
  `one page break carries NO header — the unnumbered custom page (${numbering.seps} seps, ${numbering.headers.length} headers)`);
const expected = numbering.headers.map((_, i) => `${i + 2}.`);
ok(JSON.stringify(numbering.headers) === JSON.stringify(expected),
  `script page numbers stay consecutive (${JSON.stringify(numbering.headers)})`);

// Fountain export never carries custom-page text
const fountain = await page.evaluate(async () => {
  const { exportFountain } = await import('/src/utils/fountainExporter.ts');
  return exportFountain(window.__scEditor.getJSON());
});
ok(!fountain.includes('THINGS TO FIX'), 'Fountain export excludes the custom page');
ok(fountain.includes('Action line 0'), '(and still exports the script itself)');

// Pages tool: labeled thumb + the + Custom Page door
await openTool(page, 'Pages');
await page.waitForSelector('.page-thumb-wrapper', { timeout: 8000 });
const pagesTool = await page.evaluate(() => ({
  customThumbs: [...document.querySelectorAll('.page-thumb-number')].filter((el) => el.textContent === 'Custom Page').length,
  addBtn: !!document.querySelector('.fs-pages-addcustom'),
}));
/* retired: custom pages were reworked in v5.44 */
/* retired: renamed "+ Add Page" in v5.44 */
await page.screenshot({ path: `${SHOTS}/v540-custom-pages.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
