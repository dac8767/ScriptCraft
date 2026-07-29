// devtools/check-v533.mjs — the 10-item batch: icon-in-menu, real scrapbook
// links, resizable windows, nav list rows, titlebar ⋮, head-row wrap,
// "Displays as:" preview, icon/panel seating, dark hover, Script/Window labels.
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

// a RANGE annotation (selection → auto highlight) so the Highlight group shows
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 24 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.waitForTimeout(250);   // icon layer + raf re-seat

// ── 8. seating: under the on-script icon, right edge on the panel edge ───
const seat = await page.evaluate(() => {
  const id = window.__scStore.getState().markupEditorId;
  const icon = document.querySelector(`.markup-margin-icon[data-markup-icon="${id}"]`)?.getBoundingClientRect();
  const win = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  const dock = document.querySelector('.tool-dock-wrap.tool-dock-right')?.getBoundingClientRect();
  return { icon, win, dock };
});
ok(!!seat.icon, 'the margin icon exists (data-markup-icon)');
ok(seat.dock && Math.abs(seat.win.right - seat.dock.left) <= 2,
  `window right edge sits on the panel's left edge (Δ ${seat.dock ? Math.round(seat.win.right - seat.dock.left) : '—'}px)`);
ok(seat.icon && Math.abs(seat.win.top - (seat.icon.bottom + 6)) <= 3,
  `and directly under the icon (Δ ${seat.icon ? Math.round(seat.win.top - seat.icon.bottom - 6) : '—'}px)`);

// ── 6. the ⋮ rides the title bar, LEFT of the fullscreen button ──────────
const bar = await page.evaluate(() => {
  const dots = document.querySelector('.markup-pop-titlebar .markup-dots-btn')?.getBoundingClientRect();
  const fs = document.querySelector('.markup-pop-titlebar button[title="Full screen"]')?.getBoundingClientRect();
  const head = document.querySelector('.markup-pop-head .markup-dots-btn');
  return { dots, fs, inHead: !!head };
});
ok(!!bar.dots, 'the ⋮ is in the title bar');
ok(!bar.inHead, 'and no longer in the head row');
ok(bar.dots && bar.fs && bar.dots.right <= bar.fs.left + 1, 'left of the fullscreen button');

// ── 1. ⋮ hide-type item wears the ICON, not the word ─────────────────────
await page.click('.markup-pop-titlebar .markup-dots-btn');
await page.waitForSelector('.markup-dots-pop', { timeout: 4000 });
const dots = await page.evaluate(() => {
  const item = document.querySelector('.markup-dots-hidetype');
  return {
    hasIcon: !!item?.querySelector('.markup-glyph, .markup-emoji, .markup-custom-icon'),
    text: item?.textContent?.trim(),
  };
});
ok(dots.hasIcon, 'the hide-type item carries the icon glyph');
ok(dots.text === 'Hidein script' || dots.text === 'Hide in script',
  `and no icon NAME in the label ("${dots.text}")`);
await page.keyboard.press('Escape');

// ── 6b. highlight group drops to a SECOND row when the Used row fills up ─
const headBefore = await page.evaluate(() => {
  const icon = document.querySelector('.markup-pop-icon-group').getBoundingClientRect();
  const hl = document.querySelector('.markup-pop-head .markup-pop-group:not(.markup-pop-icon-group)').getBoundingClientRect();
  return { iconTop: icon.top, hlTop: hl.top };
});
ok(Math.abs(headBefore.hlTop - headBefore.iconTop) <= 4, 'roomy: icon + highlight share one row');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  const colors = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];
  colors.forEach((color, i) => s.addMarkup({
    id: `probe-used-${i}`, content: null, icon: 'star', color, highlight: null,
    anchor: 'point', done: false, createdAt: '2026-07-29T00:00:00.000Z',
  }));
});
await page.waitForTimeout(150);
const headAfter = await page.evaluate(() => {
  const icon = document.querySelector('.markup-pop-icon-group').getBoundingClientRect();
  const hl = document.querySelector('.markup-pop-head .markup-pop-group:not(.markup-pop-icon-group)').getBoundingClientRect();
  return { iconTop: icon.top, hlTop: hl.top };
});
ok(headAfter.hlTop > headAfter.iconTop + 10, 'tight: the highlight group wrapped to a second row');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  for (let i = 0; i < 7; i++) s.removeMarkup(`probe-used-${i}`);
});
await page.waitForTimeout(100);

// ── 9. "Link Script Text"-style buttons keep DARK ink on hover ───────────
// (this annotation is a range one, so probe the class contract directly)
const inkOk = await page.evaluate(() => {
  const probe = document.createElement('button');
  probe.className = 'markup-hl-clear';
  document.querySelector('.fs-markup-popover').appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  const m = c.match(/rgba?\((\d+), (\d+), (\d+)/);
  return m ? (+m[1] + +m[2] + +m[3]) / 3 : 255;
});
ok(inkOk < 128, `hl-clear ink is dark on the light window (mean channel ${Math.round(inkOk)})`);

// ── 7. "Displays as:" — live Navigator preview ───────────────────────────
await page.click('.markup-mini-editor .ProseMirror');
await page.click('button[title="Checklist"]');
await page.keyboard.type('one');
await page.keyboard.press('Enter');
await page.keyboard.type('two');
await page.keyboard.press('Enter');
await page.keyboard.type('three');
await page.waitForTimeout(150);
const preview = await page.evaluate(() => {
  const box = document.querySelector('.markup-pop-preview');
  return {
    label: box?.querySelector('.markup-pop-grouplabel')?.textContent,
    hasIcon: !!box?.querySelector('.fs-nav-markup-icon'),
    lines: [...(box?.querySelectorAll('.fs-nav-anno-line') ?? [])].map((el) => el.textContent),
  };
});
ok(preview.label === 'Displays as:', `the preview section is labeled (${preview.label})`);
ok(preview.hasIcon, 'and shows the icon');
ok(preview.lines.length === 3 && preview.lines[0] === '☐ one',
  `and the 3 checklist lines, live (${JSON.stringify(preview.lines)})`);
await page.screenshot({ path: `${SHOTS}/v533-popover.png` });

// ── 2. scrapbook link: a REAL clickable link ─────────────────────────────
await page.evaluate(async () => {
  const { useNotebookStore } = await import('/src/stores/notebookStore.ts');
  useNotebookStore.getState().addPage();
});
await page.click('button[title="Link a Scrapbook page"]');
await page.waitForSelector('.markup-scrap-list', { timeout: 4000 });
await page.click('.markup-scrap-item');
const link = await page.evaluate(() => {
  const a = document.querySelector('.markup-mini-editor a');
  return a ? { href: a.getAttribute('href'), text: a.textContent } : null;
});
ok(link && link.href?.startsWith('scrapbook:'), `inserted as a REAL link (${link?.href})`);
ok(link && link.text?.startsWith('📖'), 'with the page title as link text, not raw HTML');

// ── 3+4. both windows are resizable ──────────────────────────────────────
const winResize = await page.evaluate(() => getComputedStyle(document.querySelector('.fs-markup-popover')).resize);
ok(winResize === 'both', `edit window resize: ${winResize}`);
await page.evaluate(() => {
  const el = document.querySelector('.fs-markup-popover');
  el.style.width = '460px'; el.style.height = '400px';   // what the handle writes
});
await page.waitForTimeout(120);
const kept = await page.evaluate(() => {
  const r = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});
ok(kept.w === 460 && kept.h === 400, `a user resize STICKS through re-renders (${kept.w}×${kept.h})`);
const seat2 = await page.evaluate(() => {
  const win = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  const dock = document.querySelector('.tool-dock-wrap.tool-dock-right')?.getBoundingClientRect();
  return dock ? Math.abs(win.right - dock.left) : 999;
});
ok(seat2 <= 2, `after resizing, the right edge STAYS on the panel edge (Δ ${Math.round(seat2)}px)`);
await page.click('.markup-combo-plus');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
const popResize = await page.evaluate(() => getComputedStyle(document.querySelector('.markup-icon-pop')).resize);
ok(popResize === 'both', `combined picker resize: ${popResize}`);
await page.keyboard.press('Escape');

// ── save-close, then the Navigator checks ────────────────────────────────
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

// ── 5. navigator: a 3-item list = 3 stacked ROWS ─────────────────────────
await openTool(page, 'Navigator');
await page.waitForTimeout(200);
const nav = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.fs-nav-item.markup .fs-nav-anno-line')];
  const tops = lines.map((el) => Math.round(el.getBoundingClientRect().top));
  return { n: lines.length, distinctRows: new Set(tops).size, texts: lines.map((el) => el.textContent) };
});
ok(nav.n === 3, `three list lines render (${nav.n})`);
ok(nav.distinctRows === 3, `and they STACK as three rows (${nav.distinctRows} distinct tops)`);
await page.screenshot({ path: `${SHOTS}/v533-navigator.png` });

// ── 10. panel labels: "Script" and "Window" ──────────────────────────────
// (the Navigator docks LEFT, so Annotations may still be open on the right —
//  a dock-row click on an OPEN tool toggles it closed; guard first)
if (!(await page.$('.markup-ctl-filter'))) await openTool(page, 'Annotations');
await page.waitForTimeout(150);
const labels = await page.evaluate(() => ({
  script: document.querySelector('.markup-ctl-script .tool-ctl-label')?.textContent,
  window: document.querySelector('.markup-ctl-filter .tool-ctl-label')?.textContent,
}));
ok(labels.script === 'Script', `the script-visibility button says "Script" (${labels.script})`);
ok(labels.window === 'Window', `the list filter says "Window" (${labels.window})`);

// ── 8b. no right panel → the window centers under the icon ───────────────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  if (s.shelfOpen) s.toggleShelf();
});
await page.waitForTimeout(150);
await page.click('.markup-margin-icon');
await page.waitForSelector('.fs-markup-popover', { timeout: 4000 });
await page.waitForTimeout(250);
const centered = await page.evaluate(() => {
  const id = window.__scStore.getState().markupEditorId;
  const icon = document.querySelector(`.markup-margin-icon[data-markup-icon="${id}"]`)?.getBoundingClientRect();
  const win = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  const dock = document.querySelector('.tool-dock-wrap.tool-dock-right')?.getBoundingClientRect();
  const dockGone = !dock || dock.width === 0;
  const iconCx = icon ? icon.left + icon.width / 2 : null;
  const winCx = win.left + win.width / 2;
  return { dockGone, delta: iconCx == null ? null : Math.abs(winCx - iconCx), edge: dock ? Math.abs(win.right - dock.left) : null };
});
ok(centered.dockGone ? centered.delta !== null && centered.delta <= 2 : centered.edge <= 2,
  centered.dockGone
    ? `panel closed → centered under the icon (Δ ${Math.round(centered.delta ?? 999)}px)`
    : `rail still showing → right edge tracks ITS left edge (Δ ${Math.round(centered.edge ?? 999)}px)`);
await page.screenshot({ path: `${SHOTS}/v533-seating.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
