// devtools/check-v549.mjs — the Design pop-out KISSES its panel's edge
// (right edge on the right panel's left edge, fresh open and after a dock
// cycle); the annotation previews stack left-aligned with Save pinned to
// the section's bottom-right (the foot row is gone).
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

const seatGap = () => page.evaluate(() => {
  const dz = document.querySelector('.dz-panel')?.getBoundingClientRect();
  const dock = document.querySelector('.tool-dock-wrap.tool-dock-right')?.getBoundingClientRect();
  if (!dz || !dock) return null;
  return { gap: dock.left - dz.right, onScreen: dz.left >= 0 && dz.top >= 0 };
});

/* v7.05, Derek ("move design window into the dev tab and remove it as an
   option from all toolbars and side panels"): the Design window is a DEVELOPER
   surface now. It has no dock row and no Customize/ribbon entry, and opens from
   Help ▸ Developer as a floating window.

   The v5.49 asserts that used to live here — that the pop-out kisses the right
   panel's edge on a fresh open and again after a dock cycle — are RETIRED
   rather than quietly dropped: they measured docking behaviour that the tool no
   longer has. What is still worth pinning is that the window opens, floating
   and fully on screen. check-v705 covers its absence from the pickers. */
await page.evaluate(() => window.__scStore.getState().openTool('design'));
await page.waitForSelector('.dz-panel', { timeout: 4000 });
await settle(page);
const onScreen = await page.evaluate(() => {
  const r = document.querySelector('.dz-panel')?.getBoundingClientRect();
  if (!r) return null;
  return {
    onScreen: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
    w: Math.round(r.width), h: Math.round(r.height),
  };
});
ok(onScreen && onScreen.onScreen && onScreen.w > 100,
  `Design opens from Help ▸ Developer, floating and fully on screen (${onScreen?.w}×${onScreen?.h})`);
const noRow = await page.evaluate(() => !document.querySelector('[data-tool-row="design"]'));
ok(noRow, 'and it has no side-panel dock row — it is not offered as a panel tool');
await page.screenshot({ path: `${SHOTS}/v549-design-seat.png` });
await page.click('.dz-close');

// ── annotation previews: stacked left, Save bottom-right in-section ─────
await openTool(page, 'Annotations');
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 30, to: 55 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
const layout = await page.evaluate(() => {
  const sec = document.querySelector('.markup-pop-preview').getBoundingClientRect();
  const lines = [...document.querySelectorAll('.markup-prev-line')];
  const [nav, script] = lines.map((l) => l.getBoundingClientRect());
  const labels = lines.map((l) => l.querySelector('.markup-pop-grouplabel').getBoundingClientRect());
  const save = document.querySelector('.markup-pop-preview .markup-save')?.getBoundingClientRect();
  return {
    two: lines.length === 2,
    stacked: nav && script && nav.bottom <= script.top + 2,
    leftAligned: labels.length === 2 && Math.abs(labels[0].left - labels[1].left) < 2,
    saveIn: !!save,
    saveRight: save && sec.right - save.right < 14,
    saveBottom: save && sec.bottom - save.bottom < 14,
    foot: !!document.querySelector('.markup-pop-foot'),
  };
});
ok(layout.two && layout.stacked && layout.leftAligned,
  'In Script sits UNDER In Navigator, both left-aligned');
ok(layout.saveIn && layout.saveRight && layout.saveBottom && !layout.foot,
  'Save rides the same section, pinned bottom-right (the foot row is gone)');
await page.screenshot({ path: `${SHOTS}/v549-preview.png` });

// highlight group hugs the head row's right edge
const hl = await page.evaluate(() => {
  const main = document.querySelector('.markup-pop-head-main').getBoundingClientRect();
  const grp = document.querySelector('.markup-hl-group')?.getBoundingClientRect();
  return grp ? { gap: main.right - grp.right } : null;
});
ok(hl && hl.gap >= 0 && hl.gap < 10, `the Highlight group aligns right (gap ${hl?.gap?.toFixed(0)}px)`);

// picker: white chips + a working × in its header
await page.click('.markup-combo-current');
await page.waitForSelector('.markup-icon-pop', { timeout: 4000 });
const picker = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.markup-icon-pop .markup-preset')];
  const whites = chips.filter((c) => getComputedStyle(c).backgroundColor === 'rgb(255, 255, 255)').length;
  return { chips: chips.length, whites, x: !!document.querySelector('.markup-icon-pop-close') };
});
ok(picker.x, 'the icon/color window has a × in its header');
ok(picker.chips > 10 && picker.whites === picker.chips,
  `every icon chip sits on white (${picker.whites}/${picker.chips})`);
await page.click('.markup-icon-pop-close');
await page.waitForSelector('.markup-icon-pop', { state: 'detached', timeout: 4000 });
ok(true, 'the × closes the picker');
await page.click('.markup-save');

// ── Pages stepper: one frame, tight arrows, number snug ──────────────────
await openTool(page, 'Pages');
await page.waitForSelector('.fs-updown', { timeout: 6000 });
/* v7.05: this block measured `.fs-pages-actions .tool-action-count`, which
   does not exist — the Pages row renders the SHARED PerRowStepper, whose
   number is its own typeable input (.fs-perrow-input), not a count span. The
   selector was stale, so the block threw and these two asserts had silently
   stopped running (v7.04 reported 8 of this file's 11). Measuring the input
   that is actually there restores the coverage the asserts were written for:
   one frame around both arrows, arrows tight, number snug beside them. */
const spin = await page.evaluate(() => {
  const wrap = document.querySelector('.fs-updown');
  const [up, down] = [...wrap.querySelectorAll('.fs-updown-btn')].map((b) => b.getBoundingClientRect());
  const num = document.querySelector('.fs-perrow-input').getBoundingClientRect();
  return {
    framed: getComputedStyle(wrap).borderTopWidth !== '0px',
    tight: down.top - up.bottom <= 1.5,
    numGap: num.left - wrap.getBoundingClientRect().right,
  };
});
ok(spin.framed && spin.tight, 'the arrows share ONE button frame, tight together');
ok(spin.numGap < 5, `the number sits snug beside the arrows (gap ${spin.numGap.toFixed(1)}px)`);
await page.fill('.fs-perrow-input', '6');
await settle(page);
const typed = await page.evaluate(() => ({
  n: window.__scStore.getState().pagesPerRow,
  cols: getComputedStyle(document.querySelector('.page-thumbnails-grid')).getPropertyValue('--pages-per-row').trim(),
}));
ok(typed.n === 6 && typed.cols === '6', `typing 6 sets pages per row (store ${typed.n}, grid ${typed.cols})`);
await page.fill('.fs-perrow-input', '3');
await settle(page);
await page.screenshot({ path: `${SHOTS}/v549-stepper.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
