/* check-v773 — two rows off the feedback queue, both about workspaces.
 *
 *   "simply opening a side panel item is considered a change that can be saved
 *    to a workspace. this should not be the case."
 *   "add an option to hide workspaces from the menu"
 *
 * THE FIRST IS A LINE, NOT A DELETION. A workspace still stores which tool each
 * panel is showing, and still puts it back — reopening the tools you had open
 * is most of what a workspace is for. What changed is that those two fields are
 * stripped from BOTH sides of the dirty comparison, so glancing at Goals no
 * longer lights "Save Changes to this Workspace". Saved and restored, but not
 * counted: the assertions below have to prove all three, because proving only
 * the middle one would also pass on a workspace that had stopped remembering
 * open tools at all.
 *
 * The boundary is deliberate and is tested too: closing a whole PANEL still
 * counts. That resizes the editor and is a thing you arrange a workspace
 * around, which is a different act from swapping which tool sits in a panel
 * that was open either way.
 *
 * THE SECOND NEEDS A DOOR. Hiding takes a workspace out of the View menu and
 * out of the Workspaces panel — the two places that OFFER it — while Edit
 * Workspaces… goes on listing every one, with the eye. A hide with no way back
 * would be worse than no hide at all, and the five that ship cannot be deleted,
 * so this is the only way to clear one of them out of the way.
 */
import { launch, boot, settle, placeTool } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await settle(page);

/* ── opening a panel tool is not a change ────────────────────────────────── */
console.log('\nopening a side panel item is not a change');
const dirty = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const mod = await window.__scImport('/src/stores/slices/workspacesSlice.ts');
  const settle = () => new Promise((r) => setTimeout(r, 300));

  S().applyWorkspace('Default');
  await settle();
  const cleanFirst = mod.workspaceIsDirty(S()) === false;

  /* The exact act he described: click a tool in the side panel. */
  const before = S().activeToolRight;
  S().openTool('goals');
  await settle();
  const opened = { from: before, to: S().activeToolRight };
  const afterOpen = mod.workspaceIsDirty(S());

  /* Closing one is the same act in reverse. */
  S().closeTool('goals');
  await settle();
  const afterClose = mod.workspaceIsDirty(S());

  /* NON-VACUITY. A real layout change still has to wake the button, or
     "not dirty" is just a comparison that never returns true. */
  S().setPanelItemScale({ left: 1.4, right: 1.4 });
  await settle();
  const afterRealChange = mod.workspaceIsDirty(S());

  /* THE BOUNDARY, on purpose: a whole panel still counts. */
  S().applyWorkspace('Default');
  await settle();
  S().toggleNavigator();
  await settle();
  const afterPanelToggle = mod.workspaceIsDirty(S());

  return { cleanFirst, opened, afterOpen, afterClose, afterRealChange, afterPanelToggle };
});
ok('the workspace starts clean', dirty.cleanFirst === true, JSON.stringify(dirty));
ok('…the tool really did open in the panel',
  dirty.opened.to === 'goals' && dirty.opened.from !== 'goals', JSON.stringify(dirty.opened));
ok('…and opening it did NOT make the workspace dirty', dirty.afterOpen === false, '');
ok('…nor did closing it again', dirty.afterClose === false, '');
ok('…while a real layout change still does', dirty.afterRealChange === true, '');
ok('…and closing a whole panel still counts, deliberately',
  dirty.afterPanelToggle === true, '');

/* STILL SAVED, STILL RESTORED. Ignoring a field for the comparison must not
   quietly stop the workspace carrying it — that would trade his complaint for
   a bigger one. */
console.log('\n…but the workspace still remembers what was open');
const roundTrip = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const settle = () => new Promise((r) => setTimeout(r, 320));
  S().setToolConfig({ ...S().toolConfig, goals: { side: 'right', enabled: true } });
  await settle();
  S().openTool('goals');
  await settle();
  S().saveWorkspace('Probe773');            // captured WITH Goals showing
  await settle();
  const saved = S().workspaces.Probe773.activeToolRight;
  S().applyWorkspace('Minimalist');          // go somewhere else entirely
  await settle();
  const away = S().activeToolRight;
  S().applyWorkspace('Probe773');
  await settle();
  return { saved, away, back: S().activeToolRight };
});
ok('saving captures the open tool', roundTrip.saved === 'goals', JSON.stringify(roundTrip));
ok('…another workspace puts something else there', roundTrip.away !== 'goals', JSON.stringify(roundTrip));
ok('…and coming back reopens it', roundTrip.back === 'goals', JSON.stringify(roundTrip));

/* The two buttons are what he was looking at — read them off the screen. */
console.log('\nand the buttons on screen agree');
/* PLACED, not just enabled. v7.73: the shipped defaults leave Workspaces out of
   the tool order, so openTool had no dock slot for it and opened a TEMP window
   instead — which the one-window rule then dismissed the moment the next tool
   opened, and every button read null because the panel was gone. placeTool puts
   it in the order as well as turning it on. */
/* APPLY FIRST, then place, then open. applyWorkspace restores that workspace's
   OWN toolConfig, toolOrder and toolMode — done in the other order it undoes
   the placement, and Workspaces falls back to a temp window that the next tool
   dismisses. */
await page.evaluate(async () => {
  window.__scStore.getState().applyWorkspace('Default');
  await new Promise((r) => setTimeout(r, 400));
});
await placeTool(page, 'workspaces', 'right');
await placeTool(page, 'fragments', 'left');
const btns = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));
  S().setToolMode('workspaces', 'docked');
  S().setToolMode('fragments', 'docked');
  await settle();
  S().openTool('workspaces');
  await settle(700);
  /* Save the arrangement the placement just made, so the baseline is CLEAN.
     placeTool moves toolConfig and toolOrder, which are real layout changes and
     rightly light both buttons — the question below is what happens NEXT. */
  S().saveWorkspace('Probe773btn');
  await settle(400);
  const read = () => {
    const all = [...document.querySelectorAll('.ws-actions .ws-action-btn')];
    const by = (re) => all.find((b) => re.test(b.textContent));
    return {
      onScreen: all.length > 0,
      save: by(/Save Changes/)?.disabled ?? null,
      reset: by(/Reset to Saved/)?.disabled ?? null,
    };
  };
  const clean = read();
  /* A LEFT-panel tool, so the Workspaces panel on the right stays on screen.
     activeTool is in the ignore list too, so the point is the same. */
  S().openTool('fragments');
  await settle();
  const afterOpen = read();
  S().setPanelItemScale({ left: 1.35, right: 1.35 });
  await settle();
  return { docked: S().activeToolRight, clean, afterOpen, afterReal: read() };
});
ok('the Workspaces panel is docked, not a temp window', btns.docked === 'workspaces',
  JSON.stringify(btns.docked));
ok('both buttons are asleep on a clean workspace',
  btns.clean.onScreen && btns.clean.save === true && btns.clean.reset === true, JSON.stringify(btns.clean));
ok('…and opening a panel tool leaves them asleep — and on screen',
  btns.afterOpen.onScreen && btns.afterOpen.save === true && btns.afterOpen.reset === true,
  JSON.stringify(btns.afterOpen));
ok('…while a real change wakes them',
  btns.afterReal.save === false && btns.afterReal.reset === false, JSON.stringify(btns.afterReal));

/* ── hiding a workspace ──────────────────────────────────────────────────── */
console.log('\na workspace can be hidden from the menu');
const menuNames = () => page.evaluate(async () => {
  /* Nothing over the bar first. A leftover dropdown or dialog swallows the
     click below, and the read then returns [] — which reads as "the menu is
     empty" when the menu was never opened. */
  for (let i = 0; i < 4; i++) {
    if (!document.querySelector('.menu-dropdown, .dialog-overlay')) break;
    document.body.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
  }
  /* Open View, read its Workspaces submenu, close it again. RETRY: one click
     is not reliably enough once other panels have opened and closed, and a
     silent [] reads as "the menu is empty" when the menu never opened at all. */
  let opened = false;
  for (let i = 0; i < 5 && !opened; i++) {
    const view = [...document.querySelectorAll('.menu-item')].find((m) => m.textContent.trim() === 'View');
    if (!view) throw new Error('no View item in the menu bar');
    view.click();
    await new Promise((r) => setTimeout(r, 260));
    opened = Boolean(document.querySelector('.menu-dropdown'));
  }
  if (!opened) throw new Error('the View menu would not open');
  const row = [...document.querySelectorAll('.menu-dropdown-item')]
    .find((i) => i.textContent.trim().startsWith('Workspaces'));
  row?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  row?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const names = [...document.querySelectorAll('.menu-dropdown .menu-dropdown-item')]
    .map((i) => i.textContent.trim().replace(/^✓\s*/, ''));
  document.body.click();
  await new Promise((r) => setTimeout(r, 200));
  return names;
});
const before = await menuNames();
ok('the menu lists the five', ['Default', 'Editing', 'Outlining', 'Focus', 'Minimalist']
  .every((n) => before.includes(n)), JSON.stringify(before.slice(0, 12)));

const hidden = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  /* The panel has to be ON SCREEN for the list read below to mean anything. */
  S().openTool('workspaces');
  await new Promise((r) => setTimeout(r, 500));
  if (!document.querySelector('.ws-apply-name')) throw new Error('the Workspaces panel is not open');
  /* A BUILT-IN — the case that needs this most, since the five cannot be
     deleted and hiding is the only way to clear one out of the way. */
  S().setWorkspaceHidden('Editing', true);
  await new Promise((r) => setTimeout(r, 350));
  return {
    stored: S().workspacesHidden,
    stillExists: 'Editing' in S().workspaces,
    panel: [...document.querySelectorAll('.ws-apply-name')].map((e) => e.textContent.trim()),
  };
});
const after = await menuNames();
ok('hiding takes it out of the menu',
  !after.includes('Editing') && after.includes('Outlining'), JSON.stringify(after.slice(0, 12)));
ok('…and out of the Workspaces panel',
  !hidden.panel.includes('Editing') && hidden.panel.includes('Outlining'), JSON.stringify(hidden.panel));
/* Hidden is not deleted — the workspace itself must survive, or "hide" is a
   delete wearing a friendlier word. */
ok('…but the workspace itself is still there', hidden.stillExists === true, '');
ok('…and it works on a BUILT-IN, which is the case that needs it',
  hidden.stored.includes('Editing'), JSON.stringify(hidden.stored));

/* THE DOOR. Edit Workspaces… keeps listing it, with the eye. */
const dialog = await page.evaluate(async () => {
  [...document.querySelectorAll('.ws-action-btn')]
    .find((b) => b.textContent.startsWith('Edit Workspaces'))?.click();
  await new Promise((r) => setTimeout(r, 400));
  const rows = [...document.querySelectorAll('.ws-row')].map((r) => ({
    name: r.querySelector('.ws-name')?.textContent?.replace(/active$|default$/, '').trim(),
    dimmed: r.classList.contains('ws-row-hidden'),
    eyes: [...r.querySelectorAll('.ws-icon-btn')].map((b) => b.title).filter((t) => /hide|show/i.test(t ?? '')),
  }));
  /* Click the eye on the hidden one — the way back has to WORK, not just
     render. */
  const row = [...document.querySelectorAll('.ws-row')]
    .find((r) => /Editing/.test(r.querySelector('.ws-name')?.textContent ?? ''));
  row?.querySelector('.ws-icon-btn.ws-hidden-on')?.click();
  await new Promise((r) => setTimeout(r, 350));
  return { rows, afterUnhide: window.__scStore.getState().workspacesHidden };
});
ok('Edit Workspaces still lists the hidden one',
  dialog.rows.some((r) => r.name === 'Editing'), JSON.stringify(dialog.rows.map((r) => r.name)));
ok('…marked as hidden', dialog.rows.find((r) => r.name === 'Editing')?.dimmed === true,
  JSON.stringify(dialog.rows.find((r) => r.name === 'Editing')));
ok('…and every row carries the eye', dialog.rows.every((r) => r.eyes.length === 1),
  JSON.stringify(dialog.rows.map((r) => r.eyes)));
ok('…and clicking it brings the workspace back',
  !dialog.afterUnhide.includes('Editing'), JSON.stringify(dialog.afterUnhide));

/* It has to survive a restart, or it is a setting that undoes itself. */
console.log('\nand it survives a restart');
await page.evaluate(async () => {
  window.__scStore.getState().setWorkspaceHidden('Focus', true);
  await new Promise((r) => setTimeout(r, 300));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror', { timeout: 25000 });
await settle(page);
const persisted = await page.evaluate(() => window.__scStore.getState().workspacesHidden);
ok('the hidden list is still there after a reload', persisted.includes('Focus'),
  JSON.stringify(persisted));
const afterReload = await menuNames();
ok('…and the menu still leaves it out',
  !afterReload.includes('Focus') && afterReload.includes('Default'),
  JSON.stringify(afterReload.slice(0, 12)));

await browser.close();
console.log(`\ncheck-v773: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
