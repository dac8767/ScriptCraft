/* check-v769 — four rows off the feedback queue.
 *
 *   "the scroll bar in the outline toolbar (which is currently blue) should be
 *    a light gray (exact shade should come from the theme)"   → check-v766
 *   "The 'Save changes to workspace' option take a long time to realize if a
 *    change has been made"
 *   "hide the entire production menu for now"
 *   "it is very hard to move ribbon toolbar spaces. make the top of the
 *    section easier to grab in order to drag and move the section"
 *
 * THE WORKSPACE ONE WAS NOT SLOWNESS. Nothing was late; four kinds of change
 * were invisible. Popping a tool out of a panel, panel item scale, the gap
 * between bars and context-menu order were in NO version of the snapshot, so
 * no workspace ever saved them and nothing could notice them change. The
 * button stayed grey until he happened to touch something that WAS captured,
 * which from the outside is indistinguishable from lag.
 *
 * The cause is the same one twice over: the snapshot's field list was written
 * out by hand, in two places (v4.24 drifted capture from apply), and a third
 * list of the same fields — CUSTOMIZATION_FIELDS — already existed and was
 * more complete. captureWorkspace is built from that list now and apply is
 * derived from the snapshot, so a field can be in one and not the others only
 * if someone deliberately excludes it.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await settle(page);

/* ── the workspace notices what it saves ─────────────────────────────────── */
console.log('\nevery layout change wakes "Save Changes to this Workspace"');
const dirty = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  const mod = await import('/src/stores/slices/workspacesSlice.ts');
  const changes = [
    ['popping a tool out of its panel', () => S().setToolMode('goals', 'floating')],
    ['dragging a panel edge', () => S().setChromeCustomPx({ ...S().chromeCustomPx, panelRight: 380 })],
    ['panel item scale', () => S().setPanelItemScale(1.4)],
    ['context-menu order', () => S().setContextMenuOrder(['cut', 'copy'])],
    ['moving a tool to the other side',
      () => S().setToolConfig({ ...S().toolConfig, goals: { side: 'left', enabled: true } })],
    ['locking the UI', () => S().setUiResizeLocked(true)],
  ];
  const out = [];
  for (const [name, fn] of changes) {
    S().saveWorkspace('Probe769');
    await new Promise((r) => setTimeout(r, 220));
    /* Clean the instant it is saved, or the reading below proves nothing —
       a workspace that is dirty against ITSELF would "notice" everything. */
    const cleanFirst = mod.workspaceIsDirty(S()) === false;
    fn();
    await new Promise((r) => setTimeout(r, 220));
    out.push({ name, cleanFirst, noticed: mod.workspaceIsDirty(S()) });
  }
  /* And it still restores what it saved — capture growing is only useful if
     apply grew with it, which is exactly the pair that drifted in v4.24. */
  S().saveWorkspace('RT');
  await new Promise((r) => setTimeout(r, 220));
  S().setPanelItemScale(1.0);
  S().setToolMode('goals', 'docked');
  await new Promise((r) => setTimeout(r, 200));
  const wentDirty = mod.workspaceIsDirty(S());
  S().applyWorkspace('RT');
  await new Promise((r) => setTimeout(r, 400));
  return { out, wentDirty, cleanAfterApply: mod.workspaceIsDirty(S()) === false };
});

ok('a freshly saved workspace reads clean', dirty.out.every((c) => c.cleanFirst),
  JSON.stringify(dirty.out.filter((c) => !c.cleanFirst).map((c) => c.name)));
const blind = dirty.out.filter((c) => !c.noticed);
ok('…and every one of these changes is noticed', blind.length === 0,
  JSON.stringify(blind.map((c) => c.name)));
ok('a change still registers before applying', dirty.wentDirty === true, '');
ok('…and applying the workspace puts it back', dirty.cleanAfterApply === true, '');

/* The three lists that describe the same thing must stay one list.
   v7.70: WORKSPACE_FIELDS moved again, from workspacesSlice into its own leaf
   (stores/workspaceFields.ts) — seedDefaults needs it too, and it is imported
   by viewState, which the slice imports. Same shape of answer, one module
   further out. */
const slice = src('stores/slices/workspacesSlice.ts');
const fields = src('stores/workspaceFields.ts');
ok('capture is built from CUSTOMIZATION_FIELDS, not a copy of the names',
  /WORKSPACE_FIELDS[\s\S]{0,200}CUSTOMIZATION_FIELDS/.test(fields)
  && /for \(const f of WORKSPACE_FIELDS\)/.test(slice), '');
ok('…and apply is derived from the snapshot, not a second list',
  /for \(const \[k, v\] of Object\.entries\(snap\)\)/.test(slice), '');
/* An exclusion has to be a DECISION. Naming them is what tells the next
   reader that suggestionRules is missing on purpose. */
ok('…with anything left out named as excluded',
  /WORKSPACE_EXCLUDES/.test(fields), '');
/* The shared list lives outside editorStore: the slice needs it at module-init
   and editorStore imports the slice, so keeping it there was a circular import
   that left the array undefined and stopped two test files collecting. The
   same is now true one level up — workspaceFields imports one leaf and holds
   no store of its own. */
ok('the shared list is in a module neither side owns',
  /from '\.\.\/workspaceFields'/.test(slice)
  && /from '\.\/customizationFields'/.test(fields)
  && !/from '\.\/editorStore'|from '\.\/viewState'/.test(fields), '');

/* ── the Production menu is hidden ───────────────────────────────────────── */
console.log('\nthe Production menu is out of the way');
const menus = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 200));
  return {
    labels: [...document.querySelectorAll('.menu-item')].map((m) => m.textContent.trim()),
    dev: window.__scStore.getState().showUnreleasedTools,
  };
});
ok('the menu bar rendered', menus.labels.includes('Format'), JSON.stringify(menus.labels));
ok('…without Production', !menus.labels.includes('Production'), JSON.stringify(menus.labels));
/* Hidden, not deleted — "for now" says it comes back, and a menu that still
   builds has not rotted while it waited. */
const menubar = src('components/MenuBar.tsx');
ok('…but the menu is still built, behind the Developer toggle',
  /label: 'Production'/.test(menubar)
  && /m\.label !== 'Production' \|\| showUnreleasedTools/.test(menubar), '');
/* Its one working item keeps a door: an addable ribbon button. */
ok('…and Lock Scene Numbers is still reachable from the ribbon',
  /id: 'lockSceneNumbers'/.test(src('components/toolbarCommands.tsx')), '');

/* ── the ribbon section has something to grab ────────────────────────────── */
console.log('\na ribbon section can be grabbed by its top');
const grip = await page.evaluate(async () => {
  const S = () => window.__scStore.getState();
  S().setToolbarEditing(true);
  await new Promise((r) => setTimeout(r, 900));
  const sec = document.querySelector('.rib-edit-section');
  const g = sec?.querySelector('.rib-edit-sechandle');
  if (!sec || !g) return { sections: document.querySelectorAll('.rib-edit-section').length, grip: false };
  const gb = g.getBoundingClientRect();
  const sb = sec.getBoundingClientRect();
  const title = sec.querySelector('.rib-edit-sectitle');

  /* DOES IT ACTUALLY DRAG. The first version of this handle was called
     `rib-edit-grip`, a class startRibbonDrag explicitly REFUSES (it belongs to
     an older resize grip) — so the strip rendered, said `cursor: move`, and did
     nothing at all. The assertion that passed it checked the SOURCE for a
     startRibbonDrag call, which was right there and never ran. Press and move
     it, and read the store. */
  const cx = gb.left + gb.width / 2;
  const cy = gb.top + gb.height / 2;
  const opts = { bubbles: true, cancelable: true, pointerId: 1, button: 0, isPrimary: true };
  g.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: cx, clientY: cy }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: cx + 40, clientY: cy + 6 }));
  document.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: cx + 40, clientY: cy + 6 }));
  await new Promise((r) => setTimeout(r, 120));
  const dragging = S().ribEdit?.dragging === true;
  window.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: cx + 40, clientY: cy + 6 }));
  document.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: cx + 40, clientY: cy + 6 }));
  await new Promise((r) => setTimeout(r, 200));

  return {
    grip: true,
    sections: document.querySelectorAll('.rib-edit-section').length,
    grips: document.querySelectorAll('.rib-edit-sechandle').length,
    height: Math.round(gb.height),
    spansSection: Math.round(gb.width) >= Math.round(sb.width) - 2,
    /* Against the SECTION's own top, not the title's. The title input sits a
       little above the section's padding box, so measuring against it asked a
       question about the input rather than about the handle. */
    atTop: Math.abs(gb.top - sb.top) <= 1,
    titleTop: title ? Math.round(title.getBoundingClientRect().top - sb.top) : null,
    cursor: getComputedStyle(g).cursor,
    position: getComputedStyle(g).position,
    dragging,
  };
});
ok('edit mode is showing sections', grip.sections > 0, JSON.stringify(grip));
ok('…and each one has a handle', grip.grip === true && grip.grips === grip.sections, JSON.stringify(grip));
/* Across the WHOLE top, not a corner — "make the top of the section easier to
   grab" is about the whole edge. */
ok('…spanning the section\'s full width', grip.spansSection === true, JSON.stringify(grip));
ok('…at the section\'s top edge', grip.atTop === true, JSON.stringify(grip));
ok('…and saying so with the cursor', grip.cursor === 'move', JSON.stringify(grip.cursor));
/* THE ONE THAT MATTERS. A strip that looks grabbable and is not is worse than
   the bare margin it replaced, and that is exactly what shipped first. */
ok('…and pressing it actually starts a drag', grip.dragging === true, JSON.stringify(grip));
/* ABSOLUTE, so it costs no layout: check-v716 pins edit mode to the live bar's
   exact sizes, and a strip in the flow made every section taller the moment
   the editor opened. */
ok('…without changing the section\'s size', grip.position === 'absolute', JSON.stringify(grip.position));

await browser.close();
console.log(`\ncheck-v769: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
