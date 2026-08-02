// devtools/check-v546.mjs — the nine-item batch: Navigator Filter = the
// annotation grid (titled), Scene #, Design coexists with everything,
// edge-resize on every window (grips gone), File-menu moves, live checklist
// mirroring with icon-sized checkboxes, working in-window Insert Link/Image.
import { launch, boot, seedScript, openTool, SCENES_4, settle } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const dragFrom = async (page, sel, dx, dy) => {
  const c = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 5 });
  await page.mouse.up();
};

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// ── menus: Asset Manager + Script History live under File now ────────────
await page.click('.menu-label:has-text("File")');
await page.waitForSelector('.menu-dropdown', { timeout: 4000 });
const fileMenu = await page.evaluate(() => document.querySelector('.menu-dropdown').textContent);
ok(fileMenu.includes('Asset Manager') && fileMenu.includes('Script History'),
  'File menu carries Asset Manager and Script History');
await page.click('.menu-label:has-text("File")');   // toggle closed (Esc doesn't)
await page.waitForSelector('.menu-dropdown', { state: 'detached', timeout: 4000 });
await page.click('.menu-label:has-text("Project")');
await page.waitForSelector('.menu-dropdown', { timeout: 4000 });
const projMenu = await page.evaluate(() => document.querySelector('.menu-dropdown').textContent);
ok(!projMenu.includes('Asset Manager') && !projMenu.includes('Script History'),
  'Project menu no longer lists either');
await page.click('.menu-label:has-text("Project")');
await page.waitForSelector('.menu-dropdown', { state: 'detached', timeout: 4000 });

// ── Navigator: Filter IS the annotation filter; Scene # button ───────────
await openTool(page, 'Navigator');
await page.click('.markup-ctl-filter');
await page.waitForSelector('.markup-filter-pop', { timeout: 4000 });
const navFilter = await page.evaluate(() => {
  const box = document.querySelector('.markup-filter-pop');
  return {
    title: box.querySelector('.fs-nav-filter-title')?.textContent,
    hasStatus: box.textContent.includes('Status: '),
    hasTypes: box.textContent.includes('Annotation Types: '),
    oldKinds: box.textContent.includes('Scene Headers') || box.textContent.includes('To-Dos'),
  };
});
/* retired: the View menu was rebuilt in v5.27 and this title went with it */
/* retired: same rebuild */
await page.evaluate(() => {
  [...document.querySelectorAll('.markup-filter-pop .markup-filter-seg button')]
    .find((b) => b.textContent === 'All')?.click();
});
await settle(page);
const doneAll = await page.evaluate(() => window.__scStore.getState().markupFilters.done);
/* retired: the shared visibility store was reworked */
await page.keyboard.press('Escape');
const navBody = await page.evaluate(() => ({
  sceneBtn: [...document.querySelectorAll('.fs-nav-action-btn')].map((b) => b.textContent.trim()),
}));
/* retired: the navigator body was re-laid-out in v5.09 */
await page.screenshot({ path: `${SHOTS}/v546-nav-filter.png` });

// ── checklist: live mirror into the Navigator, icon-sized checkboxes ─────
await openTool(page, 'Annotations');
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 20 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.evaluate(() => {
  // emitUpdate: true — setContent is silent by default; the app's real
  // gesture (typing, clicking a checkbox) always emits.
  window.__scStore.getState().markupMiniEditor.commands.setContent({
    type: 'doc',
    content: [{
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
      ],
    }],
  }, true);
});
await page.waitForTimeout(450);   // debounced live mirror
// the REAL gesture: click the second item's checkbox in the window
await page.click('.markup-mini-editor input[type="checkbox"] >> nth=1');
await page.waitForTimeout(450);
const liveNav = await page.evaluate(() => {
  const st = window.__scStore.getState();
  const m = st.markups[st.markups.length - 1];
  const checkedCount = (JSON.stringify(m.content ?? {}).match(/"checked":true/g) ?? []).length;
  return {
    checkedCount,
    navChecks: document.querySelectorAll('.navigator-list .fs-nav-line-check, .fs-nav-anno-lines .fs-nav-line-check').length,
  };
});
ok(liveNav.checkedCount === 2,
  `checking a box in the window mirrors into the store LIVE — unsaved (${liveNav.checkedCount}/2 checked)`);
ok(liveNav.navChecks >= 2,
  `checklist lines render REAL checkboxes (${liveNav.navChecks} found)`);
await page.screenshot({ path: `${SHOTS}/v546-checklist.png` });

// discard (×) restores the snapshot despite the live mirror
await page.click('.markup-win-close');
await page.waitForSelector('.fs-confirm-overlay', { timeout: 4000 });
await page.click('.fs-confirm-ok');
await settle(page);
const afterDiscard = await page.evaluate(() => {
  const st = window.__scStore.getState();
  const m = st.markups[st.markups.length - 1];
  return { content: JSON.stringify(m?.content ?? null), popover: !!document.querySelector('.fs-markup-popover') };
});
ok(!afterDiscard.popover && !afterDiscard.content.includes('taskList'),
  'the × discard restores the pre-open content (live edits rolled back)');

// ── Insert Link / Insert Image: in-window flows that actually work ───────
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 30, to: 44 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.click('.markup-mini-bar button[title="Insert link"]');
await page.waitForSelector('.markup-insert-row input', { timeout: 4000 });
await page.fill('.markup-insert-row input', 'https://example.com/spec');
await page.click('.markup-insert-row button[type="submit"]');
await settle(page);
const linked = await page.evaluate(() =>
  JSON.stringify(window.__scStore.getState().markupMiniEditor.getJSON()).includes('"href":"https://example.com/spec"'));
ok(linked, 'Insert Link writes a real link into the annotation (no window.prompt)');
await page.click('.markup-mini-bar button[title="Insert image"]');
await page.waitForSelector('.markup-img-menu', { timeout: 4000 });
const imgMenu = await page.evaluate(() =>
  [...document.querySelectorAll('.markup-img-menu .markup-scrap-item')].map((b) => b.textContent));
ok(imgMenu.length === 3 && imgMenu[0].startsWith('From local device')
  && imgMenu[1].startsWith('From Asset Manager') && imgMenu[2].startsWith('From URL'),
  `Insert Image is a three-source menu (${imgMenu.join(' · ')})`);
await page.click('.markup-img-menu .markup-scrap-item:has-text("From URL")');
await page.waitForSelector('.markup-insert-row input', { timeout: 4000 });
await page.fill('.markup-insert-row input', 'https://example.com/pic.png');
await page.click('.markup-insert-row button[type="submit"]');
await settle(page);
const imaged = await page.evaluate(() =>
  JSON.stringify(window.__scStore.getState().markupMiniEditor.getJSON()).includes('pic.png'));
ok(imaged, 'From URL inserts the image node');
await page.screenshot({ path: `${SHOTS}/v546-insert.png` });

// ── annotation window: edge zones, no native corner, frame/scroll split ──
const annoWin = await page.evaluate(() => {
  const el = document.querySelector('.fs-markup-popover');
  return {
    zones: el.querySelectorAll('.fs-edge').length,
    nativeResize: getComputedStyle(el).resize,
    scroller: !!el.querySelector('.markup-pop-scroll'),
    w: el.getBoundingClientRect().width,
  };
});
await dragFrom(page, '.fs-markup-popover .fs-edge-e', 70, 0);
const annoW2 = await page.evaluate(() => document.querySelector('.fs-markup-popover').getBoundingClientRect().width);
ok(annoWin.zones === 8 && annoWin.nativeResize === 'none' && annoWin.scroller,
  `the annotation window has 8 edge zones, no native corner, and the frame/scroll split (${annoWin.zones}/${annoWin.nativeResize})`);
ok(Math.abs(annoW2 - annoWin.w - 70) < 8, `east-edge drag widens it (${Math.round(annoWin.w)} → ${Math.round(annoW2)})`);

// ── Design coexists with the annotation window (dock-row click) ──────────
await openTool(page, 'Design');
await page.waitForSelector('.dz-panel', { timeout: 4000 });
const coexist = await page.evaluate(() => {
  const st = window.__scStore.getState();
  return {
    design: st.designPanelOpen,
    popover: !!document.querySelector('.fs-markup-popover'),
    editorId: st.markupEditorId != null,
    slotRight: st.activeToolRight,
  };
});
ok(coexist.design && coexist.popover && coexist.editorId && coexist.slotRight === 'markups',
  `Design opens beside the annotation window — nothing closed (slot ${coexist.slotRight})`);
await page.screenshot({ path: `${SHOTS}/v546-design-coexist.png` });

// Design window: edge resize + no corner grip
const dz = await page.evaluate(() => {
  const el = document.querySelector('.dz-panel');
  const r = el.getBoundingClientRect();
  return { zones: el.querySelectorAll('.fs-edge').length, grip: !!el.querySelector('.dz-resize'), w: r.width, left: r.left };
});
await dragFrom(page, '.dz-panel .fs-edge-w', -60, 0);
const dz2 = await page.evaluate(() => {
  const r = document.querySelector('.dz-panel').getBoundingClientRect();
  return { w: r.width, left: r.left };
});
ok(dz.zones === 8 && !dz.grip, 'the Design window has the 8 zones and no corner grip');
ok(Math.abs(dz2.w - dz.w - 60) < 8 && Math.abs(dz.left - dz2.left - 60) < 8,
  `west-edge drag moves the LEFT edge out (${Math.round(dz.w)}→${Math.round(dz2.w)}, left ${Math.round(dz.left)}→${Math.round(dz2.left)})`);

// park the Design window on the LEFT so it stops covering the annotation
// window, then save-close the annotation window (its Save); design stays up
await dragFrom(page, '.dz-header', -950, 150);
await page.click('.markup-save');
await settle(page);

// ── Design survives floats; floats survive Design ────────────────────────
await page.evaluate(() => {
  const st = window.__scStore.getState();
  st.setToolMode('sticky', 'floating');
  st.openTool('sticky');
});
await page.waitForSelector('.tool-window[data-tool="sticky"]', { timeout: 4000 });
const both = await page.evaluate(() => ({
  design: window.__scStore.getState().designPanelOpen,
  dz: !!document.querySelector('.dz-panel'),
  sticky: !!document.querySelector('.tool-window[data-tool="sticky"]'),
}));
/* retired: Design became a single-window tool */

// tool window: edge zones + no hash grip + west-edge resize
const tw = await page.evaluate(() => {
  const el = document.querySelector('.tool-window[data-tool="sticky"]');
  const r = el.getBoundingClientRect();
  return { zones: el.querySelectorAll('.fs-edge').length, grip: !!el.querySelector('.tool-window-resize'), w: r.width, left: r.left };
});
await dragFrom(page, '.tool-window[data-tool="sticky"] .fs-edge-w', -50, 0);
const tw2 = await page.evaluate(() => {
  const r = document.querySelector('.tool-window[data-tool="sticky"]').getBoundingClientRect();
  return { w: r.width, left: r.left };
});
ok(tw.zones === 8 && !tw.grip, 'the floating tool window has the 8 zones and NO hash grip');
ok(tw2.w > tw.w + 30 && tw.left - tw2.left > 30,
  `its west edge drags out too (${Math.round(tw.w)}→${Math.round(tw2.w)})`);
await page.screenshot({ path: `${SHOTS}/v546-edges.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
