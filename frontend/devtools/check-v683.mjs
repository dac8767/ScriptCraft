/* check-v683 — Derek's four ribbon-editing items:
   1 dropdowns resize horizontally in customize mode (drag the edge; the
     width lands in toolbarDdWidths, the SAME field the live bar reads)
   2 no × on dividers — click the line to hide it, click the ghost to
     bring it back
   3 Settings ▸ Customize ▸ Toolbar hands over to the REAL Customize
     window with live on-ribbon editing armed
   4 in edit mode the sections after the Align Split hug the right edge,
     like the live bar */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1600, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  /* ── 3: the Settings door ── */
  await page.evaluate(() => window.__scStore.getState().openPreferences());
  await page.waitForSelector('.prefs-tabs', { timeout: 8000 });
  await page.evaluate(() => [...document.querySelectorAll('.prefs-tab')]
    .find((b) => b.textContent.trim() === 'Toolbar' && b.closest('.prefs-tabs'))?.click());
  await settle(page);
  const handover = await page.evaluate(() => ({
    // .prefs-tabs alone is AMBIGUOUS — the standalone Customize window
    // reuses that styling class for its own sidebar.
    prefsGone: !document.querySelector('.prefs-window'),
    editing: !!document.querySelector('.toolbar.toolbar-ribbon.toolbar-editing'),
  }));
  ok(handover.prefsGone, 'Settings closes when its Toolbar entry is picked');
  ok(handover.editing, 'and the REAL Customize window arms live on-ribbon editing');

  /* ── 1: dropdown resize ── */
  await page.waitForSelector('.rib-edit-item', { timeout: 8000 });
  const grip = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.rib-edit-item')]
      .find((it) => it.querySelector('.element-selector'))?.querySelector('.rib-edit-ddgrip');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  ok(!!grip, 'the Element dropdown wears a resize grip in edit mode');
  const before = await page.evaluate(() =>
    Math.round(document.querySelector('.element-selector').getBoundingClientRect().width));
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 60, grip.y, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  const afterDrag = await page.evaluate(() => ({
    stored: window.__scStore.getState().toolbarDdWidths.element,
    width: Math.round(document.querySelector('.element-selector').getBoundingClientRect().width),
  }));
  ok(typeof afterDrag.stored === 'number' && Math.abs(afterDrag.stored - (before + 60)) <= 3,
    `dragging the grip commits the width to toolbarDdWidths (${before} → ${afterDrag.stored})`);
  ok(Math.abs(afterDrag.width - afterDrag.stored) <= 3,
    `and the dropdown actually wears it (${afterDrag.width}px)`);

  /* ── 2: divider click-toggle, no × ── */
  const sepXs = await page.evaluate(() => document.querySelectorAll('.rib-edit-sep-x').length);
  ok(sepXs === 0, `dividers carry NO × button (${sepXs})`);
  const seps = await page.evaluate(() => ({
    lines: document.querySelectorAll('.rib-edit-sep').length,
    ghosts: document.querySelectorAll('.rib-edit-sep-ghost').length,
  }));
  ok(seps.lines > 0, `visible dividers are clickable lines (${seps.lines})`);
  await page.click('.rib-edit-sep >> nth=0');
  await settle(page);
  const hidden = await page.evaluate(() => ({
    lines: document.querySelectorAll('.rib-edit-sep').length,
    ghosts: document.querySelectorAll('.rib-edit-sep-ghost').length,
  }));
  ok(hidden.lines === seps.lines - 1 && hidden.ghosts === seps.ghosts + 1,
    `clicking a divider hides it (${seps.lines}→${hidden.lines} lines, ghost appears)`);
  await page.click('.rib-edit-sep-ghost >> nth=0');
  await settle(page);
  const restored = await page.evaluate(() => ({
    lines: document.querySelectorAll('.rib-edit-sep').length,
    ghosts: document.querySelectorAll('.rib-edit-sep-ghost').length,
  }));
  ok(restored.lines === seps.lines && restored.ghosts === seps.ghosts,
    'clicking the ghost brings the divider back');

  /* ── 4: right alignment in edit mode ── */
  const align = await page.evaluate(() => {
    const bar = document.querySelector('.toolbar.toolbar-ribbon');
    const gap = bar?.querySelector('.rib-align-gap');
    if (!gap) return { hasSplit: false };
    const sections = [...bar.querySelectorAll('.rib-edit-section')];
    const last = sections[sections.length - 1];
    const barR = bar.getBoundingClientRect();
    const lastR = last.getBoundingClientRect();
    return {
      hasSplit: true,
      grow: getComputedStyle(gap).flexGrow,
      tail: Math.round(barR.right - lastR.right),
    };
  });
  if (align.hasSplit) {
    ok(align.grow === '1', `the align gap grows in edit mode (flex-grow ${align.grow})`);
    ok(align.tail < 60, `sections after the split hug the right edge (${align.tail}px from it)`);
  } else {
    ok(false, 'no align split in the default layout — probe assumption broken');
    ok(false, '(skipped) right-edge assert');
  }

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v683: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
