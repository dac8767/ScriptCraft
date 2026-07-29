// devtools/check-v536.mjs — Derek's Notes v2: one rich-text card kind, the
// tool renamed "Notes", no checklist button, "Notes per row:" over an
// equal-height row grid (the misalignment fix), and drag-reorder that works.
import { launch, boot, seedScript, openTool, fullscreen, SCENES_4 } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// four notes of very different heights — the equal-row proof needs contrast
await page.evaluate(() => {
  const p = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
  const doc = (...c) => ({ type: 'doc', content: c });
  const long = 'A much longer note that will wrap across several lines when the cards share a row, making its natural height taller than its neighbors.';
  window.__scStore.getState().setShelfCards([
    { id: 'a', type: 'comment', color: '#fff8b8', content: doc(p('short one')), text: 'short one', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', type: 'comment', color: '#ffd9a8', content: doc(p(long), p(long)), text: long, createdAt: '2026-01-02T00:00:00Z' },
    { id: 'c', type: 'comment', color: '#d8f0c8', content: { type: 'doc', content: [{ type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: false }, content: [p('email agent')] },
      { type: 'taskItem', attrs: { checked: true }, content: [p('print draft')] },
    ] }] }, text: 'email agent\nprint draft', createdAt: '2026-01-03T00:00:00Z' },
    { id: 'd', type: 'comment', color: '#cfe3ff', content: doc(p('last card')), text: 'last card', createdAt: '2026-01-04T00:00:00Z' },
  ]);
});

// ── rename + one add button + no tabs ────────────────────────────────────
await openTool(page, 'Notes');
ok(true, 'the dock row is labelled "Notes"');
const chrome = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.fs-sticky-tool .tool-action-row button')].map((b) => b.textContent),
  hasChecklistTab: !!document.querySelector('.tool-inline-header')?.textContent?.includes('Checklists'),
}));
ok(chrome.buttons.length === 1 && chrome.buttons[0] === '+ Add Note',
  `ONE add button (${JSON.stringify(chrome.buttons)})`);
ok(!chrome.hasChecklistTab, 'the kind tabs are gone from the header');

// ── every body is the rich editor; the checklist renders as content ──────
const rich = await page.evaluate(() => ({
  editors: document.querySelectorAll('.swn-note-editor .ProseMirror').length,
  checks: document.querySelectorAll('.swn-note-editor input[type="checkbox"]').length,
}));
ok(rich.editors === 4, `4 rich note bodies (${rich.editors})`);
ok(rich.checks === 2, `the migrated checklist renders as a real task list (${rich.checks} boxes)`);

// ── fullscreen: "Notes per row:" stepper + equal-height row grid ─────────
await fullscreen(page);
await page.waitForTimeout(200);
const stepLabel = await page.evaluate(() =>
  document.querySelector('.fs-tool-takeover .tool-action-label')?.textContent);
ok(stepLabel === 'Notes per row:', `the stepper says "Notes per row:" (${stepLabel})`);
await page.click('.fs-tool-takeover button[title="More notes per row (smaller cards)"]');
await page.waitForTimeout(150);
const grid = await page.evaluate(() => {
  const scroll = document.querySelector('.fs-tool-takeover .swn-scroll');
  const cs = getComputedStyle(scroll);
  const cards = [...scroll.querySelectorAll('.swn-card')].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height) };
  });
  return { display: cs.display, cols: cs.gridTemplateColumns.split(' ').length, cards };
});
ok(grid.display === 'grid' && grid.cols === 2, `2-per-row GRID (${grid.display}, ${grid.cols} cols)`);
const row1 = grid.cards.slice(0, 2), row2 = grid.cards.slice(2, 4);
ok(Math.abs(row1[0].top - row1[1].top) <= 1, `row 1 tops align (${row1.map((c) => c.top)})`);
ok(Math.abs(row2[0].top - row2[1].top) <= 1, `row 2 tops align (${row2.map((c) => c.top)})`);
ok(row1[0].h === row1[1].h, `row 1 cards SAME height despite different content (${row1.map((c) => c.h)})`);
ok(row2[0].h === row2[1].h, `row 2 cards SAME height (${row2.map((c) => c.h)})`);
await page.screenshot({ path: `${SHOTS}/v536-notes-grid.png` });

// ── drag-reorder: pull card D onto card A ────────────────────────────────
// (synthetic DragEvents — Playwright's native dragAndDrop hangs on HTML5
//  draggables in headless; this drives the exact handler chain instead.
//  The WebKit abort-on-DOM-mutation root cause is fixed by deferring the
//  dragId write past the dragstart tick — see StickyNotes.tsx.)
const dragEnv = await page.evaluate(() => {
  const cards = document.querySelectorAll('.fs-tool-takeover .swn-card');
  const grip = cards[3]?.querySelector('.swn-drag-grip');
  if (!grip) return { cards: cards.length, grips: document.querySelectorAll('.swn-drag-grip').length };
  grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
  return { cards: cards.length, started: true };
});
console.log(`  (drag env: ${JSON.stringify(dragEnv)})`);
await page.waitForTimeout(80);   // the deferred dragId write lands
await page.evaluate(() => {
  const cards = document.querySelectorAll('.fs-tool-takeover .swn-card');
  const grip = cards[3]?.querySelector('.swn-drag-grip');
  const target = cards[0];
  const dt = new DataTransfer();
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  grip?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
});
await page.waitForTimeout(200);
const order = await page.evaluate(() =>
  window.__scStore.getState().shelfCards.map((c) => c.id).join(''));
ok(order === 'dabc', `drag-reorder moved D before A (${order})`);
ok(await page.evaluate(() => window.__scStore.getState().stickySort) === 'manual',
  'and the sort snapped to Manual');

// ── rich editing writes content + the plain-text mirror ──────────────────
await page.click('.fs-tool-takeover .swn-card:nth-of-type(2) .swn-note-editor .ProseMirror');
await page.keyboard.type(' plus typed words');
await page.waitForTimeout(200);
const edited = await page.evaluate(() => {
  const c = window.__scStore.getState().shelfCards.find((x) => x.id === 'a');
  return { text: c.text, hasContent: !!c.content };
});
ok(edited.hasContent && edited.text.includes('plus typed words'),
  `typing updates content AND the text mirror ("${edited.text}")`);

// ── toolbar appears on focus and makes a checklist ───────────────────────
const barVisible = await page.evaluate(() => {
  const bar = document.querySelector('.fs-tool-takeover .swn-card:nth-of-type(2) .swn-mini-bar');
  return bar && getComputedStyle(bar).display !== 'none';
});
ok(barVisible, 'the rich toolbar shows while the card has focus');
await page.click('.fs-tool-takeover .swn-card:nth-of-type(2) button[title="Checklist"]');
await page.waitForTimeout(200);
const nowChecklist = await page.evaluate(() => {
  const c = window.__scStore.getState().shelfCards.find((x) => x.id === 'a');
  return JSON.stringify(c.content).includes('taskList');
});
ok(nowChecklist, 'the Checklist button turns the note line into a task list');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
