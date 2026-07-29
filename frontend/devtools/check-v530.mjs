// devtools/check-v530.mjs — the annotation edit window becomes a real
// window (title bar drag, fullscreen, × with are-you-sure discard) on its
// own light theme; the Annotations tool locks to the side bar (with helper
// text); navigator: icon-only empty rows, list annotations as lists, the
// Annotations filter button beside Scene Numbers.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/v530';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Annotations');

// ── 1. the tool is LOCKED to the side bar ────────────────────────────────
let lock = await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolMode('markups', 'floating');
  const afterFloat = s.toolMode ? window.__scStore.getState().toolMode.markups : null;
  window.__scStore.getState().enterToolFullscreen('markups');
  return { afterFloat, fullscreen: window.__scStore.getState().fullscreenTool };
});
ok(lock.afterFloat === 'docked', `setToolMode('floating') coerces to docked (${lock.afterFloat})`);
ok(lock.fullscreen === null, 'enterToolFullscreen is a no-op for the locked tool');
const note = await page.evaluate(() =>
  [...document.querySelectorAll('.tool-shape-note')].map((el) => el.textContent));
ok(note.includes('This window only appears in the side panel'),
  `the side-panel helper text is there ("${note[0] ?? ''}")`);

// ── 2. the edit window: theme, title bar, drag, fullscreen ───────────────
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
const theme = await page.evaluate(() => {
  const win = document.querySelector('.fs-markup-popover');
  const field = document.querySelector('.markup-mini-editor');
  return {
    winBg: getComputedStyle(win).backgroundColor,
    fieldBg: getComputedStyle(field).backgroundColor,
    fieldColor: getComputedStyle(field).color,
    title: document.querySelector('.markup-pop-title')?.textContent,
  };
});
ok(theme.winBg === 'rgb(214, 216, 220)', `window wears the light-gray theme (${theme.winBg})`);
ok(theme.fieldBg === 'rgb(255, 255, 255)', `text field is WHITE like the script (${theme.fieldBg})`);
ok(theme.title === 'Annotation', `title bar reads "Annotation"`);
await page.screenshot({ path: `${SHOTS}/window.png`, clip: await page.$('.fs-markup-popover').then((e) => e.boundingBox()) });

// drag by the title bar — the window moves and STAYS (no re-seat)
const before = await page.evaluate(() => {
  const r = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  return { top: r.top, left: r.left };
});
const bar = await page.$('.markup-pop-titlebar');
const bb = await bar.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2 - 120, bb.y + bb.height / 2 + 90, { steps: 4 });
await page.mouse.up();
const after = await page.evaluate(() => {
  const r = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  document.querySelector('.editor-main').dispatchEvent(new Event('scroll', { bubbles: true }));
  return { top: r.top, left: r.left };
});
await page.waitForTimeout(120);
const held = await page.evaluate(() => {
  const r = document.querySelector('.fs-markup-popover').getBoundingClientRect();
  return { top: r.top, left: r.left };
});
ok(Math.abs(after.top - (before.top + 90)) < 3 && Math.abs(after.left - (before.left - 120)) < 3,
  `title-bar drag moves the window (Δ ${Math.round(after.left - before.left)},${Math.round(after.top - before.top)})`);
ok(Math.abs(held.top - after.top) < 1, 'and a scroll does NOT re-seat a dragged window');

// fullscreen button
await page.click('.markup-win-btn[title="Full screen"]');
const maxed = await page.evaluate(() => {
  const el = document.querySelector('.fs-markup-popover');
  const r = el.getBoundingClientRect();
  return { cls: el.className.includes('maximized'), wide: r.width > window.innerWidth - 120 };
});
ok(maxed.cls && maxed.wide, 'the fullscreen button maximizes the window');
await page.click('.markup-win-btn[title="Exit full screen"]');

// ── 3. × — clean close silently; dirty close asks, then DISCARDS ─────────
await page.click('.markup-win-btn.markup-win-close');
await page.waitForTimeout(250);
ok(await page.evaluate(() => !document.querySelector('.fs-markup-popover') && !document.querySelector('.fs-confirm-overlay')),
  '× with no changes closes without asking');
// reopen, type, ×
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupEditorId(s.markups[0].id);
});
await page.waitForSelector('.fs-markup-popover', { timeout: 4000 });
await page.click('.markup-mini-editor .ProseMirror');
await page.keyboard.type('unsaved thought');
await page.click('.markup-win-btn.markup-win-close');
await page.waitForSelector('.fs-confirm-overlay', { timeout: 4000 });
const msg = await page.evaluate(() => document.querySelector('.fs-confirm-message')?.textContent);
ok(msg === 'Are you sure you want to close this annotation without saving?', `the warning says it (${JSON.stringify(msg)})`);
await page.screenshot({ path: `${SHOTS}/confirm.png` });
// cancel → still open
await page.click('.fs-confirm-box button:has-text("Cancel")');
await page.waitForTimeout(150);
ok(await page.evaluate(() => !!document.querySelector('.fs-markup-popover')), 'Cancel keeps the window open');
// × again → confirm → discarded (content never saved)
await page.click('.markup-win-btn.markup-win-close');
await page.waitForSelector('.fs-confirm-overlay', { timeout: 4000 });
await page.click('.fs-confirm-box button:has-text("OK"), .fs-confirm-box button:has-text("Yes"), .fs-confirm-box .fs-confirm-confirm');
await page.waitForTimeout(250);
const discarded = await page.evaluate(() => ({
  closed: !document.querySelector('.fs-markup-popover'),
  content: window.__scStore.getState().markups[0].content,
}));
ok(discarded.closed, 'confirming closes the window');
ok(discarded.content === null, 'and the typed text was NOT saved (discard)');

// ── 4. navigator: icon-only empties, list annotations, button row ────────
// give the annotation a checklist so it renders as a LIST
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.updateMarkup(s.markups[0].id, {
    content: {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'fix the pacing' }] }] },
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'rename the ship' }] }] },
        ],
      }],
    },
  });
  // and a second, EMPTY annotation at the cursor
  window.__scEditor.chain().setTextSelection(4).run();
});
await page.click('.markups-add-btn');
await page.waitForSelector('.fs-markup-popover', { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForSelector('.fs-markup-popover', { state: 'detached', timeout: 4000 });

await openTool(page, 'Navigator');
const nav = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fs-nav-item.markup')];
  const lines = rows.map((r) => [...r.querySelectorAll('.fs-nav-anno-line')].map((el) => el.textContent));
  const annoBtn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.trim().startsWith('Annotations'));
  const numBtn = [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.includes('Scene Numbers'));
  return {
    lines,
    sameRow: annoBtn && numBtn
      ? Math.abs(annoBtn.getBoundingClientRect().top - numBtn.getBoundingClientRect().top) < 2 : false,
  };
});
ok(nav.lines.some((l) => l.length === 0), 'an EMPTY annotation shows just its icon (no placeholder text)');
ok(nav.lines.some((l) => l.length === 2 && l[0].startsWith('☐') && l[1].startsWith('☑')),
  `a checklist annotation renders as a LIST (${JSON.stringify(nav.lines.find((l) => l.length === 2))})`);
ok(nav.sameRow, 'Annotations and Scene Numbers sit on the SAME row');
// the button opens the shared filter popover, and it filters the navigator
const annoBtnEl = await page.evaluateHandle(() =>
  [...document.querySelectorAll('.tool-ctl')].find((el) => el.textContent?.trim().startsWith('Annotations')));
await annoBtnEl.asElement().click();
ok(await page.waitForSelector('.markup-filter-pop', { timeout: 4000 }).then(() => true).catch(() => false),
  'the navigator Annotations button opens the shared filter popover');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupFilters({ ...s.markupFilters, done: 'done' });
});
await page.waitForTimeout(200);
const filtered = await page.evaluate(() => document.querySelectorAll('.fs-nav-item.markup').length);
ok(filtered === 0, 'the shared filter state drives the navigator rows too (Complete-only hides both open ones)');
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setMarkupFilters({ ...s.markupFilters, done: 'open' });
});
await page.screenshot({ path: `${SHOTS}/navigator.png` });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
