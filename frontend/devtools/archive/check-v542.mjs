// devtools/check-v542.mjs — preview padding knobs, no phantom row between
// Icon and Highlight, ⋮ pinned top-right of the head row, and window
// resizing that grows the TEXT FIELD instead of leaving dead space.
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
await page.evaluate(() => window.__scEditor.chain().setTextSelection({ from: 4, to: 20 }).run());
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });

// ── 4: ⋮ pinned top-right of the head row, out of the title bar ──────────
const dots = await page.evaluate(() => {
  const inBar = !!document.querySelector('.markup-pop-titlebar .markup-dots-btn');
  const seat = document.querySelector('.markup-pop-head .markup-head-dots .markup-dots-btn');
  const head = document.querySelector('.markup-pop-head')?.getBoundingClientRect();
  const r = seat?.getBoundingClientRect();
  return { inBar, seated: !!seat, rightGap: seat && head ? Math.round(head.right - r.right) : null };
});
ok(!dots.inBar, 'the ⋮ left the title bar');
ok(dots.seated && dots.rightGap !== null && dots.rightGap <= 8,
  `and sits right-aligned in the top row (gap ${dots.rightGap}px)`);
const dotsWork = await (async () => {
  await page.click('.markup-pop-head .markup-dots-btn');
  const opened = await page.waitForSelector('.markup-dots-pop', { timeout: 3000 }).then(() => true).catch(() => false);
  await page.keyboard.press('Escape');
  return opened;
})();
ok(dotsWork, 'its menu still opens from the new seat');

// ── 2: narrow window — highlight wraps close under, ⋮ stays on row 1 ─────
ok(await page.evaluate(() => !document.querySelector('.markup-pop-head .markup-pop-spacer')),
  'the head spacer is gone');
await page.evaluate(() => {
  // grow the Used row so 310px is GENUINELY tight (removed again below)
  const s = window.__scStore.getState();
  ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'].forEach((color, i) => s.addMarkup({
    id: `probe-used-${i}`, content: null, icon: 'star', color, highlight: null,
    anchor: 'point', done: false, createdAt: '2026-07-29T00:00:00.000Z',
  }));
  const el = document.querySelector('.fs-markup-popover');
  el.style.width = '310px';
});
await page.waitForTimeout(200);
const narrow = await page.evaluate(() => {
  const icon = document.querySelector('.markup-pop-icon-group').getBoundingClientRect();
  const hl = document.querySelector('.markup-pop-head-main .markup-pop-group:not(.markup-pop-icon-group)').getBoundingClientRect();
  const dotsR = document.querySelector('.markup-head-dots').getBoundingClientRect();
  return {
    wrapped: hl.top > icon.top + 8,
    gap: Math.round(hl.top - icon.bottom),
    dotsOnRow1: Math.abs(dotsR.top - icon.top) < 14,
  };
});
ok(narrow.wrapped, 'tight window: the highlight group wraps to the next line');
ok(narrow.gap <= 18, `with NO phantom row between (gap ${narrow.gap}px)`);
ok(narrow.dotsOnRow1, 'while the ⋮ stays LOCKED on the top row');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  for (let i = 0; i < 6; i++) s.removeMarkup(`probe-used-${i}`);
});
await page.waitForTimeout(120);

// ── 3: growing the window grows the TEXT FIELD ───────────────────────────
const beforeGrow = await page.evaluate(() => {
  const ed = document.querySelector('.markup-mini-editor').getBoundingClientRect();
  return Math.round(ed.height);
});
await page.evaluate(() => {
  const el = document.querySelector('.fs-markup-popover');
  el.style.width = '420px';
  el.style.height = `${el.getBoundingClientRect().height + 220}px`;
});
await page.waitForTimeout(150);
const grow = await page.evaluate(() => {
  const win = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  const ed = document.querySelector('.markup-mini-editor').getBoundingClientRect();
  const foot = document.querySelector('.markup-pop-foot').getBoundingClientRect();
  return { edH: Math.round(ed.height), deadSpace: Math.round(win.bottom - foot.bottom) };
});
ok(grow.edH >= beforeGrow + 170,
  `the text field absorbed the growth (${beforeGrow}px → ${grow.edH}px)`);
ok(grow.deadSpace <= 20, `no dead space under Save (${grow.deadSpace}px)`);
await page.screenshot({ path: `${SHOTS}/v542-grown.png` });

// ── 1: the preview paddings are Design-driven (all four sides) ───────────
const pads = await page.evaluate(() => {
  const root = document.documentElement;
  root.style.setProperty('--dz-anno-prev-pad-left', '30px');
  root.style.setProperty('--dz-anno-prev-pad-bottom', '22px');
  const cs = getComputedStyle(document.querySelector('.markup-pop-preview'));
  return { l: cs.paddingLeft, b: cs.paddingBottom, t: cs.paddingTop };
});
ok(pads.l === '30px' && pads.b === '22px' && pads.t === '8px',
  `preview padding knobs drive all sides (t ${pads.t} / l ${pads.l} / b ${pads.b})`);

// ── 5: the panel's ONE Filter with two labeled sections ──────────────────
await page.keyboard.press('Escape');   // close the annotation window (saves)
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });
const header = await page.evaluate(() => ({
  filter: !!document.querySelector('.markup-ctl-filter'),
  oldScript: !!document.querySelector('.markup-ctl-script'),
  label: document.querySelector('.markup-ctl-filter .tool-ctl-label')?.textContent,
}));
ok(header.filter && !header.oldScript && header.label === 'Filter',
  `ONE "Filter" button replaces Script/Window (${header.label})`);
await page.click('.markup-ctl-filter');
await page.waitForSelector('.markup-filter-combined', { timeout: 4000 });
const combined = await page.evaluate(() => {
  const box = document.querySelector('.markup-filter-combined');
  const t = box.textContent;
  return {
    scriptSection: t.includes('Show in Script'),
    windowSection: t.includes('Show In Window'),
    statusLabels: (t.match(/Status: /g) ?? []).length,
    typeLabels: (t.match(/Annotation Types: /g) ?? []).length,
    noSelectOne: !t.includes('Select one'),
    noOldHelp: !t.includes('Toggle visibility'),
    grids: box.querySelectorAll('.markup-filter-grid').length,
  };
});
ok(combined.scriptSection && combined.windowSection, 'both sections present');
ok(combined.statusLabels === 2 && combined.typeLabels === 2,
  `each section has "Status: " and "Annotation Types: " (${combined.statusLabels}/${combined.typeLabels})`);
ok(combined.noSelectOne && combined.noOldHelp, 'the old helper texts are gone');
// the Script section's grid drives the SCRIPT list; the Window one the panel
await page.evaluate(() => {
  const grids = document.querySelectorAll('.markup-filter-combined .markup-filter-grid');
  grids[0].querySelector('button')?.click();
});
await page.waitForTimeout(120);
ok(await page.evaluate(() => window.__scStore.getState().markupHiddenIcons.length === 1),
  'Script-section toggle writes markupHiddenIcons');
await page.evaluate(() => {
  const grids = document.querySelectorAll('.markup-filter-combined .markup-filter-grid');
  grids[1].querySelector('button')?.click();
});
await page.waitForTimeout(120);
ok(await page.evaluate(() => window.__scStore.getState().markupFilters.hiddenIcons.length === 1),
  'Window-section toggle writes markupFilters');
await page.screenshot({ path: `${SHOTS}/v542-filter.png` });
await page.keyboard.press('Escape');

// ── 6: View menu items lose their "Show" prefix ──────────────────────────
await page.click('.menu-item:has-text("View")');
await page.waitForTimeout(200);
const viewMenu = await page.evaluate(() => {
  const t = document.body.textContent;
  return {
    rulers: t.includes('Rulers') && !t.includes('Show Rulers'),
    nums: t.includes('Scene Numbers') && !t.includes('Show Scene Numbers'),
  };
});
ok(viewMenu.rulers, 'View ▸ "Rulers" (no Show prefix)');
ok(viewMenu.nums, 'View ▸ "Scene Numbers" (no Show prefix)');
await page.keyboard.press('Escape');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
