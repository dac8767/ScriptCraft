// devtools/check-v529.mjs — picker "Used" sections (live from annotations,
// combos in their used colors), light chips behind dark icons, the one-row
// popover head (Icon:/Highlight: labels + eye toggle) with Design knobs,
// and Import icon (file → 48px chip → usable everywhere).
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v529';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Annotations');

// two annotations: one range (yellow hl), one point recolored DARK
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 2 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 10 }).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
await page.evaluate(() => {
  const ed = window.__scEditor;
  ed.chain().setTextSelection(4).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.updateMarkup(s.markupEditorId, { color: '#101038', icon: 'star', iconManual: true });
});

// ── 1. head row: labels, single row, eye toggle ──────────────────────────
let head = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.markup-pop-grouplabel')].map((el) => el.textContent);
  return { labels, eye: !!document.querySelector('.markup-hl-eye') };
});
ok(head.labels.join('|') === 'Icon:', 'point annotation: "Icon:" label only (no highlight group)');
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
// open the RANGE annotation — it has the Highlight group
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupEditorId(s.markups.find((m) => m.anchor === 'range').id);
});
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
head = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.markup-pop-grouplabel')];
  const tops = labels.map((el) => Math.round(el.getBoundingClientRect().top));
  const eye = document.querySelector('.markup-hl-eye');
  return {
    labels: labels.map((el) => el.textContent),
    sameRow: new Set(tops).size === 1,
    eyeTitle: eye?.getAttribute('title'),
    eyeActive: eye?.className.includes('active'),
  };
});
ok(head.labels.join('|') === 'Icon:|Highlight:', `both labels present (${head.labels.join(' ')})`);
ok(head.sameRow, 'Icon and Highlight groups share ONE row');
ok(head.eyeTitle === 'Hide (or show) highlight in script', `eye title ("${head.eyeTitle}")`);
ok(head.eyeActive === true, 'eye starts ACTIVE (highlight shown by default)');
await page.click('.markup-hl-eye');
let hl = await page.evaluate(() => ({
  stored: window.__scStore.getState().markups.find((m) => m.anchor === 'range').highlight,
  swatches: document.querySelectorAll('.markup-pop-group .markup-swatch-color').length,
}));
ok(hl.stored === null, 'eye click hides the highlight');
ok(hl.swatches === 1, 'highlight color swatch collapses while hidden (icon color remains)');
await page.click('.markup-hl-eye');   // back on
await page.screenshot({ path: `${SHOTS}/head-row.png`, clip: await page.$('.fs-markup-popover').then((e) => e.boundingBox()) });

// Design knob: group gap drives the computed flex gap
await page.evaluate(() => document.documentElement.style.setProperty('--dz-anno-group-gap', '31px'));
const gap = await page.evaluate(() => getComputedStyle(document.querySelector('.markup-pop-head')).columnGap);
ok(gap === '31px', `--dz-anno-group-gap drives the head row (${gap})`);
await page.evaluate(() => document.documentElement.style.removeProperty('--dz-anno-group-gap'));

// ── 2. color picker: "Used" row from live annotations ────────────────────
await page.click('.markup-pop-group .markup-swatch-color');
await page.waitForSelector('.markup-color-pop .color-picker-popup', { timeout: 4000 });
const usedColors = await page.evaluate(() => ({
  label: document.querySelector('.color-picker-recent-label')?.textContent,
  colors: [...document.querySelectorAll('.color-picker-recent-row .color-picker-swatch')]
    .map((el) => el.style.backgroundColor),
}));
ok(usedColors.label === 'Used', `color picker section reads "Used" ("${usedColors.label}")`);
ok(usedColors.colors.length >= 1, `it lists the in-use icon colors (${usedColors.colors.join(', ')})`);
await page.keyboard.press('Escape');

// ── 3. icon picker: Used combos in their colors, dark → light chips ──────
await page.click('.markup-swatch-icon');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
const iconPop = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.markup-icon-pop .markup-pop-label')].map((el) => el.textContent);
  const usedRow = [...document.querySelectorAll('.markup-icon-pop .markup-icon-pop-row')].pop();
  const usedBtns = usedRow ? [...usedRow.querySelectorAll('.markup-preset')] : [];
  const usedColors = usedBtns.map((b) => b.querySelector('.markup-glyph')?.style.color ?? '');
  const darkStar = usedBtns.find((b) => b.querySelector('.markup-glyph')?.style.color === 'rgb(16, 16, 56)');
  return {
    labels,
    usedColors,
    darkHasChip: darkStar ? darkStar.className.includes('markup-light-chip') : null,
    chipBg: darkStar ? getComputedStyle(darkStar).backgroundColor : null,
    importBtn: !!document.querySelector('.markup-import-icon'),
  };
});
ok(iconPop.labels.includes('Used'), `icon picker has a Used section (${iconPop.labels.join(' · ')})`);
ok(iconPop.usedColors.length === 2 && new Set(iconPop.usedColors).size === 2,
  `Used combos wear THEIR OWN colors (${iconPop.usedColors.join(' / ')})`);
ok(iconPop.darkHasChip === true, 'the dark-colored combo wears the light chip');
ok(iconPop.chipBg === 'rgb(236, 236, 236)', `chip background is light (${iconPop.chipBg})`);
ok(iconPop.importBtn, 'Import icon… button present');
await page.screenshot({ path: `${SHOTS}/icon-picker.png` });

// ── 4. import a real image file → custom icon, selected + rendered ───────
await page.setInputFiles('.markup-icon-pop input[type="file"]', {
  name: 'probe.png', mimeType: 'image/png', buffer: PNG_1PX,
});
await page.waitForTimeout(400);
const custom = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const m = s.markups.find((x) => x.anchor === 'range');
  return {
    registry: s.markupCustomIcons.length,
    data: s.markupCustomIcons[0]?.data.startsWith('data:image/png'),
    picked: m.icon.startsWith('custom:'),
    manual: m.iconManual,
    rendered: !!document.querySelector('.fs-markup-popover .markup-swatch-icon .markup-custom-icon'),
  };
});
ok(custom.registry === 1 && custom.data, 'imported file lands in the registry as a 48px PNG data URL');
ok(custom.picked && custom.manual, 'the imported icon is selected on the annotation (hand pick)');
ok(custom.rendered, 'the swatch renders the imported image');
const marginImg = await page.evaluate(() =>
  !!document.querySelector('.markup-margin-icon .markup-custom-icon'));
ok(marginImg, 'the margin chip renders the imported image too');
await page.screenshot({ path: `${SHOTS}/imported.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
