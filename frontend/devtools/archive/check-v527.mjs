// devtools/check-v527.mjs — Annotations polish: solid colored icons with a
// colored 2px ring + Design scale knob, segmented status/state toggles,
// "Delete Annotation", no card checkbox, no header eye, the left-aligned
// "Show" control with its own state row + helper texts.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v527';
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
await openTool(page, 'Annotations');

// one range annotation (yellow highlight) + close its popover
await page.evaluate(() => {
  const ed = window.__scEditor;
  let scenes = 0, from = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'sceneHeading') { scenes++; return true; }
    if (scenes === 2 && from < 0 && node.type.name === 'action') { from = pos + 1; return false; }
    return true;
  });
  ed.chain().setTextSelection({ from, to: from + 16 }).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });

// ── 1. ⋮ menu: same-row status toggle + Delete Annotation ────────────────
await page.click('.fs-markup-popover .markup-dots-btn');
await page.waitForSelector('.markup-dots-pop', { timeout: 4000 });
let dots = await page.evaluate(() => {
  const seg = document.querySelector('.markup-dots-pop .markup-seg');
  const btns = seg ? [...seg.querySelectorAll('button')] : [];
  const tops = btns.map((b) => b.getBoundingClientRect().top);
  return {
    labels: btns.map((b) => b.textContent),
    sameRow: tops.length === 2 && Math.abs(tops[0] - tops[1]) < 1,
    del: [...document.querySelectorAll('.markup-dots-item')].some((el) => el.textContent?.trim() === 'Delete Annotation'),
  };
});
ok(dots.labels.join(',') === 'Open,Complete', `status is a toggle pair (${dots.labels.join('/')})`);
ok(dots.sameRow, 'Open and Complete sit in the SAME row');
ok(dots.del, 'the delete item reads "Delete Annotation"');
// complete via the toggle — the popover's annotation
await page.click('.markup-dots-pop .markup-seg button:nth-child(2)');
ok(await page.evaluate(() => window.__scStore.getState().markups[0].done) === true,
  'the Complete toggle sets the status');
await page.screenshot({ path: `${SHOTS}/dots.png` });
await page.evaluate(() => window.__scStore.getState().updateMarkup(window.__scStore.getState().markups[0].id, { done: false }));
await page.keyboard.press('Escape');   // close popover (menu already closed on pick)
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

// ── 2. margin icon: solid glyph, colored 2px ring, Design scale ──────────
let ring = await page.evaluate(() => {
  const s = window.__scStore.getState();
  const el = document.querySelector('.markup-margin-icon');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const glyphPath = el.querySelector('svg path')?.getAttribute('d') ?? '';
  return {
    borderW: cs.borderTopWidth,
    borderC: cs.borderTopColor,
    color: s.markups[0].color,
    w: el.getBoundingClientRect().width,
    solidFlag: glyphPath.length > 0 && !glyphPath.includes('M91.7'),  // sanity: some path rendered
  };
});
const hex2rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
ok(ring && ring.borderW === '2px', `ring is 2px (${ring?.borderW})`);
ok(ring && ring.borderC === hex2rgb(ring.color), `ring wears the annotation's color (${ring?.borderC})`);
ok(ring && Math.round(ring.w) === 22, `100% scale = 22px chip (${ring?.w})`);
await page.evaluate(() => window.__scStore.getState().setMarkupIconScalePct(150));
await page.waitForTimeout(150);
ring = await page.evaluate(() => document.querySelector('.markup-margin-icon')?.getBoundingClientRect().width);
ok(Math.round(ring) === 33, `Design scale 150% → 33px chip (${ring})`);
await page.screenshot({ path: `${SHOTS}/margin-scaled.png` });
await page.evaluate(() => window.__scStore.getState().setMarkupIconScalePct(100));

// ── 3. cards: no checkbox; header: no eye ────────────────────────────────
ok(await page.$('.markup-card-check') === null, 'card checkbox is gone (status lives in ⋮)');
ok(await page.$('.tags-visibility-btn') === null, 'the header eye is gone');

// ── 4. the Show control: left-aligned, no icon, its own state row ────────
const header = await page.evaluate(() => {
  const show = document.querySelector('.markup-ctl-script');
  const filter = document.querySelector('.markup-ctl-filter');
  if (!show || !filter) return null;
  return {
    label: show.textContent?.trim(),
    hasIcon: !!show.querySelector('.tool-ctl-icon'),
    showLeft: show.getBoundingClientRect().left,
    filterLeft: filter.getBoundingClientRect().left,
    leadClass: show.className.includes('tool-ctl-lead'),
  };
});
ok(header?.label === 'Show', `the control reads "Show" ("${header?.label}")`);
ok(header && !header.hasIcon, 'no icon on the Show control');
ok(header && header.leadClass && header.showLeft < header.filterLeft, 'Show sits LEFT of the cluster');

await page.click('.markup-ctl-script');
await page.waitForSelector('.markup-filter-pop', { timeout: 4000 });
let pop = await page.evaluate(() => ({
  helps: [...document.querySelectorAll('.markup-filter-help')].map((el) => el.textContent),
  segTops: [...document.querySelectorAll('.markup-filter-pop .markup-seg button')].map((b) => Math.round(b.getBoundingClientRect().top)),
}));
ok(pop.helps.join('|') === 'Select one|Toggle visibility in script',
  `Show popover helper texts ("${pop.helps.join('" / "')}")`);
ok(pop.segTops.length === 3 && new Set(pop.segTops).size === 1, 'Open/Complete/All in ONE row');
await page.screenshot({ path: `${SHOTS}/show-pop.png` });
// state row drives the SCRIPT: Complete-only hides the open annotation
await page.click('.markup-filter-pop .markup-seg button:nth-child(2)');
await page.waitForTimeout(150);
const hidden = await page.evaluate(() => ({
  icons: document.querySelectorAll('.markup-margin-icon').length,
  hl: getComputedStyle(document.querySelector('.script-markup-highlight')).backgroundColor,
}));
ok(hidden.icons === 0, 'Show: Complete-only hides the open annotation\'s icon');
ok(hidden.hl === 'rgba(0, 0, 0, 0)', 'and neutralizes its highlight');
await page.click('.markup-filter-pop .markup-seg button:nth-child(3)');   // back to All
await bodyPress(page);

// ── 5. Filter popover: its grid helper text ──────────────────────────────
await page.click('.markup-ctl-filter');
await page.waitForSelector('.markup-filter-pop', { timeout: 4000 });
pop = await page.evaluate(() =>
  [...document.querySelectorAll('.markup-filter-help')].map((el) => el.textContent));
ok(pop.join('|') === 'Select one|Toggle visibility in tool window',
  `Filter popover helper texts ("${pop.join('" / "')}")`);
await page.screenshot({ path: `${SHOTS}/filter-pop.png` });
await bodyPress(page);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
