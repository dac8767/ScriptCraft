/* check-v775 — three rows off the feedback queue.
 *
 *   "windows should always sit on top of the side panels. the pages window is
 *    currently behind the right side panel"
 *   "the outline presets should just be sections, not beats"
 *   "if i click 'freeform' in the outline window, it creates a new outline tab.
 *    freeform and sections are just two ways to look at the same outline tab
 *    info. it should not create a new tab."
 *
 * THE FIRST IS THE STACKING-CONTEXT TRAP, the one CLAUDE.md names. A popped-out
 * window is rendered INSIDE the panel it came from, and .tool-dock-wrap carried
 * z-index: 50 — which made it a stacking context, so the window's own z-120
 * could only sort it against its siblings inside that panel. The other panel is
 * a sibling wrap at the same level and later in the DOM, so it painted over a
 * window popped out of the left one. Nothing about the window's z-index could
 * have fixed that.
 *
 * So the assertion cannot be about z-index numbers: it has to ask WHAT IS ON
 * TOP where the two actually overlap, and it has to check the ruler too — z-50
 * was added in v4.22 to keep windows above it, and this removes it.
 *
 * THE THIRD was a deliberate design being overturned. v2.47 made the
 * arrangement toggle NAVIGATE ("a tab keeps its arrangement for life"); Derek
 * says the two are views of one tab. The check has to prove both halves — no
 * new tab, no jump, and the SAME beats either way — because a toggle that
 * silently emptied the board would also pass "it did not create a tab".
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await settle(page);

/* ── a floating window sits over the side panels ─────────────────────────── */
console.log('\na popped-out window paints over the side panel');
const z = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const w = (ms = 600) => new Promise((r) => setTimeout(r, ms));
  S().setRulersVisible(true);
  S().setToolMode('pages', 'floating');
  S().openTool('pages');
  await w(900);
  const win = document.querySelector('.tool-window:not(.tool-window-temp)');
  const dock = document.querySelector('.tool-dock-wrap.tool-dock-right');
  if (!win || !dock) return { win: Boolean(win), dock: Boolean(dock) };
  const wb = win.getBoundingClientRect();
  const db = dock.getBoundingClientRect();
  const inside = (el) => Boolean(el && (el === win || win.contains(el)));
  /* Sample INSIDE the overlap, at three heights — one point could land on a
     gap in the panel's own content and answer about the wrap instead. */
  const xs = [db.left + 6, db.left + 20, db.left + 40].filter((x) => x < wb.right - 2);
  const ys = [wb.top + 30, wb.top + 120, wb.top + 240].filter((y) => y < wb.bottom - 2);
  const hits = [];
  for (const x of xs) for (const y of ys) {
    const el = document.elementFromPoint(x, y);
    hits.push({ x: Math.round(x), y: Math.round(y), win: inside(el), cls: el?.className?.toString().slice(0, 34) });
  }
  /* The RULER: v4.22 gave the wrap its z-index to keep windows above it, so
     removing that must not put the window back underneath. */
  const ruler = document.querySelector('.fs-ruler-h');
  let overRuler = null;
  if (ruler) {
    const rb = ruler.getBoundingClientRect();
    win.style.top = `${Math.round(rb.top - wb.top + 2)}px`;
    await w(250);
    const nb = win.getBoundingClientRect();
    const el = document.elementFromPoint(nb.left + 40, rb.top + 3);
    overRuler = { win: inside(el), cls: el?.className?.toString().slice(0, 34) };
  }
  return { overlaps: wb.right > db.left, panelW: Math.round(db.width), hits, overRuler };
});
ok('the window really does overlap the panel', z.overlaps === true, JSON.stringify(z));
ok('…and the WINDOW is what you touch there, not the panel',
  z.hits.length > 0 && z.hits.every((h) => h.win === true), JSON.stringify(z.hits));
ok('…and it still covers the ruler, which is what v4.22 wanted',
  z.overRuler?.win === true, JSON.stringify(z.overRuler));
/* The CAUSE, by name. Sizes and paint order can agree by luck; a stacking
   context on the wrap is the thing that traps the window, and it must not
   come back without the window being portalled out first. */
const dockCss = readFileSync(new URL('../src/styles/screenplay/20-tool-dock.css', import.meta.url), 'utf8');
const wrapBlock = dockCss.slice(dockCss.indexOf('.tool-dock-wrap {'), dockCss.indexOf('.tool-dock-edge'));
ok('…because the panel wrap declares no stacking context at all',
  !/z-index\s*:/.test(wrapBlock), wrapBlock.slice(0, 120));
const live = await page.evaluate(() => {
  const wrap = document.querySelector('.tool-dock-wrap');
  const cs = getComputedStyle(wrap);
  return { z: cs.zIndex, transform: cs.transform, filter: cs.filter, contain: cs.contain, isolation: cs.isolation };
});
/* Not only z-index — a transform, a filter or isolation would trap it just as
   thoroughly, and reading the computed style catches all of them. */
ok('…nor makes one another way (transform, filter, isolation)',
  live.z === 'auto' && live.transform === 'none' && live.filter === 'none' && live.isolation !== 'isolate',
  JSON.stringify(live));

/* ── a preset lays down sections, not beats ──────────────────────────────── */
console.log('\nan outline preset lays down sections and nothing in them');
const presets = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const B = await window.__scImport('/src/components/BeatBoard.tsx');
  const w = (ms = 250) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  for (const id of ['3act', 'savethecat']) {
    S().setBeatColumns([]);
    S().setBeats([]);
    await w();
    B.applyOutlinePreset(id);
    await w();
    out[id] = {
      sections: S().beatColumns.map((c) => c.title),
      budgets: S().beatColumns.map((c) => c.targetPages),
      beats: S().beats.length,
    };
  }
  /* AND the half that must NOT change: beats you already wrote are re-homed
     into the new structure, not deleted and not duplicated. */
  S().setBeatColumns([]); S().setBeats([]);
  await w();
  B.applyOutlinePreset('3act');
  await w();
  const cols = [...S().beatColumns].sort((a, b) => a.position - b.position);
  const mine = [S().addBeat('Opening Image', cols[0].id), S().addBeat('Catalyst', cols[0].id)];
  await w();
  B.applyOutlinePreset('storycircle', 'override');
  await w();
  return {
    out,
    reHomed: {
      ids: S().beats.map((b) => b.id).sort().join(),
      wanted: [...mine].sort().join(),
      titles: S().beats.map((b) => b.title).sort(),
      sections: S().beatColumns.length,
    },
  };
});
ok('3-Act lays down its three acts', JSON.stringify(presets.out['3act'].sections)
  === JSON.stringify(['Act I', 'Act II', 'Act III']), JSON.stringify(presets.out['3act'].sections));
ok('…with their page budgets', JSON.stringify(presets.out['3act'].budgets)
  === JSON.stringify([40, 40, 40]), JSON.stringify(presets.out['3act'].budgets));
ok('…and not one beat', presets.out['3act'].beats === 0, `${presets.out['3act'].beats} beats`);
ok('Save the Cat lays down all fifteen sections',
  presets.out.savethecat.sections.length === 15, `${presets.out.savethecat.sections.length}`);
ok('…and not one beat either', presets.out.savethecat.beats === 0, `${presets.out.savethecat.beats} beats`);
/* NON-VACUITY for "no beats": beats the writer made are still carried across,
   so the zero above is a preset that lays down none, not a board that cannot
   hold any. */
ok('…while beats you wrote survive a preset applied over them',
  presets.reHomed.ids === presets.reHomed.wanted, JSON.stringify(presets.reHomed));
ok('…keeping what you wrote in them',
  JSON.stringify(presets.reHomed.titles) === JSON.stringify(['Catalyst', 'Opening Image']),
  JSON.stringify(presets.reHomed.titles));

/* ── Freeform is a view of the tab you are on ────────────────────────────── */
console.log('\nFreeform and Sections are two views of one tab');
const arrange = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const w = (ms = 250) => new Promise((r) => setTimeout(r, ms));
  S().resetOutlineTabs();
  S().setBeatColumns([]); S().setBeats([]);
  await w();
  const col = S().addBeatColumn('Act I');
  const beats = [S().addBeat('One', col), S().addBeat('Two', col)].sort().join();
  await w();
  const before = { tabs: S().outlineTabs.length, viewed: S().viewedOutlineTab, mode: S().beatArrangeMode };
  S().goToArrangement('custom');
  await w();
  const after = {
    tabs: S().outlineTabs.length, viewed: S().viewedOutlineTab, mode: S().beatArrangeMode,
    beats: S().beats.map((b) => b.id).sort().join(),
    /* The tab you STARTED on — not "the tab you are now viewing", which is
       'custom' under the old navigating behaviour too and so could not tell
       the two apart. */
    startTabMode: S().outlineTabs.find((t) => t.id === before.viewed)?.arrangeMode,
  };
  S().goToArrangement('auto');
  await w();
  const back = {
    tabs: S().outlineTabs.length, mode: S().beatArrangeMode,
    beats: S().beats.map((b) => b.id).sort().join(),
  };
  /* Even with a tab of that arrangement already there, it must stay put — the
     old behaviour JUMPED to it. */
  const other = S().addOutlineTab('custom');
  S().switchOutlineTab(before.viewed);
  await w();
  S().goToArrangement('custom');
  await w();
  const noJump = { viewed: S().viewedOutlineTab, tabs: S().outlineTabs.length };
  return { beats, before, after, back, noJump, other };
});
ok('the board starts on Sections with one tab',
  arrange.before.mode === 'auto' && arrange.before.tabs === 1, JSON.stringify(arrange.before));
ok('pressing Freeform makes NO new tab', arrange.after.tabs === 1, JSON.stringify(arrange.after));
ok('…and does not move you off the tab you were on',
  arrange.after.viewed === arrange.before.viewed, JSON.stringify(arrange.after));
ok('…it just changes the view', arrange.after.mode === 'custom', JSON.stringify(arrange.after));
/* THE HALF THAT COULD GO WRONG QUIETLY. */
ok('…with the same cards on it', arrange.after.beats === arrange.beats,
  JSON.stringify({ got: arrange.after.beats, want: arrange.beats }));
ok('…and going back to Sections keeps them too',
  arrange.back.mode === 'auto' && arrange.back.beats === arrange.beats && arrange.back.tabs === 1,
  JSON.stringify(arrange.back));
/* The tab remembers, which is what makes each tab reopen as you left it. */
ok('the tab you were on is the one that remembers it',
  arrange.after.startTabMode === 'custom', JSON.stringify(arrange.after));
ok('…and it stays put even when another tab already has that arrangement',
  arrange.noJump.viewed === arrange.before.viewed && arrange.noJump.tabs === 2,
  JSON.stringify(arrange.noJump));

await browser.close();
console.log(`\ncheck-v775: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
