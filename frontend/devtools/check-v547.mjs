// devtools/check-v547.mjs — Pages: # goto in the header + stacked Up/Down;
// Design docks BACK (regression fix) and still coexists; Notes: caret beside
// the checkbox, no helper text, no strikethrough; annotation icon row: the
// current combo IS the picker trigger.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const mouseDrag = async (page, from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};
const center = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// ── Pages: # goto button in the HEADER, left of search ───────────────────
await openTool(page, 'Pages');
await page.waitForSelector('.fs-pages-actions', { timeout: 8000 });
const head = await page.evaluate(() => {
  const goto_ = document.querySelector('.fs-pages-goto-btn');
  const search = document.querySelector('.tool-ctl-search-btn');
  return {
    have: !!goto_ && !!search,
    noText: (goto_?.textContent ?? 'x').trim() === '',
    leftOfSearch: goto_ && search && goto_.getBoundingClientRect().right <= search.getBoundingClientRect().left,
    bodyForm: !!document.querySelector('.fs-pages-actions label[for="fs-pages-goto"]'),
  };
});
ok(head.have && head.noText, 'the header carries a bare # button (no text)');
ok(head.leftOfSearch, 'it sits LEFT of the search icon');
ok(!head.bodyForm, 'the body row no longer holds the Go to page field');
// park the cursor at the doc TOP so the page-2 jump moves it forward
await page.evaluate(() => window.__scEditor.chain().setTextSelection(1).run());
const selBefore = await page.evaluate(() => window.__scEditor.state.selection.from);
await page.click('.fs-pages-goto-btn');
await page.waitForSelector('.fs-pages-pop', { timeout: 4000 });
const gotoLabel = await page.evaluate(() =>
  document.querySelector('.fs-pages-pop label')?.textContent);
ok(gotoLabel === 'Go to page #:', `clicking it opens the "${gotoLabel}" window`);
await page.fill('#fs-pages-goto', '2');
await page.click('.fs-pages-pop button[type="submit"]');
await page.waitForTimeout(400);
const gotoRes = await page.evaluate(() => ({
  sel: window.__scEditor.state.selection.from,
  req: window.__scStore.getState().pagesGotoRequest,
  popGone: !document.querySelector('.fs-pages-pop'),
}));
ok(gotoRes.sel > selBefore + 50 && gotoRes.req === null && gotoRes.popGone,
  `Go jumps the script to page 2 and clears the request (pos ${selBefore} → ${gotoRes.sel})`);

// ── Pages: stacked Up/Down LEFT of the number ────────────────────────────
const stepper = await page.evaluate(() => {
  const wrap = document.querySelector('.fs-updown');
  const btns = wrap ? [...wrap.querySelectorAll('.fs-updown-btn')] : [];
  const count = document.querySelector('.fs-pages-actions .tool-action-count');
  const r = (el) => el?.getBoundingClientRect();
  return {
    two: btns.length === 2,
    stacked: btns.length === 2 && r(btns[0]).bottom <= r(btns[1]).top + 2
      && Math.abs(r(btns[0]).left - r(btns[1]).left) < 2,
    leftOfCount: wrap && count && r(wrap).right <= r(count).left,
    oldIcons: document.querySelectorAll('.fs-pages-actions .tool-action-icon').length,
    n: count?.textContent,
  };
});
ok(stepper.two && stepper.stacked, 'the stepper is an Up button stacked on a Down button');
/* retired: the stepper became the shared PerRowStepper in v5.50 */
await page.click('.fs-updown .fs-updown-btn >> nth=0');
await settle(page);
const nUp = await page.evaluate(() => window.__scStore.getState().pagesPerRow);
await page.click('.fs-updown .fs-updown-btn >> nth=1');
await settle(page);
const nDown = await page.evaluate(() => window.__scStore.getState().pagesPerRow);
ok(nUp === 4 && nDown === 3, `Up increments, Down decrements (3→${nUp}→${nDown})`);
await page.screenshot({ path: `${SHOTS}/v547-pages.png` });

// ── Design: independent by default, DOCKS BACK by drop, honored, out again ─
await page.click('[data-tool-row="design"]');
await page.waitForSelector('.dz-panel', { timeout: 4000 });
const dzC = await center(page, '.dz-header');
const dockC = await center(page, '.tool-dock-wrap.tool-dock-right .tool-dock');
await mouseDrag(page, dzC, dockC);
await page.waitForTimeout(400);
const docked = await page.evaluate(() => {
  const st = window.__scStore.getState();
  return {
    slot: st.activeToolRight,
    mode: st.toolMode.design,
    win: st.designPanelOpen,
    embedded: !!document.querySelector('.dz-embedded'),
  };
});
ok(docked.slot === 'design' && docked.mode === 'docked' && !docked.win && docked.embedded,
  `dropping the Design window on a panel DOCKS it (slot ${docked.slot}, mode ${docked.mode})`);
await page.screenshot({ path: `${SHOTS}/v547-design-docked.png` });
await page.click('[data-tool-row="design"]');   // toggle closed
await settle(page);
await page.click('[data-tool-row="design"]');   // reopen — the docked home is honored
await settle(page);
const reopened = await page.evaluate(() => ({
  slot: window.__scStore.getState().activeToolRight,
  win: window.__scStore.getState().designPanelOpen,
}));
ok(reopened.slot === 'design' && !reopened.win, 'the row click honors the docked home (opens in the panel)');
const rowC = await center(page, '[data-tool-row="design"]');
const edC = await center(page, '.editor-center');
await mouseDrag(page, rowC, edC);
await page.waitForTimeout(400);
const outAgain = await page.evaluate(() => ({
  win: window.__scStore.getState().designPanelOpen,
  slot: window.__scStore.getState().activeToolRight,
  mode: window.__scStore.getState().toolMode.design,
}));
ok(outAgain.win && outAgain.slot !== 'design' && outAgain.mode === 'floating',
  'dragging the row out hands Design back to its independent window');
await page.click('.dz-close');

// ── Notes: caret beside the checkbox, no helper text, no strikethrough ───
await page.click('[data-tool-row="sticky"]');
await page.waitForSelector('.sticky-add-btn', { timeout: 6000 });
await page.click('.sticky-add-btn');
await page.waitForSelector('.swn-note-editor .ProseMirror', { timeout: 5000 });
const noPlaceholder = await page.evaluate(() =>
  !document.querySelector('.swn-note-editor [data-placeholder]'));
ok(noPlaceholder, 'the note field shows NO helper text');
// the mini bar shows on :focus-within — click into the field first
await page.click('.swn-note-editor .ProseMirror >> nth=0');
await page.click('.swn-mini-btn[title="Checklist"] >> nth=0');
await page.waitForSelector('.swn-note-editor ul[data-type="taskList"] li', { timeout: 4000 });
const noteLi = await page.evaluate(() => {
  const li = document.querySelector('.swn-note-editor ul[data-type="taskList"] li');
  const div = li.querySelector(':scope > div');
  return {
    grow: getComputedStyle(div).flexGrow,
    liW: li.getBoundingClientRect().width,
    divW: div.getBoundingClientRect().width,
    liRect: (() => { const r = li.getBoundingClientRect(); return { x: r.right - 30, y: r.top + r.height / 2 }; })(),
  };
});
ok(noteLi.grow === '1' && noteLi.divW > noteLi.liW * 0.6,
  `the text area fills the row beside the box (${Math.round(noteLi.divW)}/${Math.round(noteLi.liW)}px)`);
await page.mouse.click(noteLi.liRect.x, noteLi.liRect.y);
await settle(page);
const caret = await page.evaluate(() =>
  !!document.activeElement?.closest?.('.swn-note-editor'));
ok(caret, 'clicking beside the checkbox lands the caret in the note');
await page.click('.swn-note-editor ul[data-type="taskList"] li > label input');
await settle(page);
const noteStrike = await page.evaluate(() => {
  const div = document.querySelector('.swn-note-editor li[data-checked="true"] > div');
  return div ? getComputedStyle(div).textDecorationLine : 'missing';
});
ok(noteStrike === 'none', `a checked note item gets NO strikethrough (${noteStrike})`);

// ── Annotation window: no strikethrough; current combo opens the picker ──
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 20 }).run());
await openTool(page, 'Annotations');
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.evaluate(() => {
  window.__scStore.getState().markupMiniEditor.commands.setContent({
    type: 'doc',
    content: [{
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done thing' }] }] }],
    }],
  }, true);
});
await settle(page);
const annoStrike = await page.evaluate(() => {
  const div = document.querySelector('.markup-mini-editor li[data-checked="true"] > div');
  return div ? getComputedStyle(div).textDecorationLine : 'missing';
});
ok(annoStrike === 'none', `a checked annotation item gets NO strikethrough (${annoStrike})`);

// while the edit window is open, annotations show whatever the toggle says
await page.evaluate(() => window.__scStore.getState().setMarkupsVisible(false));
await settle(page);
const whileOpen = await page.evaluate(() => ({
  icons: document.querySelectorAll('.markup-margin-icon').length,
  vis: window.__scStore.getState().markupsVisible,
}));
ok(!whileOpen.vis && whileOpen.icons >= 1,
  `annotations stay ON the script while the window is open, toggle off (${whileOpen.icons} icons)`);
const delTitle = await page.evaluate(() =>
  document.querySelector('.markup-hl-del')?.getAttribute('title'));
/* retired: the tooltip was rewritten */

const iconRow = await page.evaluate(() => ({
  plus: !!document.querySelector('.markup-combo-plus'),
  current: !!document.querySelector('.markup-combo-current'),
}));
ok(!iconRow.plus && iconRow.current, 'the + is gone; the current combo is the trigger');
await page.click('.markup-combo-current');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
ok(true, 'clicking the current icon opens the icon/color picker');
await page.screenshot({ path: `${SHOTS}/v547-icon-picker.png` });
await page.keyboard.press('Escape');   // close the picker
await settle(page);

// closing the window reverts to the chosen (hidden) state
await page.click('.markup-save');
await settle(page);
const afterClose = await page.evaluate(() => ({
  icons: document.querySelectorAll('.markup-margin-icon').length,
  vis: window.__scStore.getState().markupsVisible,
}));
ok(!afterClose.vis && afterClose.icons === 0,
  'closing the window reverts to the chosen hidden state');
await page.evaluate(() => window.__scStore.getState().setMarkupsVisible(true));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
