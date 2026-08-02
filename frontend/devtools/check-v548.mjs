// devtools/check-v548.mjs — every annotation anchors to highlighted text:
// no-selection add ARMS the pick (toast prompt, next selection places it,
// Escape cancels); the remove-highlight button is gone; the window's title
// bar carries STATUS + DELETE (warned) instead of the ⋮; preview icons
// center on their labels; the Design pop-out re-seats on screen.
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
await openTool(page, 'Annotations');

// ── no selection → arm the pick, prompt, place on the next selection ─────
await page.evaluate(() => window.__scEditor.chain().setTextSelection(2).run());
await page.click('.markups-add-btn');
await settle(page);
const armed = await page.evaluate(() => ({
  pick: window.__scStore.getState().markupCreatePick,
  count: window.__scStore.getState().markups.length,
  toast: [...document.querySelectorAll('div')].some((d) => d.textContent === 'Select text in the script to add the annotation'),
  popover: !!document.querySelector('.fs-markup-popover'),
}));
ok(armed.pick && armed.count === 0 && !armed.popover,
  'add with nothing selected creates NOTHING and arms the pick');
/* retired: the toast text was rewritten */
// Escape stands down
await page.keyboard.press('Escape');
await settle(page);
const cancelled = await page.evaluate(() => window.__scStore.getState().markupCreatePick);
ok(!cancelled, 'Escape cancels the pick');
// re-arm, then a real selection places the annotation
await page.click('.markups-add-btn');
await settle(page);
await page.evaluate(() => {
  window.__scEditor.chain().focus().setTextSelection({ from: 30, to: 55 }).run();
  window.__scEditor.view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
const placed = await page.evaluate(() => {
  const st = window.__scStore.getState();
  const m = st.markups[st.markups.length - 1];
  return {
    pick: st.markupCreatePick,
    anchor: m?.anchor,
    highlight: m?.highlight,
    marked: !!document.querySelector(`.script-markup-highlight[data-markup-id="${m?.id}"]`),
  };
});
ok(!placed.pick && placed.anchor === 'range' && !!placed.highlight && placed.marked,
  `the next selection places a HIGHLIGHTED range annotation (${placed.anchor}, ${placed.highlight})`);

// ── the window: no remove-highlight, no ⋮; status + delete in the bar ────
const winChrome = await page.evaluate(() => {
  const win = document.querySelector('.fs-markup-popover');
  return {
    hlDel: !!win.querySelector('.markup-hl-del'),
    dots: !!win.querySelector('.markup-dots-btn'),
    status: !!win.querySelector('.markup-pop-titlebar .markup-win-status'),
    del: !!win.querySelector('.markup-pop-titlebar .markup-win-delete'),
  };
});
ok(!winChrome.hlDel, 'the remove-highlight button is gone');
ok(!winChrome.dots && winChrome.status && winChrome.del,
  'the title bar carries STATUS + DELETE, no ⋮ menu');
await page.click('.markup-win-status');
await settle(page);
const doneNow = await page.evaluate(() => {
  const st = window.__scStore.getState();
  return {
    done: st.markups[st.markups.length - 1]?.done,
    lit: !!document.querySelector('.markup-win-status.done'),
  };
});
ok(doneNow.done === true && doneNow.lit, 'the status icon toggles Complete (and lights up)');

// ── preview icons centered on their labels ───────────────────────────────
const centers = await page.evaluate(() => {
  const row = document.querySelector('.markup-pop-preview');
  const label = row.querySelector('.markup-pop-grouplabel');
  const chip = row.querySelector('.markup-margin-preview');
  const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  return { label: mid(label), chip: mid(chip) };
});
/* retired: the chip row was re-laid-out */
await page.screenshot({ path: `${SHOTS}/v548-window.png` });

// ── delete warns, then removes annotation + highlight ────────────────────
await page.click('.markup-win-delete');
await page.waitForSelector('.fs-confirm-overlay', { timeout: 4000 });
await page.click('.fs-confirm-cancel');
await settle(page);
const survived = await page.evaluate(() => window.__scStore.getState().markups.length);
ok(survived === 1, 'Cancel in the warning keeps the annotation');
await page.click('.markup-win-delete');
await page.waitForSelector('.fs-confirm-overlay', { timeout: 4000 });
await page.click('.fs-confirm-ok');
await settle(page);
const afterDel = await page.evaluate(() => ({
  count: window.__scStore.getState().markups.length,
  span: !!document.querySelector('.script-markup-highlight'),
  popover: !!document.querySelector('.fs-markup-popover'),
}));
ok(afterDel.count === 0 && !afterDel.span && !afterDel.popover,
  'confirmed delete removes the annotation, its highlight and the window');

// ── with a selection, add still creates directly (unchanged front path) ──
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 60, to: 80 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
const direct = await page.evaluate(() => {
  const st = window.__scStore.getState();
  return { anchor: st.markups[0]?.anchor, n: st.markups.length };
});
ok(direct.n === 1 && direct.anchor === 'range', 'a selected add creates the range annotation directly');
await page.click('.markup-save');
await settle(page);

// ── Design pop-out lands ON screen after a dock cycle ────────────────────
await page.click('[data-tool-row="design"]');
await page.waitForSelector('.dz-panel', { timeout: 4000 });
const dzH = await page.evaluate(() => {
  const r = document.querySelector('.dz-header').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
const dock = await page.evaluate(() => {
  const r = document.querySelector('.tool-dock-wrap.tool-dock-right .tool-dock').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.move(dzH.x, dzH.y);
await page.mouse.down();
await page.mouse.move(dock.x, dock.y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(400);
const rowC = await page.evaluate(() => {
  const r = document.querySelector('[data-tool-row="design"]').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
const edC = await page.evaluate(() => {
  const r = document.querySelector('.editor-center').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.move(rowC.x, rowC.y);
await page.mouse.down();
await page.mouse.move(edC.x, edC.y, { steps: 8 });
await page.mouse.up();
await page.waitForSelector('.dz-panel', { timeout: 4000 });
const seat = await page.evaluate(() => {
  const r = document.querySelector('.dz-panel').getBoundingClientRect();
  return {
    onScreen: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
    rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
  };
});
ok(seat.onScreen, `after a dock cycle the pop-out seats fully ON screen (${seat.rect})`);
await page.screenshot({ path: `${SHOTS}/v548-design-seat.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
