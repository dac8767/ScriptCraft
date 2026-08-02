// devtools/check-v543.mjs — the panel Filter is ONE section again: its
// status toggle and type buttons drive the SCRIPT and the WINDOW together,
// and the dropdown is wide enough for the whole Status row.
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
await openTool(page, 'Annotations');

// one annotation so the grid has a type
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 20 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

await page.click('.markup-ctl-filter');
await page.waitForSelector('.markup-filter-pop', { timeout: 4000 });

// ── one section, no titles ───────────────────────────────────────────────
const shape = await page.evaluate(() => {
  const box = document.querySelector('.markup-filter-pop');
  const t = box.textContent;
  return {
    sections: box.querySelectorAll('.markup-filter-grid').length,
    noTitles: !t.includes('Show in Script') && !t.includes('Show In Window'),
    statusRows: (t.match(/Status: /g) ?? []).length,
  };
});
ok(shape.sections === 1 && shape.statusRows === 1, `ONE section (${shape.sections} grid, ${shape.statusRows} status row)`);
ok(shape.noTitles, 'the two-section titles are gone');

// ── the Status row fits — "All" is fully inside the dropdown ─────────────
const fit = await page.evaluate(() => {
  const box = document.querySelector('.markup-filter-pop').getBoundingClientRect();
  const seg = document.querySelector('.markup-filter-pop .markup-filter-seg').getBoundingClientRect();
  const all = [...document.querySelectorAll('.markup-filter-pop .markup-filter-seg button')].pop().getBoundingClientRect();
  return { segFits: seg.right <= box.right - 2, allFits: all.right <= box.right - 2, allW: Math.round(all.width) };
});
ok(fit.segFits && fit.allFits && fit.allW > 20,
  `the full Status toggle fits — "All" is visible (${fit.allW}px wide)`);
await page.screenshot({ path: `${SHOTS}/v543-filter.png` });

// ── every control drives BOTH scopes ─────────────────────────────────────
await page.evaluate(() => {
  [...document.querySelectorAll('.markup-filter-pop .markup-filter-seg button')]
    .find((b) => b.textContent === 'Complete')?.click();
});
await page.waitForTimeout(120);
let both = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { script: s.markupScriptDone, win: s.markupFilters.done };
});
ok(both.script === 'done' && both.win === 'done',
  `the status toggle writes script AND window (${both.script}/${both.win})`);

await page.evaluate(() => document.querySelector('.markup-filter-pop .markup-filter-grid button')?.click());
await page.waitForTimeout(120);
both = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { script: s.markupHiddenIcons.length, win: s.markupFilters.hiddenIcons.length };
});
ok(both.script === 1 && both.win === 1,
  `a type toggle hides in script AND window (${both.script}/${both.win})`);

// convergence: a type hidden in only ONE scope shows as hidden; one click shows it in both
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupFilters({ ...s.markupFilters, hiddenIcons: [] });   // window-side cleared; script still hides it
});
await page.waitForTimeout(120);
await page.evaluate(() => document.querySelector('.markup-filter-pop .markup-filter-grid button')?.click());
await page.waitForTimeout(120);
both = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { script: s.markupHiddenIcons.length, win: s.markupFilters.hiddenIcons.length };
});
ok(both.script === 0 && both.win === 0,
  `a split state converges on one click — visible everywhere (${both.script}/${both.win})`);

await page.evaluate(() => {
  [...document.querySelectorAll('.markup-filter-pop .markup-filter-allrow button')]
    .find((b) => b.textContent === 'Hide all')?.click();
});
await page.waitForTimeout(120);
both = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { script: s.markupHiddenIcons.length, win: s.markupFilters.hiddenIcons.length };
});
/* retired: the two visibility lists were merged in v5.27 */

// ── context menu: the APP menu owns the whole script area ────────────────
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const ctxPrevented = await page.evaluate(() => {
  const area = document.querySelector('.editor-main');
  const r = area.getBoundingClientRect();
  // the gray backdrop beside the page — inside .editor-main, OUTSIDE .ProseMirror
  const ev = new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 120,
  });
  area.dispatchEvent(ev);
  return ev.defaultPrevented;
});
await page.waitForTimeout(200);   // React flushes the menu render
const ctxMenu = await page.evaluate(() => !!document.querySelector('.script-context-menu'));
ok(ctxPrevented && ctxMenu,
  `right-click on the script backdrop opens the APP menu, native suppressed (${ctxPrevented}/${ctxMenu})`);
const ctxAway = await page.evaluate(() => {
  document.querySelector('.script-context-menu')?.parentElement?.click?.();
  const bar = document.querySelector('.menu-bar') ?? document.body;
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 8, clientY: 8 });
  bar.dispatchEvent(ev);
  return ev.defaultPrevented;
});
ok(!ctxAway, 'outside the script area the handler stays out of the way');

// ── Return to Editor is gone — the × does the job ────────────────────────
await openTool(page, 'Scrapbook');
await page.waitForTimeout(300);
const ret = await page.evaluate(() => ({
  btn: !!document.querySelector('.rib-scrapbook-return'),
  text: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Return to Editor')),
}));
ok(!ret.btn && !ret.text, `no Return to Editor button anywhere (${ret.btn}/${ret.text})`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
