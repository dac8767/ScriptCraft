/* check-v759 — Derek: "when in the ribbon bar editor, the ribbon bar should
 * still be highlighted like it used to be so that it is clear that it is
 * edited directly."
 *
 * v7.58 gave the Ribbon Toolbar tab Shown/Hidden columns and retired the mode
 * where the real bar WAS the editor. The ring went with it — and it shouldn't
 * have, because it was doing two jobs. One was "you can drop items here",
 * which is gone. The other was "this bar is what that window edits, and it is
 * changing as you go", which a list of tokens with no visible tie to a bar
 * needs MORE than the drag version did.
 *
 * So: the ring comes back, and only the ring. Not the two scrims that dimmed
 * the whole app — those existed to make the bar the only droppable thing.
 *
 * WHAT THIS GUARDS, and why the second half is the interesting one:
 *
 * 1. The ring is on exactly while the tab is showing. A highlight that fails
 *    to CLEAR is worse than none — a ring burning on a bar nothing is editing
 *    is a lie about what the window is doing.
 *
 * 2. The highlight must not change the bar's LAYOUT. `rib-no-titles` — which
 *    collapses the reserved section-title band — was suppressed in edit mode so
 *    the title inputs stayed visible, and the highlight inherited that
 *    coupling. It is decoupled here.
 *
 *    HONESTLY: that coupling is inert today, and this file will not pretend
 *    otherwise. Restoring it and measuring shows no change, because v5.14 hides
 *    an untitled section's band with `display: none` whether or not the class
 *    is present — so the class only carries a min-height the natural content
 *    already exceeds. The decoupling is right on principle (a highlight flag
 *    has no business in a layout class) rather than a fix for something Derek
 *    would have seen. The height assertions below are a GUARD: cheap, and they
 *    would catch the day someone makes that coupling matter again.
 *
 * 3. The retired editor is really gone, module and all. This is the change
 *    where ~1,300 unreachable lines finally left, and "unreachable" is not a
 *    state that survives on its own — the flag that used to gate them is the
 *    same flag now driving the ring, so anything left behind is one edit away
 *    from being live again.
 */
import { readFileSync, existsSync } from 'node:fs';
import { launch, boot } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1500, height: 900 });
await boot(page);

/** The bar's highlight state AND its geometry, read together. */
const bar = () => page.evaluate(() => {
  const el = document.querySelector('.toolbar.toolbar-ribbon');
  if (!el) return { missing: true };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    highlighted: el.classList.contains('toolbar-highlight'),
    shadow: cs.boxShadow,
    ringed: cs.boxShadow !== 'none' && cs.boxShadow.includes('rgb('),
    h: Math.round(r.height),
    top: Math.round(r.top),
    flag: window.__scStore.getState().toolbarHighlighted,
    /* The retired spotlight. */
    scrims: document.querySelectorAll('.fs-tbedit-scrim').length,
    /* The retired in-place affordances. */
    handles: document.querySelectorAll('.rib-edit-item, .rib-edit-add, .rib-edit-secadd, .rib-edit-sep-ghost').length,
    oldClass: el.classList.contains('toolbar-editing'),
  };
});

console.log('\nthe ring is off until the tab that edits the bar is open');
const closed = await bar();
ok('the bar is there', closed.missing !== true, JSON.stringify(closed));
ok('…with no ring', closed.highlighted === false && closed.ringed === false, JSON.stringify(closed));

console.log('\nopening the Ribbon Toolbar tab lights it');
await page.evaluate(async () => {
  window.dispatchEvent(new CustomEvent('scriptcraft:open-customize', { detail: 'toolbar' }));
  await new Promise((r) => setTimeout(r, 1500));
});
const open = await bar();
ok('the class is on', open.highlighted === true, JSON.stringify(open));
/* Not just the class — a rule has to actually paint. The class could survive a
   stylesheet edit that deleted its rule and this would still "pass". */
ok('…and a real ring is painted', open.ringed === true, JSON.stringify(open.shadow));
ok('…in the accent colour, not an arbitrary one',
  /rgb\(74,\s*158,\s*255\)/.test(open.shadow), JSON.stringify(open.shadow));
ok('the store flag agrees with the DOM', open.flag === true, JSON.stringify(open));

/* Layout neutrality. Not a reproduction of a live bug — see the header: the
   old coupling measures identically today. This is the guard that keeps it
   that way, and the only assertion that could ever catch a highlight which
   quietly resizes the thing it is pointing at. */
console.log('\nand the bar does not move');
ok('the ribbon is exactly as tall as it was',
  open.h === closed.h, `${closed.h}px → ${open.h}px`);
ok('…and sits in the same place', open.top === closed.top, `${closed.top} → ${open.top}`);

/* Derek asked for the ring, NOT the spotlight — the dimming was there to make
   the bar the only droppable thing, and there is nothing to drop. */
console.log('\nthe ring, and nothing that came with it');
ok('no scrim dims the app', open.scrims === 0, JSON.stringify(open));
ok('no in-place drag handles on the bar', open.handles === 0, JSON.stringify(open));
ok('…and the retired class name is not what drives it',
  open.oldClass === false, JSON.stringify(open));

/* A highlight that cannot turn off is the worse failure: it claims the window
   is editing a bar when it isn't. Three ways out, all checked. */
console.log('\nit clears every way out');
const leaveTab = await page.evaluate(async () => {
  [...document.querySelectorAll('.fs-customize-tabs .prefs-tab')]
    .find((t) => /Quick Access/.test(t.textContent))?.click();
  await new Promise((r) => setTimeout(r, 900));
});
const other = await bar();
ok('switching to another Customize tab clears it',
  other.highlighted === false && other.flag === false, JSON.stringify(other));
ok('…and the bar still does not move', other.h === closed.h, `${closed.h} → ${other.h}`);

await page.evaluate(async () => {
  [...document.querySelectorAll('.fs-customize-tabs .prefs-tab')]
    .find((t) => /Toolbar/.test(t.textContent))?.click();
  await new Promise((r) => setTimeout(r, 900));
});
ok('coming back lights it again', (await bar()).highlighted === true, '');

await page.evaluate(async () => {
  [...document.querySelectorAll('.fs-customize-footer button')]
    .find((b) => /Cancel/.test(b.textContent))?.click();
  await new Promise((r) => setTimeout(r, 900));
});
const shut = await bar();
ok('closing the window clears it',
  shut.highlighted === false && shut.flag === false, JSON.stringify(shut));

/* The same tab reached through Settings must light the bar too — it is the
   same component with soloCategory instead of an inner tab rail, and a
   highlight that only worked through one of two doors would be a coin flip. */
console.log('\nthe Settings door lights it too');
const viaSettings = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-toolbar');
  await new Promise((r) => setTimeout(r, 1400));
  const el = document.querySelector('.toolbar.toolbar-ribbon');
  return { on: el?.classList.contains('toolbar-highlight'), flag: window.__scStore.getState().toolbarHighlighted };
});
ok('Settings ▸ Ribbon Toolbar lights the bar',
  viaSettings.on === true && viaSettings.flag === true, JSON.stringify(viaSettings));
const settingsOther = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-qat');
  await new Promise((r) => setTimeout(r, 1100));
  return document.querySelector('.toolbar.toolbar-ribbon')?.classList.contains('toolbar-highlight');
});
ok('…and another Settings tab does not', settingsOther === false, JSON.stringify(settingsOther));

/* ── the retired editor, gone rather than merely unreachable ────────────── */
console.log('\nthe in-place editor is removed, not just unreached');
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
/* Strip comments before testing for a retired identifier. The comment that
   EXPLAINS why `toolbarEditing` is gone contains the word, so a naive regex
   fails against correct code — which is its own kind of wrong, and the second
   time this file's author has done it. */
const code = (p) => src(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
ok('ribbonDrag.ts is deleted',
  !existsSync(new URL('../src/components/ribbonDrag.ts', import.meta.url)), '');
ok('RibbonPalette.tsx is deleted',
  !existsSync(new URL('../src/components/RibbonPalette.tsx', import.meta.url)), '');
const tb = code('components/Toolbar.tsx');
ok('the Toolbar renders no edit layout', !/editLayout/.test(tb), '');
ok('…and imports nothing from ribbonDrag', !/from '\.\/ribbonDrag'/.test(tb), '');
ok('…and carries no on-bar add menu', !/rib-add-menu|setAddMenu/.test(tb), '');
/* The flag is NAMED for what it does now. A flag still called "editing" is an
   invitation to hang behaviour off it again — which is precisely how the bar
   became a second editor the first time. */
const store = code('stores/editorStore.ts');
ok('the store flag says highlighted, not editing',
  /toolbarHighlighted: boolean/.test(store) && !/toolbarEditing/.test(store), '');
ok('…and the drag state it used to carry is gone',
  !/ribEdit|RibDropSpot/.test(store), '');

/* The section-title rule outlived the module it lived in. It had to: the
   Customize row field is now the only way to edit a title, and "clearing it
   deletes it" is the part that is easy to lose in a move. */
ok('setSectionTitle is a pure helper the tab and its test share',
  /export function setSectionTitle/.test(src('components/toolbarBuiltins.ts'))
  && /setSectionTitle\(tbLeft, tok, v\)/.test(src('components/CustomizePanelsDialog.tsx')), '');

console.log(`\ncheck-v759: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
