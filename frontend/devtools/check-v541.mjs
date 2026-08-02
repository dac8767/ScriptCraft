// devtools/check-v541.mjs — Derek's 7: In Navigator/In Script previews,
// current-first Used row, draggable + compact combo picker, ribbon
// formatting drives the annotation editor, no nav icon for lists, and the
// shape-limit toast at the attempted move (panel foot text gone).
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

// panel foot: the always-on helper text is GONE
ok(await page.evaluate(() => !document.body.textContent.includes('This window only appears in the side panel')),
  'the panel no longer carries the always-on helper text');

// a second combo in the store so "Used:" has something to show
await page.evaluate(() => {
  window.__scStore.getState().addMarkup({
    id: 'probe-star', content: null, icon: 'star', color: '#e8b44f', highlight: null,
    anchor: 'point', done: false, createdAt: '2026-07-29T00:00:00.000Z',
  });
});

// open an annotation
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 20 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });

// ── 2: current combo first, then "Used:", then the rest ──────────────────
const usedRow = await page.evaluate(() => {
  const group = document.querySelector('.markup-pop-icon-group');
  const kids = [...group.children].map((el) =>
    el.classList?.contains('markup-used-label') ? 'LABEL'
      : el.classList?.contains('markup-combo-plus') ? 'PLUS'
        : el.classList?.contains('active') ? 'ACTIVE'
          : el.tagName === 'BUTTON' ? 'used' : el.className);
  return kids;
});
const iActive = usedRow.indexOf('ACTIVE'), iLabel = usedRow.indexOf('LABEL'), iUsed = usedRow.indexOf('used');
ok(iActive >= 0 && iLabel > iActive && iUsed > iLabel,
  `current → "Used:" → rest (${JSON.stringify(usedRow)})`);

// ── 1: In Navigator / In Script previews ─────────────────────────────────
const previews = await page.evaluate(() => ({
  nav: document.body.textContent.includes('In Navigator:'),
  script: document.body.textContent.includes('In Script:'),
  chipRound: (() => {
    const chip = document.querySelector('.markup-margin-preview');
    return chip ? getComputedStyle(chip).borderRadius === '50%' : false;
  })(),
  navIconNow: !!document.querySelector('.markup-pop-preview .fs-nav-markup-icon'),
}));
ok(previews.nav && previews.script, 'both preview labels present');
ok(previews.chipRound, 'the In Script preview is the round margin chip');
ok(previews.navIconNow, 'text annotation: the nav preview still shows its icon');

// make it a checklist → the nav preview drops the icon (item 6, live)
await page.click('.markup-mini-editor .ProseMirror');
await page.click('button[title="Checklist"]');
await page.keyboard.type('one');
await page.keyboard.press('Enter');
await page.keyboard.type('two');
await settle(page);
ok(await page.evaluate(() => !document.querySelector('.markup-pop-preview .fs-nav-markup-icon')),
  'checklist annotation: the nav preview shows NO icon');
ok(await page.evaluate(() => !!document.querySelector('.markup-margin-preview')),
  '(the In Script chip stays — the margin always shows the icon)');

// ── 5: ribbon formatting drives the mini editor ──────────────────────────
await page.evaluate(() => {
  const mini = window.__scStore.getState().markupMiniEditor;
  mini.chain().setTextSelection({ from: 0, to: mini.state.doc.content.size }).run();
});
await page.click('button[title="Bold (⌘B)"]');
await settle(page);
const fmt = await page.evaluate(() => {
  const mini = window.__scStore.getState().markupMiniEditor;
  return {
    miniBold: JSON.stringify(mini.getJSON()).includes('"bold"'),
    scriptBold: JSON.stringify(window.__scEditor.getJSON()).includes('"bold"'),
  };
});
ok(fmt.miniBold, 'ribbon Bold bolds the annotation text');
ok(!fmt.scriptBold, 'and the script itself is untouched');

// ── 3+4: the combo picker is draggable and compact ───────────────────────
await page.click('.markup-combo-plus');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
const shape = await page.evaluate(() => {
  const box = document.querySelector('.markup-icon-pop').getBoundingClientRect();
  const left = document.querySelector('.markup-icon-pop-left')?.getBoundingClientRect();
  const right = document.querySelector('.markup-icon-pop-right')?.getBoundingClientRect();
  return { w: Math.round(box.width), h: Math.round(box.height), sideBySide: left && right && right.left > left.right - 2 && Math.abs(left.top - right.top) < 30 };
});
ok(shape.sideBySide, `icons and color sit SIDE BY SIDE (${shape.w}×${shape.h})`);
// the embedded color column is the height floor (~430px); the old stack
// was 560px CAPPED with ~700px of scrolled content
ok(shape.h <= 470, `and the window is compact (${shape.h}px tall)`);
const before = await page.evaluate(() => {
  const r = document.querySelector('.markup-icon-pop').getBoundingClientRect();
  return { top: Math.round(r.top), left: Math.round(r.left) };
});
const bar = await (await page.$('.markup-icon-pop-drag')).boundingBox();
await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
await page.mouse.down();
await page.mouse.move(bar.x + bar.width / 2 - 90, bar.y + bar.height / 2 - 60, { steps: 4 });
await page.mouse.up();
await settle(page);
const after = await page.evaluate(() => {
  const r = document.querySelector('.markup-icon-pop').getBoundingClientRect();
  return { top: Math.round(r.top), left: Math.round(r.left) };
});
ok(Math.abs(after.left - (before.left - 90)) <= 3 && Math.abs(after.top - (before.top - 60)) <= 3,
  `the picker DRAGS to reposition (Δ ${after.left - before.left},${after.top - before.top})`);
await page.screenshot({ path: `${SHOTS}/v541-picker.png` });
await page.keyboard.press('Escape');

// close the annotation window (saves) — the ribbon returns to the script
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
ok(await page.evaluate(() => window.__scStore.getState().markupMiniEditor === null),
  'closing the window hands the ribbon back to the script');

// ── 6: navigator — list annotation has NO icon, text annotation has one ──
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 200, to: 220 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.click('.markup-mini-editor .ProseMirror');
await page.keyboard.type('plain text note');
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
await openTool(page, 'Navigator');
await page.waitForSelector('.fs-nav-item.markup', { timeout: 5000 });
const nav = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fs-nav-item.markup')];
  return rows.map((r) => ({
    hasIcon: !!r.querySelector('.fs-nav-markup-icon'),
    hasLines: r.querySelectorAll('.fs-nav-anno-line').length,
  }));
});
const listRow = nav.find((r) => r.hasLines >= 2);
const textRow = nav.find((r) => r.hasLines === 1);
ok(listRow && !listRow.hasIcon, 'list annotation row: lines, NO icon');
ok(textRow && textRow.hasIcon, 'text annotation row: keeps its icon');

// ── 7: dragging a locked tool out toasts instead of floating ─────────────
const row = await (await page.$('.tool-dock-item:has-text("Annotations")')).boundingBox();
const editorBox = await (await page.$('.editor-center')).boundingBox();
await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2);
await page.mouse.down();
await page.mouse.move(editorBox.x + 200, editorBox.y + 300, { steps: 6 });
await page.mouse.up();
await settle(page);
const toast = await page.evaluate(() => ({
  toasted: document.body.textContent.includes('This window only appears in the side panel'),
  mode: window.__scStore.getState().toolMode.markups ?? 'docked',
}));
ok(toast.toasted, 'the attempt TOASTS the limit');
ok(toast.mode !== 'floating', `and the tool stays put (mode: ${toast.mode})`);
await page.screenshot({ path: `${SHOTS}/v541-toast.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
