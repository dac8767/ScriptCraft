/* check-v677 — Derek, all three in one message:
   1 "i accidentally hit the 'reset helper text' button and all my hard work
     disappeared. for this any any button that makes major changes, always
     include a warning window."
   2 "when 'Hidden' is clicked, show toggle button for Hide/Show all"
   3 "using Undo button or ctrl+Z / cmd+Z should undo changes made in
     windows as well. I tried to undo my accidental help text reset, but
     undo does not work for that."

   Drives the REAL surfaces (windows, buttons, the actual keyboard) — not
   store calls — for: the Helper Text reset (warn → cancel → confirm →
   Ctrl+Z back → Ctrl+Shift+Z forward), the Hidden view's bulk toggle, the
   Design window's Reset all, a Customize tab reset, and Reset All
   Shortcuts. Every warning must also SAY the way back (the undo key). */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/** Ctrl+Z with focus parked on BODY — the exact state after clicking a
 *  button in a window (Derek's scenario: reset clicked, then undo). */
const pressUndo = async (redo = false) => {
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press(redo ? 'Control+Shift+z' : 'Control+z');
  await settle(page);
};
const confirmBox = () => page.evaluate(() => document.querySelector('.fs-confirm-box')?.textContent ?? '');
const clickCancel = () => page.click('.fs-confirm-actions button:not(.fs-confirm-ok)');
const bodyHas = (s) => page.evaluate((x) => document.body.textContent.includes(x), s);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  /* ── 1+3: the Helper Text reset — Derek's accident, replayed ── */
  await page.evaluate(() => window.__scStore.getState().openTool('helpertext'));
  await page.waitForSelector('.htw-panel .ht-input', { timeout: 8000 });
  const original = await page.evaluate(() => document.querySelector('.ht-input').getAttribute('data-ht-for'));
  await page.fill('.htw-panel .ht-input >> nth=0', 'My hard work');
  await page.evaluate(() => { document.activeElement?.blur?.(); });   // blur commits
  await settle(page);
  const edited = await page.evaluate(() => document.querySelector('.ht-input').value);
  ok(edited === 'My hard work', `an edit through the window commits ("${edited}")`);
  await page.waitForSelector('.ht-reset-all', { timeout: 5000 });

  /* v6.78, Derek's retest: "i changed helper text in the window, and then
     tried to use Undo, but it did not revert back." The EDIT ITSELF must
     undo — not only the reset buttons. */
  await pressUndo();
  const editUndone = await page.evaluate(() => document.querySelector('.ht-input').value);
  ok(editUndone === original, `Ctrl+Z undoes the edit itself ("${editUndone.slice(0, 30)}…")`);
  ok(await bodyHas('Undid: Helper text edit'), 'and the toast names it');
  await pressUndo(true);
  ok(await page.evaluate(() => document.querySelector('.ht-input').value) === 'My hard work',
    'Ctrl+Shift+Z brings the edit back');

  await page.click('.ht-reset-all');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  const warn1 = await confirmBox();
  ok(/Reset Helper Text/.test(warn1) && /back to the app/i.test(warn1),
    `Reset helper text WARNS first ("${warn1.slice(0, 52)}…")`);
  ok(/Ctrl\+Z|⌘Z/.test(warn1), 'and the warning names the way back (the undo key)');
  await clickCancel();
  await settle(page);
  ok(await page.evaluate(() => document.querySelector('.ht-input').value) === 'My hard work',
    'Cancel keeps the work');

  await page.click('.ht-reset-all');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  await page.click('.fs-confirm-ok');
  await settle(page);
  const afterReset = await page.evaluate(() => document.querySelector('.ht-input').value);
  ok(afterReset === original, `confirming resets the text ("${afterReset.slice(0, 30)}…")`);

  await pressUndo();
  const afterUndo = await page.evaluate(() => document.querySelector('.ht-input').value);
  ok(afterUndo === 'My hard work', `Ctrl+Z brings the hard work BACK ("${afterUndo}")`);
  ok(await bodyHas('Undid: Reset helper text'), 'and a toast says what came back');

  await pressUndo(true);
  ok(await page.evaluate(() => document.querySelector('.ht-input').value) === original,
    'Ctrl+Shift+Z redoes the reset');
  await pressUndo();                                   // leave the edit in place
  ok(await page.evaluate(() => document.querySelector('.ht-input').value) === 'My hard work',
    'and undo works a second time');

  /* ── 2: the Hidden view's bulk toggle ── */
  const catalogLen = await page.evaluate(async () =>
    (await import('/src/data/helperTextCatalog.json')).default.length);
  ok(await page.evaluate(() => !document.querySelector('.ht-bulk-hidden')),
    'the main list carries NO bulk toggle');
  await page.evaluate(() => {
    // two DIFFERENT rows' eyes — React 18 batches, so clicking [0] twice in
    // one task would toggle the SAME row on and straight back off
    const eyes = document.querySelectorAll('.htw-panel .ht-hide');
    eyes[0]?.click();
    eyes[1]?.click();
  });
  await settle(page);
  await page.click('.ht-hiddenchip');
  await page.waitForSelector('.ht-bulk-hidden', { timeout: 5000 });
  const bulk1 = await page.evaluate(() => document.querySelector('.ht-bulk-hidden').textContent);
  ok(bulk1 === 'Show all (2)', `clicking Hidden shows the toggle ("${bulk1}")`);

  await page.click('.ht-bulk-hidden');
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  ok(/Show All Items/.test(await confirmBox()), 'Show all warns first (it is a bulk change)');
  await page.click('.fs-confirm-ok');
  await settle(page);
  const hiddenNow = await page.evaluate(() => window.__scStore.getState().helperTextHidden.length);
  const bulk2 = await page.evaluate(() => document.querySelector('.ht-bulk-hidden')?.textContent);
  ok(hiddenNow === 0 && bulk2 === 'Hide all',
    `Show all empties the Hidden view and the toggle flips ("${bulk2}")`);

  await pressUndo();
  ok(await page.evaluate(() => window.__scStore.getState().helperTextHidden.length) === 2,
    'Ctrl+Z restores the hidden pair');

  await page.click('.ht-bulk-hidden');                 // now "Show all (2)" again — flip the OTHER way
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  await page.click('.fs-confirm-ok');
  await settle(page);
  await page.click('.ht-bulk-hidden');                 // "Hide all"
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  ok(/Hide All Items/.test(await confirmBox()), 'Hide all warns too');
  await page.click('.fs-confirm-ok');
  await settle(page);
  ok(await page.evaluate(() => window.__scStore.getState().helperTextHidden.length) === catalogLen,
    `Hide all checks off every item (${catalogLen})`);
  await pressUndo();
  ok(await page.evaluate(() => window.__scStore.getState().helperTextHidden.length) === 0,
    'and Ctrl+Z takes even that back');
  await page.evaluate(() => window.__scStore.getState().setHelperTextHidden([]));

  /* ── 1+3 on the Design window: a session of sliders is hard work too ── */
  await page.evaluate(() => window.__scStore.getState().openTool('design'));
  await page.waitForSelector('.dz-footer', { timeout: 8000 });

  /* v6.78: a REAL slider drag (three input events) undoes as ONE step. */
  await page.evaluate(() => document.querySelector('.dz-group-head')?.click());  // groups start folded
  await page.waitForSelector('.dz-range', { timeout: 5000 });
  const drag = await page.evaluate(() => {
    const range = document.querySelector('.dz-range');
    const before = range.value;
    const min = parseFloat(range.min), max = parseFloat(range.max), step = parseFloat(range.step) || 1;
    const target = parseFloat(before) === max ? min : max;
    const mid = Math.min(max, Math.max(min, parseFloat(before) + (target > parseFloat(before) ? step : -step)));
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const v of [mid, target === mid ? max : target, target]) {
      set.call(range, String(v));
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return { before, after: range.value };
  });
  await settle(page);
  ok(drag.after !== drag.before, `a slider drag lands (${drag.before} → ${drag.after})`);
  await pressUndo();
  const dragged = await page.evaluate(() => document.querySelector('.dz-range').value);
  ok(dragged === drag.before, `ONE Ctrl+Z takes the whole drag back (${dragged})`);
  ok(await bodyHas('Undid: Design change'), 'and the toast names the design change');

  await page.evaluate(() => window.__scStore.getState().setDesignVar('pageGap', 44));
  await settle(page);
  await page.evaluate(() => [...document.querySelectorAll('.dz-foot-btn')]
    .find((b) => /Reset all/.test(b.textContent)).click());
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  ok(/Reset All Design Settings/.test(await confirmBox()), 'Design’s Reset all warns first');
  await page.click('.fs-confirm-ok');
  await settle(page);
  ok(await page.evaluate(() => Object.keys(window.__scStore.getState().designVars).length) === 0,
    'confirming clears the design overrides');
  await pressUndo();
  ok(await page.evaluate(() => window.__scStore.getState().designVars.pageGap) === 44,
    'Ctrl+Z restores the design work');

  /* ── a Customize tab reset (they all ride the same wrapper) ── */
  await page.evaluate(() => window.__scStore.getState().setQatItems(['save', 'print']));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customize' })));
  /* v7.55: the per-tab Reset section became the tab's one action bar (adders
     left, resets and transfer right) — Derek's "random stack of buttons".
     Selectors move with it; what is checked below does not change. */
  await page.waitForSelector('.fs-tabbar', { timeout: 8000 }).catch(() => {});
  const hasCustomize = await page.evaluate(() => !!document.querySelector('.fs-tabbar'));
  if (hasCustomize) {
    // land on the Quick Access tab so its Reset Items is on screen
    await page.evaluate(() => [...document.querySelectorAll('button')]
      .find((b) => /^Quick Access/.test(b.textContent.trim()))?.click());
    await settle(page);
    await page.evaluate(() => [...document.querySelectorAll('.fs-tabbar button')]
      .find((b) => b.textContent === 'Reset Items')?.click());
    await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
    ok(/Quick Access Toolbar/i.test(await confirmBox()), 'a Customize reset warns, naming what it resets');
    await page.click('.fs-confirm-ok');
    await settle(page);
    ok(await page.evaluate(() => window.__scStore.getState().qatItems.join(',')) === 'save,undo,redo',
      'confirming resets the Quick Access buttons');
    await pressUndo();
    ok(await page.evaluate(() => window.__scStore.getState().qatItems.join(',')) === 'save,print',
      'Ctrl+Z restores the writer’s arrangement');
    await page.evaluate(() => [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Done' || b.textContent.trim() === 'Close')?.click());
  } else {
    ok(false, 'Customize window did not open for the reset-tab probe');
    ok(false, '(skipped) reset warns');
    ok(false, '(skipped) undo restores');
    ok(false, '(skipped) qat restored');
  }
  await settle(page);

  /* ── v6.85: Settings ▸ Defaults compiles the SAME resets — it must run
     the SAME warn+undo wrapper (it was still resetting bare, the drift the
     one-registry design forbids) ── */
  await page.evaluate(() => window.__scStore.getState().openPreferences());
  await page.waitForSelector('.prefs-tabs', { timeout: 8000 });
  await page.evaluate(() => [...document.querySelectorAll('.prefs-tab')]
    .find((b) => b.textContent.trim() === 'Defaults')?.click());
  await page.waitForSelector('.fs-defaults-tab', { timeout: 5000 });
  /* v7.01: the v7.00 rebuild turned these rows into .fs-defaults-row (a named
     row + a dialog-btn-sm "Reset"), so the old .swn-add-btn/"Reset Items"
     lookup silently found nothing and the click never happened — the probe
     then timed out waiting for a confirm that was never asked for. Address the
     row by its NAME, which is what the tab actually shows. */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.fs-defaults-tab .fs-defaults-row')]
      .find((r) => r.querySelector('.fs-defaults-name')?.textContent === 'Reset Items');
    if (!row) throw new Error('no "Reset Items" row on the Defaults tab');
    row.querySelector('button')?.click();
  });
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  ok(/back to the app defaults/.test(await confirmBox()),
    'Settings ▸ Defaults resets warn too — same wrapper as the Customize tabs');
  await clickCancel();
  await settle(page);

  /* ── Reset All Shortcuts — rebound through the REAL recording UI, and
     every assert reads the ROW, not a store import (an HMR-split module
     instance would make store reads lie — the check-v642 lesson) ── */
  await page.evaluate(() => window.__scStore.getState().openPreferences('keys'));
  await page.waitForSelector('.fs-shortcut-row', { timeout: 8000 });
  const findKey = () => page.evaluate(() => {
    const row = [...document.querySelectorAll('.fs-shortcut-row')]
      .find((r) => r.querySelector('.fs-customize-tool')?.textContent === 'Find & Replace');
    if (!row) throw new Error('Find & Replace row missing');
    return row.querySelector('.fs-shortcut-key').textContent;
  });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.fs-shortcut-row')]
      .find((r) => r.querySelector('.fs-customize-tool')?.textContent === 'Find & Replace');
    row.querySelector('.fs-shortcut-key').click();     // start recording
  });
  await page.keyboard.press('Control+Shift+F9');       // F-key: no shift-transform
  await settle(page);
  ok(await findKey() === 'Ctrl+Shift+F9', `rebinding through the window sticks (${await findKey()})`);
  /* v6.78: a single rebinding is itself undoable. */
  await pressUndo();
  ok(await findKey() === 'Ctrl+F', `Ctrl+Z undoes the single rebinding (${await findKey()})`);
  await pressUndo(true);
  ok(await findKey() === 'Ctrl+Shift+F9', `and Ctrl+Shift+Z re-applies it (${await findKey()})`);
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find((b) => b.textContent === 'Reset All Shortcuts')?.click());
  await page.waitForSelector('.fs-confirm-overlay', { timeout: 5000 });
  ok(/Reset All Shortcuts/.test(await confirmBox()), 'Reset All Shortcuts warns first');
  await page.click('.fs-confirm-ok');
  await settle(page);
  ok(await findKey() === 'Ctrl+F', `confirming restores the default keys (${await findKey()})`);
  await pressUndo();
  ok(await findKey() === 'Ctrl+Shift+F9', `Ctrl+Z brings the rebinding back (${await findKey()})`);

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v677: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
