// devtools/check-v551.mjs — legacy insert buttons retired from the ribbon
// (default AND persisted layouts); the Annotations panel Filter sits right,
// left of Search; the pick prompt is a persistent centered banner (Escape
// cancels); the Navigator's Scene # became a View menu with three toggles.
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

// ── ribbon: the four legacy buttons are gone from a fresh layout ─────────
const ribbon = await page.evaluate(() =>
  [...document.querySelectorAll('.toolbar-ribbon button')].map((b) => b.title)
    .filter((t) => ['Insert Section', 'Insert Note', 'Add To-Do List', 'Insert Marker'].includes(t)));
ok(ribbon.length === 0, `no legacy insert buttons in the fresh ribbon (${ribbon.join(',') || 'none'})`);

// persisted layouts shed the tokens once (the v3.25 pattern)
await page.evaluate(() => {
  const key = 'opendraft:viewState';
  const vs = JSON.parse(localStorage.getItem(key) ?? '{}');
  vs.toolbarZonesSet = true;
  vs.toolbarLeft = ['b:undo', 'b:redo', 'b:insertSection', '2!b:insertNote', 'b:insertChecklist', 'c:insertMarker', 'b:customize'];
  vs.toolbarRight = [];
  localStorage.setItem(key, JSON.stringify(vs));
  localStorage.removeItem('opendraft:toolbarDropLegacyInserts551');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
const shed = await page.evaluate(() => {
  const vs = JSON.parse(localStorage.getItem('opendraft:viewState') ?? '{}');
  const bad = (vs.toolbarLeft ?? []).filter((t) =>
    ['b:insertSection', 'b:insertNote', 'b:insertChecklist', 'c:insertMarker'].includes(t.replace(/^2!/, '')));
  return { bad: bad.length, kept: (vs.toolbarLeft ?? []).includes('b:undo'), flag: !!localStorage.getItem('opendraft:toolbarDropLegacyInserts551') };
});
ok(shed.bad === 0 && shed.kept && shed.flag,
  `a persisted layout sheds the retired tokens once (kept undo, flag set)`);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
await page.waitForFunction(() => Boolean(window.__scEditor), { timeout: 10000 });
await page.evaluate(() => {
  const content = [];
  for (let s = 0; s < 4; s++) {
    content.push({ type: 'sceneHeading', content: [{ type: 'text', text: `EXT. PLACE ${s + 1} - DAY` }] });
    for (let i = 0; i < 6; i++) content.push({ type: 'action', content: [{ type: 'text', text: `Action ${i} with words on it for page ${s}.` }] });
  }
  window.__scEditor.commands.setContent({ type: 'doc', content });
});

// ── Annotations panel: Filter right-aligned, left of Search ──────────────
await openTool(page, 'Annotations');
await page.waitForSelector('.markup-ctl-filter', { timeout: 6000 });
const filterSeat = await page.evaluate(() => {
  const f = document.querySelector('.markup-ctl-filter').getBoundingClientRect();
  const s = document.querySelector('.tool-ctl-search-btn')?.getBoundingClientRect();
  return s ? { gap: s.left - f.right, ordered: f.right <= s.left } : null;
});
ok(filterSeat && filterSeat.ordered && filterSeat.gap < 30,
  `Filter hugs the right, just left of Search (gap ${filterSeat?.gap?.toFixed(0)}px)`);

// ── the pick banner: persistent, centered, big; Esc cancels ──────────────
await page.evaluate(() => window.__scEditor.chain().setTextSelection(2).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.markup-pick-banner', { timeout: 4000 });
await page.waitForTimeout(1600);   // a toast would be gone; the banner stays
const banner = await page.evaluate(() => {
  const b = document.querySelector('.markup-pick-banner-pill');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const host = document.querySelector('.editor-main').getBoundingClientRect();
  return {
    centered: Math.abs((r.left + r.width / 2) - (host.left + host.width / 2)) < 24,
    size: getComputedStyle(b).fontSize,
    nearTop: r.top - host.top < 60,
  };
});
ok(!!banner && banner.centered && banner.nearTop && parseFloat(banner.size) >= 14,
  `the banner sits top-center of the editor, large (${banner?.size})`);
await page.screenshot({ path: `${SHOTS}/v551-banner.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('.markup-pick-banner', { state: 'detached', timeout: 4000 });
ok(true, 'Escape cancels — the banner leaves');
await page.click('.markups-add-btn');
await page.waitForSelector('.markup-pick-banner', { timeout: 4000 });
await page.evaluate(() => {
  window.__scEditor.chain().focus().setTextSelection({ from: 30, to: 55 }).run();
  window.__scEditor.view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
const afterPick = await page.evaluate(() => ({
  banner: !!document.querySelector('.markup-pick-banner'),
  n: window.__scStore.getState().markups.length,
}));
ok(!afterPick.banner && afterPick.n === 1, 'highlighting text places the annotation and clears the banner');
await page.click('.markup-save');
await page.waitForTimeout(200);

// ── Navigator: the View menu drives numbers / annotations / headings ─────
await openTool(page, 'Navigator');
await page.waitForSelector('.fs-nav-list', { timeout: 6000 });
const noSceneBtn = await page.evaluate(() =>
  ![...document.querySelectorAll('.tool-ctl')].some((b) => b.textContent.trim() === 'Scene #'));
ok(noSceneBtn, 'the Scene # toggle button is gone');
await page.evaluate(() => {
  [...document.querySelectorAll('.tool-ctl')].find((b) => b.textContent.includes('View'))?.click();
});
await page.waitForSelector('.tool-ctl-menu', { timeout: 4000 });
const menuItems = await page.evaluate(() =>
  [...document.querySelectorAll('.tool-ctl-menu button')].map((b) => b.textContent.trim()));
ok(menuItems.includes('Scene Numbers') && menuItems.includes('Annotations') && menuItems.includes('Scene Headings'),
  `the View menu holds the three toggles (${menuItems.join(' / ')})`);
const counts = () => page.evaluate(() => ({
  scenes: [...document.querySelectorAll('.fs-nav-list [class*="fs-nav"]')].filter((el) => el.textContent.includes('EXT. PLACE')).length ? true : false,
  sceneRows: [...document.querySelectorAll('.fs-nav-list *')].filter((el) => el.children.length === 0 && el.textContent.startsWith('EXT. PLACE')).length,
  annoRows: document.querySelectorAll('.fs-nav-list .fs-nav-anno').length,
}));
const before = await counts();
await page.evaluate(() => {
  [...document.querySelectorAll('.tool-ctl-menu button')].find((b) => b.textContent.trim() === 'Scene Headings')?.click();
});
await page.waitForTimeout(200);
const noScenes = await counts();
await page.evaluate(() => {
  [...document.querySelectorAll('.tool-ctl-menu button')].find((b) => b.textContent.trim() === 'Annotations')?.click();
});
await page.waitForTimeout(200);
const noAnnos = await counts();
ok(before.sceneRows >= 4 && noScenes.sceneRows === 0,
  `Scene Headings toggle hides the scene rows (${before.sceneRows} → ${noScenes.sceneRows})`);
ok(before.annoRows >= 1 && noAnnos.annoRows === 0,
  `Annotations toggle hides the annotation rows (${before.annoRows} → ${noAnnos.annoRows})`);
// restore both + scene numbers off/on sanity
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.tool-ctl-menu button')];
  btns.find((b) => b.textContent.trim() === 'Scene Headings')?.click();
  btns.find((b) => b.textContent.trim() === 'Annotations')?.click();
});
await page.waitForTimeout(200);
const restored = await counts();
ok(restored.sceneRows >= 4 && restored.annoRows >= 1, 'toggling back restores both row kinds');
await page.screenshot({ path: `${SHOTS}/v551-view-menu.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
