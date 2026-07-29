// devtools/check-v531.mjs — darker title bar; DELETE highlight converts
// range→point (annotation survives); "Add Highlighted Text in Script"
// pick-mode converts point→range (window stays open); the Used combos ride
// the window with a + opening the COMBINED icon+color picker.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v531';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Annotations');

// a RANGE annotation in scene 2
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 2 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 14 }).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });

// ── 1. darker title bar ──────────────────────────────────────────────────
const barBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.markup-pop-titlebar')).backgroundColor);
ok(barBg === 'rgba(0, 0, 0, 0.22)', `title bar is darker (${barBg})`);

// ── 2. the Used row rides the window; + opens the combined picker ────────
const head = await page.evaluate(() => ({
  usedChips: document.querySelectorAll('.markup-pop-icon-group .markup-preset').length,
  plus: !!document.querySelector('.markup-combo-plus'),
  oldSwatch: !!document.querySelector('.markup-pop-icon-group .markup-swatch'),
}));
ok(head.usedChips >= 2 && head.plus, `Used combos + the "+" sit ON the window (${head.usedChips} chips)`);
ok(!head.oldSwatch, 'the old single icon/color swatches are gone from the icon group');
await page.click('.markup-combo-plus');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
const combo = await page.evaluate(() => ({
  labels: [...document.querySelectorAll('.markup-icon-pop .markup-pop-label')].map((el) => el.textContent),
  colorWheel: !!document.querySelector('.markup-icon-pop .cp-sv'),
  colorSwatches: document.querySelectorAll('.markup-icon-pop .color-picker-swatch').length,
}));
ok(combo.labels.includes('All icons') && combo.labels.includes('Icon color'),
  `one window holds icons AND color (${combo.labels.join(' · ')})`);
ok(combo.colorWheel && combo.colorSwatches > 10, 'the color wheel + preset swatches are in it');
await page.screenshot({ path: `${SHOTS}/combo.png` });
// pick an icon (keeps open), then a preset color — both apply
await page.click('.markup-icon-pop .markup-pop-grid .markup-preset:nth-child(2)');   // star
ok(await page.evaluate(() => !!document.querySelector('.markup-icon-pop')), 'a bare icon pick keeps the combined window open');
await page.click('.markup-icon-pop .color-picker-swatch:nth-child(7)');   // #ff0000
let st = await page.evaluate(() => {
  const m = window.__scStore.getState().markups[0];
  return { icon: m.icon, color: m.color };
});
ok(st.icon === 'star' && st.color === '#ff0000', `icon + color both applied (${st.icon} ${st.color})`);
// Escape closes ONLY the combo window (its capture handler stops the key
// before the edit window's save-on-close hears it) — a body press would
// close the edit window too.
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
ok(await page.evaluate(() => !document.querySelector('.markup-icon-pop') && !!document.querySelector('.fs-markup-popover')),
  'Escape closes the combo picker, the edit window stays');

// v5.31 addendum: header buttons are the full-height tool-window format
const btnFmt = await page.evaluate(() => {
  const bar = document.querySelector('.markup-pop-titlebar').getBoundingClientRect();
  const btn = document.querySelector('.markup-win-close').getBoundingClientRect();
  return { same: Math.abs(btn.height - bar.height) < 1.5, flush: Math.abs(btn.bottom - bar.bottom) < 1.5 };
});
ok(btnFmt.same && btnFmt.flush, 'header buttons reach top-to-bottom of the bar');

// ── 3. DELETE highlight → point annotation on the same element ───────────
ok(await page.$('.markup-hl-del') !== null, 'the Highlight group offers Delete');
await page.click('.markup-hl-del');
await page.waitForTimeout(200);
st = await page.evaluate(() => {
  const m = window.__scStore.getState().markups[0];
  return {
    anchor: m.anchor,
    highlight: m.highlight,
    span: !!document.querySelector(`.script-markup-highlight[data-markup-id="${m.id}"]`),
    block: !!document.querySelector(`[data-markup-block="${m.id}"]`),
    addBtn: !!document.querySelector('.markup-add-hl'),
  };
});
ok(st.anchor === 'point' && st.highlight === null, 'deleting the highlight converts to a point annotation');
ok(!st.span && st.block, 'the mark left the doc; a block anchor took over on the same element');
ok(st.addBtn, 'the window now offers the link button');
const addLabel = await page.evaluate(() => document.querySelector('.markup-add-hl')?.textContent);
ok(addLabel === 'Link Script Text', `it reads "Link Script Text" ("${addLabel}")`);

// ── 4. Add Highlighted Text: pick mode keeps the window open ─────────────
await page.click('.markup-add-hl');
ok(await page.evaluate(() => document.querySelector('.markup-add-hl')?.textContent?.includes('Select text')),
  'pick mode announces itself on the button');
// select text in the SCRIPT while the window stays open
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 3 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 18 }).run();
  ed.view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await page.waitForTimeout(250);
st = await page.evaluate(() => {
  const m = window.__scStore.getState().markups[0];
  return {
    anchor: m.anchor,
    highlight: m.highlight,
    span: !!document.querySelector(`.script-markup-highlight[data-markup-id="${m.id}"]`),
    block: !!document.querySelector(`[data-markup-block="${m.id}"]`),
    winOpen: !!document.querySelector('.fs-markup-popover'),
  };
});
ok(st.winOpen, 'the edit window stayed open through the pick');
ok(st.anchor === 'range' && st.highlight === '#ffe066', 'the selection converted it to a range annotation (yellow)');
ok(st.span && !st.block, 'the mark is on the new text; the block anchor is gone');
await page.screenshot({ path: `${SHOTS}/window.png`, clip: await page.$('.fs-markup-popover').then((e) => e.boundingBox()) });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
