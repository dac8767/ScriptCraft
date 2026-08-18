/* check-v683 — Derek's four ribbon-editing items:
   1 dropdowns resize horizontally in customize mode (drag the edge; the
     width lands in toolbarDdWidths, the SAME field the live bar reads)
   2 no × on dividers — click the line to hide it, click the ghost to
     bring it back
   3 Settings ▸ Customize ▸ Toolbar hands over to the REAL Customize
     window with live on-ribbon editing armed
   4 in edit mode the sections after the Align Split hug the right edge,
     like the live bar

   v7.58, Derek: "we no longer need the ability to drag items from this window
   directly onto the toolbar." The Ribbon Toolbar tab is Shown/Hidden columns
   now, and the mode where the real bar became an editor is retired — so items
   2 and 4, which tested affordances that only existed IN that mode (the
   divider ghost, the edit-mode align gap), are testing something that is gone.

   What survives is the part that was never about the mode: item 3, and item
   1's actual subject — a dropdown's width is still customizable, still lands
   in toolbarDdWidths, and the live bar still wears it. The gesture moved from
   dragging an edge on the bar to a Width field on the dropdown's row, so that
   is where this drives it. Deleting the assertion along with the gesture would
   have quietly dropped the only coverage that Derek's v6.83 ask still works.
   (check-v758 owns the new tab in full; this file keeps the v6.83 thread.)

   The alignment split is still asserted — it is a property of the RIBBON, not
   of the retired editor, so it should hold on the ordinary bar. */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1600, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  /* ── 3 (v6.83 → v7.00, Derek's reversal via the feedback form): the
        Settings ▸ Customize ▸ Toolbar entry STAYS inside Settings and
        embeds the interactive editor — no more handover. ── */
  await page.evaluate(() => window.__scStore.getState().openPreferences());
  await page.waitForSelector('.prefs-tabs', { timeout: 8000 });
  await page.evaluate(() => [...document.querySelectorAll('.prefs-tab')]
    .find((b) => b.textContent.trim() === 'Toolbar' && b.closest('.prefs-tabs'))?.click());
  await settle(page);
  const embed = await page.evaluate(() => ({
    prefsOpen: !!document.querySelector('.prefs-window'),
    content: document.querySelectorAll('.prefs-window .prefs-content *').length,
  }));
  ok(embed.prefsOpen, 'v7.00: Settings STAYS open on its Toolbar entry (no handover)');
  ok(embed.content > 10, `and embeds the interactive toolbar editor (${embed.content} nodes)`);
  await page.evaluate(() => { document.querySelector('.prefs-footer .dialog-btn-primary')?.click(); });
  await settle(page);
  /* v7.58: item 1, retargeted. The width is set from the Ribbon Toolbar tab's
     own row field now — the drag grip went with the edit mode — but the claim
     is unchanged: it commits to toolbarDdWidths and the REAL bar wears it. */
  await page.evaluate(() => window.__scStore.getState().openPreferences('cz-toolbar'));
  await page.waitForSelector('.prefs-content .fs-dnd-col', { timeout: 8000 });
  const dd = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('.fs-dnd-col:not(.fs-dnd-hiddencol) .fs-dnd-row')]
      .find((r) => r.textContent.includes('Element'));
    const inp = row?.querySelector('.fs-spacer-size input');
    if (!inp) return { err: 'the Element row carries no width field' };
    const before = Math.round(
      document.querySelector('.toolbar-ribbon .element-selector')?.getBoundingClientRect().width ?? 0);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    inp.focus();
    setter.call(inp, '220');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.blur();
    await new Promise((r) => setTimeout(r, 600));
    return {
      label: row.querySelector('.fs-spacer-label')?.textContent,
      before,
      stored: window.__scStore.getState().toolbarDdWidths.element,
      width: Math.round(
        document.querySelector('.toolbar-ribbon .element-selector')?.getBoundingClientRect().width ?? 0),
    };
  });
  ok(!dd.err, `the Element dropdown still has a width control (${dd.label ?? dd.err})`);
  ok(dd.stored === 220, `setting it commits to toolbarDdWidths (${dd.before} \u2192 ${dd.stored})`);
  /* The half that matters: the STORE agreeing with itself proves nothing if
     the bar does not repaint. */
  ok(Math.abs(dd.width - 220) <= 3, `and the live dropdown actually wears it (${dd.width}px)`);

  /* Item 4, on the ORDINARY bar. The align split is the ribbon's own
     behaviour; if it only ever worked in edit mode, that was the bug. */
  await page.evaluate(() => window.__scStore.getState().closePreferences?.());
  await settle(page);
  const align = await page.evaluate(() => {
    const bar = document.querySelector('.toolbar.toolbar-ribbon');
    const gap = bar?.querySelector('.rib-align-gap');
    if (!gap) return { hasSplit: false };
    const secs = [...bar.querySelectorAll('.rib-section, .rib-edit-section')];
    const last = secs[secs.length - 1];
    if (!last) return { hasSplit: true, noSections: true };
    return {
      hasSplit: true,
      grow: getComputedStyle(gap).flexGrow,
      tail: Math.round(bar.getBoundingClientRect().right - last.getBoundingClientRect().right),
    };
  });
  ok(align.hasSplit === true, 'the default layout still carries an align split');
  if (align.hasSplit && !align.noSections) {
    ok(align.grow === '1', `the align gap grows on the live bar (flex-grow ${align.grow})`);
    ok(align.tail < 60, `sections after the split hug the right edge (${align.tail}px from it)`);
  }

  /* Items 2 and 4's edit-mode halves are retired WITH the mode. Asserted as an
     absence so this file says what happened rather than going quiet: a check
     that simply stops testing something reads the same as one that forgot. */
  const gone = await page.evaluate(async () => {
    window.__scStore.getState().openPreferences('cz-toolbar');
    await new Promise((r) => setTimeout(r, 1000));
    return {
      editing: Boolean(document.querySelector('.toolbar-ribbon.toolbar-editing')),
      ghosts: document.querySelectorAll('.rib-edit-sep-ghost').length,
      grips: document.querySelectorAll('.rib-edit-ddgrip').length,
    };
  });
  ok(gone.editing === false, 'the bar no longer becomes an editor while the tab is open');
  ok(gone.ghosts === 0 && gone.grips === 0,
    `and its in-place affordances are gone with it (${gone.ghosts} ghosts, ${gone.grips} grips)`);

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v683: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
