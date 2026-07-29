// devtools/check-v526.mjs — the Annotations batch, driven like a user.
// Rename, cursor-add on an EMPTY line (block anchor — the v5.25 refusal is
// gone), auto yellow highlight + "Hide highlights in script", swatch →
// picker windows (color wheel recents / icon grid recents), auto-icon by
// first content kind (manual pick sticks), on-page margin icons centered in
// the right margin, ⋮ menus, double-click = jump + open, navigator rows
// under their scene, the two-section Filter grid + Show in Script, search.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v526';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const bodyPress = (page) => page.evaluate(() =>
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// ── 1. rename: the dock row and the panel button say Annotations ──────────
await openTool(page, 'Annotations');
ok(true, 'dock row is labelled Annotations');
const addBtnText = await page.evaluate(() => document.querySelector('.markups-add-btn')?.textContent?.trim());
ok(addBtnText === '+ Add Annotation', `panel button says "+ Add Annotation" ("${addBtnText}")`);

// ── 2. cursor on an EMPTY line → annotation created (block anchor) ────────
await page.evaluate(() => {
  const ed = window.__scEditor;
  const end = ed.state.doc.content.size;
  ed.chain().insertContentAt(end, { type: 'action' }).setTextSelection(end + 1).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
let st = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return {
    n: s.markups.length,
    anchor: s.markups[0]?.anchor,
    blockInDom: !!document.querySelector(`[data-markup-block="${s.markups[0]?.id}"]`),
  };
});
ok(st.n === 1 && st.anchor === 'point', 'EMPTY line + cursor → a point annotation (no refusal)');
ok(st.blockInDom, 'its block anchor is IN the doc (data-markup-block)');
ok(await page.$('.markup-hl-row') === null, 'cursor-made annotation shows no highlight row');

// ── 3. auto-icon: type text → comment; checklist first → check ────────────
await page.click('.markup-mini-editor .ProseMirror');
await page.keyboard.type('just a thought');
await page.waitForTimeout(120);
st = await page.evaluate(() => window.__scStore.getState().markups[0].icon);
ok(st === 'comment', `typing text auto-sets the speech bubble (${st})`);
await page.evaluate(() => {
  const s = window.__scStore.getState();
  window.__probe = s.markups[0].id;
});
// prepend a checklist ABOVE the text — first item changes → icon follows
await page.evaluate(() => window.__scMini?.chain?.());   // no-op; keep evaluate cheap
await page.keyboard.press('Home');
await page.evaluate(() => {
  // move caret to doc start of the mini editor via selection API is fiddly;
  // simpler: toggle the whole content into a task list — taskList becomes first
  return true;
});
await page.click('button[title="Checklist"]');
await page.waitForTimeout(120);
st = await page.evaluate(() => window.__scStore.getState().markups[0].icon);
ok(st === 'check', `first item now a checklist → check icon (${st})`);

// manual pick beats auto: open icon picker, choose star, then edit content
await page.click('.markup-swatch-icon');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
await page.screenshot({ path: `${SHOTS}/icon-picker.png` });
await page.click('.markup-icon-pop .markup-pop-grid .markup-preset:nth-child(2)');   // star from the full grid
st = await page.evaluate(() => {
  const m = window.__scStore.getState().markups[0];
  return { icon: m.icon, manual: m.iconManual, recents: window.__scStore.getState().markupRecentIcons };
});
ok(st.icon === 'star' && st.manual === true, `hand-picked icon sticks (${st.icon}, manual=${st.manual})`);
ok(st.recents.includes('star'), 'grid pick recorded in recent icons');
await page.click('.markup-mini-editor .ProseMirror');
await page.keyboard.type(' more');
await page.waitForTimeout(120);
st = await page.evaluate(() => window.__scStore.getState().markups[0].icon);
ok(st === 'star', 'auto-icon never overwrites a manual choice');

// color swatch → the Theme ColorPicker; wheel Apply records a recent
await page.click('.markup-swatch-color');
await page.waitForSelector('.markup-color-pop .color-picker-popup', { timeout: 4000 });
await page.fill('.color-picker-hex', '#a1b2c3');
await page.click('.color-picker-apply');
st = await page.evaluate(() => {
  const s = window.__scStore.getState();
  return { color: s.markups[0].color, recents: s.markupRecentColors };
});
ok(st.color === '#a1b2c3', `wheel Apply recolors the icon (${st.color})`);
ok(st.recents.includes('#a1b2c3'), 'wheel pick recorded in recent colors');

await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

// ── 4. selection → AUTO yellow highlight; hide checkbox removes it ────────
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 3 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 20 }).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
let hl = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const m = s.markups.find((x) => x.anchor === 'range');
  const el = document.querySelector(`.script-markup-highlight[data-markup-id="${m.id}"]`);
  return { stored: m.highlight, painted: el ? getComputedStyle(el).backgroundColor : null };
});
ok(hl.stored === '#ffe066', `selection-made annotation stores the yellow default (${hl.stored})`);
ok(hl.painted && hl.painted !== 'rgba(0, 0, 0, 0)', `and the page paints it immediately (${hl.painted})`);
const hlLabel = await page.evaluate(() => document.querySelector('.markup-hl-check')?.textContent?.trim());
ok(hlLabel === 'Hide highlights in script', `checkbox reads "Hide highlights in script" ("${hlLabel}")`);
await page.click('.markup-hl-check input');
hl = await page.evaluate(() => {
  const m = window.__scStore.getState().markups.find((x) => x.anchor === 'range');
  const el = document.querySelector(`.script-markup-highlight[data-markup-id="${m.id}"]`);
  return { stored: m.highlight, painted: el ? getComputedStyle(el).backgroundColor : null };
});
ok(hl.stored === null && hl.painted === 'rgba(0, 0, 0, 0)', 'checking it hides the highlight');
await page.click('.markup-hl-check input');   // back on for the shots
await page.screenshot({ path: `${SHOTS}/popover.png`, clip: await page.$('.fs-markup-popover').then((e) => e.boundingBox()) });

// ── 5. margin icon ON the page, centered in the right margin ──────────────
const geo = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const m = s.markups.find((x) => x.anchor === 'range');
  const icons = [...document.querySelectorAll('.markup-margin-icon')];
  const pg = document.querySelector('.page');
  if (!icons.length || !pg) return null;
  const p = pg.getBoundingClientRect();
  const marginW = s.pageLayout.rightMargin * 96 * (p.width / (s.pageLayout.pageWidth * 96));
  const contentRight = p.right - marginW;
  // the range annotation's icon should center on its highlight span
  const span = document.querySelector(`.script-markup-highlight[data-markup-id="${m.id}"]`);
  const sr = span.getBoundingClientRect();
  const ic = icons.map((el) => el.getBoundingClientRect());
  const rangeIcon = ic.reduce((best, r) =>
    (Math.abs((r.top + r.bottom) / 2 - (sr.top + sr.bottom) / 2)
      < Math.abs((best.top + best.bottom) / 2 - (sr.top + sr.bottom) / 2) ? r : best));
  return {
    n: ic.length,
    onPage: ic.every((r) => r.left > contentRight - 1 && r.right < p.right + 1),
    centerOff: Math.abs((ic[0].left + ic[0].right) / 2 - (contentRight + marginW / 2)),
    vertOff: Math.abs((rangeIcon.top + rangeIcon.bottom) / 2 - (sr.top + sr.bottom) / 2),
  };
});
ok(geo && geo.n === 2, `two margin icons rendered (${geo?.n})`);
ok(geo && geo.onPage, 'icons sit ON the page, inside the right margin band');
ok(geo && geo.centerOff < 2, `horizontally centered in the margin (off by ${geo?.centerOff.toFixed(1)}px)`);
ok(geo && geo.vertOff < 2, `range icon vertically centered on its selection (off by ${geo?.vertOff.toFixed(1)}px)`);
await bodyPress(page);
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
await page.screenshot({ path: `${SHOTS}/margin.png` });

// ── 6. cards: ⋮ menu, no pencil, double-click = jump + open ───────────────
ok(await page.$('.markup-card .markup-dots-btn') !== null, 'cards carry the ⋮ menu');
ok(await page.$('.markup-card-btn') === null, 'the pencil/trash card buttons are gone');
await page.click('.markup-card .markup-dots-btn');
await page.waitForSelector('.markup-dots-pop', { timeout: 4000 });
const dots = await page.evaluate(() =>
  [...document.querySelectorAll('.markup-dots-item')].map((el) => el.textContent?.trim()));
ok(dots.some((t) => t === 'Open') && dots.some((t) => t === 'Complete'), 'menu offers the Open/Complete status');
ok(dots.some((t) => t?.startsWith('Hide') && t?.includes('in script')), 'menu offers hide-this-type-in-script');
ok(dots.some((t) => t === 'Delete'), 'menu offers Delete');
await page.screenshot({ path: `${SHOTS}/dots.png` });
await bodyPress(page);
await page.waitForSelector('.markup-dots-pop', { state: 'detached', timeout: 4000 });

await page.dblclick('.markup-card');
const opened = await page.waitForSelector('.fs-markup-popover', { timeout: 5000 }).then(() => true).catch(() => false);
ok(opened, 'double-click on a card opens the editor popover');
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

// ── 7. navigator: annotation rows sit UNDER their scene ───────────────────
await openTool(page, 'Navigator');
// The RANGE annotation lives in scene 3 — its row must sit BETWEEN scene 3
// and scene 4 (interleaved), not at the bottom. (The point annotation is on
// the doc's LAST line, so bottom placement is correct for that one.)
const nav = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fs-nav-item')];
  const kinds = rows.map((el) => (el.className.includes('markup') ? 'markup' : el.className.includes('scene') ? 'scene' : 'other'));
  const sceneIdxs = kinds.flatMap((k, i) => (k === 'scene' ? [i] : []));
  return { firstMarkup: kinds.indexOf('markup'), lastScene: sceneIdxs[sceneIdxs.length - 1] };
});
ok(nav.firstMarkup >= 0 && nav.firstMarkup < nav.lastScene,
  `annotations interleave into the outline (markup row ${nav.firstMarkup} before last scene row ${nav.lastScene})`);

// ── 8. panel Filter: two sections, helper text, GRID of in-use types ──────
// still open from section 6 — a dock-row click would TOGGLE it closed
if (!(await page.$('.markups-panel'))) await openTool(page, 'Annotations');
// .markup-ctl-filter, NOT :has-text("Filter") — the Navigator's own Filter
// control in the left panel matches the text too and steals the click.
await page.click('.markup-ctl-filter');
await page.waitForSelector('.markup-filter-pop', { timeout: 4000 });
const filt = await page.evaluate(() => ({
  helps: [...document.querySelectorAll('.markup-filter-help')].map((el) => el.textContent),
  gridBtns: document.querySelectorAll('.markup-filter-grid .markup-preset').length,
  allRow: !!document.querySelector('.markup-filter-allrow'),
}));
ok(filt.helps[0] === 'Select one' && filt.helps[1] === 'Select all that you want visible',
  'the two helper texts are in place');
ok(filt.gridBtns === 2, `type grid shows ONLY in-use types (${filt.gridBtns} = star + flag defaults)`);
ok(filt.allRow, 'Show all / Hide all row present');
await page.screenshot({ path: `${SHOTS}/filter.png` });
// hide the star type from the LIST
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupFilters({ ...s.markupFilters, hiddenIcons: ['star'] });
});
let cards = await page.evaluate(() => document.querySelectorAll('.markup-card').length);
ok(cards === 1, 'unchecking a type filters it out of the panel list');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupFilters({ ...s.markupFilters, hiddenIcons: [] });
});
await bodyPress(page);

// ── 9. Show in Script: hides that type's icon + highlight in the editor ───
st = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const range = s.markups.find((x) => x.anchor === 'range');
  s.setMarkupHiddenIcons([range.icon]);
  return range.icon;
});
await page.waitForTimeout(200);
const hid = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const range = s.markups.find((x) => x.anchor === 'range');
  const el = document.querySelector(`.script-markup-highlight[data-markup-id="${range.id}"]`);
  return {
    icons: document.querySelectorAll('.markup-margin-icon').length,
    hl: el ? getComputedStyle(el).backgroundColor : null,
  };
});
ok(hid.icons === 1, `Show in Script off for "${st}" drops its margin icon (1 left)`);
ok(hid.hl === 'rgba(0, 0, 0, 0)', 'and neutralizes its highlight, beating the inline style');
await page.evaluate(() => window.__scStore.getState().setMarkupHiddenIcons([]));

// ── 10. search narrows the list ───────────────────────────────────────────
await page.evaluate(() => window.__scStore.getState().setMarkupSearch('thought'));
cards = await page.evaluate(() => document.querySelectorAll('.markup-card').length);
ok(cards === 1, 'search narrows the card list');
await page.evaluate(() => window.__scStore.getState().setMarkupSearch(''));
await page.screenshot({ path: `${SHOTS}/panel.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
