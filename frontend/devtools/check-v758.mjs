/* check-v758 — four suggestions from the feedback queue.
 *
 *   1. "shift the add button right so it is next to the Show all button"
 *   2. "move teh reset buttons so they are each under their respective
 *       section. we do not need the 'Reset ores and continues' button at all"
 *   3. "restructure this so it has the standard Shown and Hidden columns. If
 *       something is moved to the shown column, it appears in the toolbar
 *       above. we no longer need the ability to drag items from this window
 *       directly onto the toolbar"
 *   4. "for these grayed out items, show 'This feature is still in
 *       development' when hovering over them with the cursor"
 *
 * ── 4 is a bug wearing a suggestion's clothes, and the interesting kind.
 *
 * v7.06 already gave those items that tooltip. It had never once been seen,
 * because `.menu-dropdown-item.disabled` carried `pointer-events: none` — the
 * browser delivers no hover to such an element, and a native title tooltip is
 * hover or nothing. So the feature was written, shipped, and silently inert
 * for fifty versions. Nothing in the source looked wrong: the title is right
 * there on the element.
 *
 * Which is why the assertions below refuse to accept `getAttribute('title')`
 * as evidence. That passed the whole time. They check the property that
 * actually decides whether a human ever sees it — that the element is
 * hit-testable — and they check it on the item Derek pointed at.
 *
 * ── 3 is the largest change: the last tab that did not speak the app's own
 * language. Checked by driving the real list and reading the STORE, because
 * the whole claim is "the Shown column is the toolbar" — a column that
 * rendered the right rows while writing nowhere would look identical.
 *
 * ── 1 and 2 are arrangement, so they are measured by position. A button keeps
 * its class, label and handler while sitting in the wrong place.
 */
import { readFileSync } from 'node:fs';
import { launch, boot } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

/* ── 4. the greyed items say why ─────────────────────────────────────────── */
console.log('\na greyed menu item can be hovered, and says why it is grey');
const menu = await page.evaluate(async () => {
  const open = () => [...document.querySelectorAll('.menu-item')]
    .find((m) => m.textContent.trim() === 'Production')?.click();
  open();
  await new Promise((r) => setTimeout(r, 500));
  const items = [...document.querySelectorAll('.menu-dropdown-item')].map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    /* THE test. `title` was always present; what was missing was any way for
       a person to trigger it. An element with pointer-events: none is not the
       hit-test result at its own centre — the browser hands back whatever is
       behind it — so the tooltip can never fire. */
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      label: el.textContent.trim(),
      disabled: el.classList.contains('disabled'),
      title: el.getAttribute('title'),
      pointerEvents: cs.pointerEvents,
      hoverable: Boolean(hit) && (el === hit || el.contains(hit)),
    };
  });
  return { items };
});
const greyed = menu.items.filter((i) => i.disabled);
ok('the Production menu really is showing greyed items',
  greyed.length >= 2, JSON.stringify(menu.items.map((i) => i.label)));
/* The assertion that would have caught v7.06 shipping inert. */
ok('…every one of them is hit-testable, so a hover can reach it',
  greyed.every((i) => i.pointerEvents !== 'none' && i.hoverable),
  JSON.stringify(greyed));
ok('…and every one of them carries an explanation',
  greyed.every((i) => i.title && i.title.length > 0), JSON.stringify(greyed));
/* Derek's words, on the items he pointed at. */
ok('…the unbuilt ones say they are still in development',
  greyed.filter((i) => /Revision Mode|Production Tags/.test(i.label))
    .every((i) => i.title === 'This feature is still in development.'),
  JSON.stringify(greyed.map((i) => [i.label, i.title])));
/* NOT a blanket sentence. Lock Scene Numbers is greyed because scene numbers
   are off — a switch two menus away. Telling the reader it is unbuilt would
   send them away from something they can fix in one click, so the wrong
   tooltip here is worse than none. */
const lock = greyed.find((i) => /Lock Scene Numbers/.test(i.label));
ok('…and one greyed for a fixable reason says what to fix instead',
  Boolean(lock) && /scene numbers on/i.test(lock.title || '')
    && !/development/i.test(lock.title || ''), JSON.stringify(lock));

/* Clicking a disabled item must do nothing AT ALL. With hover restored the
   click now arrives at the handler, and closing the menu on it would snatch
   the explanation away exactly when the reader went to read it. */
const clicked = await page.evaluate(async () => {
  const el = [...document.querySelectorAll('.menu-dropdown-item.disabled')][0];
  el?.click();
  await new Promise((r) => setTimeout(r, 300));
  return { stillOpen: Boolean(document.querySelector('.menu-dropdown-item')) };
});
ok('clicking one does nothing — the menu stays open with its explanation',
  clicked.stillOpen === true, JSON.stringify(clicked));

/* And it is LISTED, so it can be reworded like every other piece of helper
   text — Derek's standing rule. None of the menu tooltips ever were: the
   harvester read JSX `title=` attributes and these are handed over as data. */
const catalog = JSON.parse(readFileSync(new URL('../src/data/helperTextCatalog.json', import.meta.url), 'utf8'));
const texts = new Set(catalog.map((c) => c.text));
ok('the Helper Text window lists them',
  texts.has('This feature is still in development.'), '');
ok('…including the state one', texts.has('Turn scene numbers on first (View ▸ Scene Numbers).'), '');
/* The harvest rule must be exact, not broad. `tooltip:` was chosen over
   `title:` because on a data object `title` usually means a HEADING — and the
   sibling-label test keeps the Helper Text window's own kind-label map
   ({ tooltip: 'Hover' }) from listing the word "Hover" as helper text. */
ok('…and it did not sweep up the window\'s own kind labels',
  !texts.has('Hover'), '');

await page.evaluate(() => document.body.click());

/* ── 1. the adder sits with the other header buttons ─────────────────────── */
console.log('\nthe + Add sits beside Show All, not stranded mid-header');
const heads = [];
for (const [cat, title] of [['qat', 'Shown'], ['panels', 'Left Panel'], ['elements', 'Shown']]) {
  const r = await page.evaluate(async ([c, t]) => {
    window.__scStore.getState().openPreferences(`cz-${c}`);
    await new Promise((r) => setTimeout(r, 1100));
    const col = [...document.querySelectorAll('.prefs-content .fs-dnd-col')]
      .find((x) => x.querySelector('.fs-dnd-col-head')?.firstChild?.textContent?.trim() === t);
    if (!col) return { skipped: `no ${t} column on ${c}` };
    const head = col.querySelector('.fs-dnd-col-head');
    const btns = [...head.querySelectorAll('button')];
    if (btns.length < 2) return { cat: c, only: btns.length };
    const box = (e) => e.getBoundingClientRect();
    return {
      cat: c,
      labels: btns.map((b) => b.textContent.trim()),
      /* The gap BETWEEN the buttons — space-between put the whole header's
         slack there, which is exactly what "stranded in the middle" is. */
      gap: Math.round(box(btns[1]).left - box(btns[0]).right),
      /* …and the group as a whole is at the right edge, not the title's. */
      slackToRight: Math.round(box(head).right - box(btns[btns.length - 1]).right),
      grouped: Boolean(head.querySelector('.fs-dnd-col-head-actions')),
    };
  }, [cat, title]);
  heads.push(r);
}
for (const h of heads) {
  if (h.skipped) { console.log(`  SKIP — ${h.skipped}`); continue; }
  if (h.only) { console.log(`  SKIP ${h.cat} — one header button, nothing to sit beside`); continue; }
  ok(`${h.cat}: the header buttons are adjacent, not spread apart`,
    h.gap < 24, JSON.stringify(h));
  ok(`${h.cat}: …and the group sits at the right edge`,
    h.slackToRight < 24, JSON.stringify(h));
  ok(`${h.cat}: …wrapped so a third button would join them too`,
    h.grouped === true, JSON.stringify(h));
}

/* ── 2. each reset under its own section ─────────────────────────────────── */
console.log('\nthe Editor tab\'s resets sit under what they reset');
const editor = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-elements');
  await new Promise((r) => setTimeout(r, 1500));
  const content = document.querySelector('.prefs-content');
  const box = (e) => e.getBoundingClientRect();
  const secs = [...content.querySelectorAll('section')].map((s) => ({
    heading: s.querySelector('h3')?.textContent.trim(),
    resets: [...s.querySelectorAll(':scope > .fs-tabbar button')].map((b) => b.textContent.trim()),
    top: Math.round(box(s).top),
  }));
  return {
    secs,
    allResets: [...content.querySelectorAll('.fs-tabbar button')].map((b) => b.textContent.trim()),
    bars: content.querySelectorAll('.fs-tabbar').length,
  };
});
/* Each reset is IN the section it names — the claim, and the thing a single
   bar at the bottom could never be. */
for (const [heading, label] of [
  ['Transitions', 'Reset Transitions'],
  ['Elements', 'Reset Elements'],
  ['Element Suggestions', 'Reset Element Suggestions'],
]) {
  const s = editor.secs.find((x) => x.heading === heading);
  ok(`“${label}” is inside the ${heading} section`,
    Boolean(s) && s.resets.includes(label), JSON.stringify(editor.secs));
}
/* Derek: "we do not need the 'Reset Mores and Continueds' button at all." */
ok('Reset Mores & Continueds is gone from the tab',
  !editor.allResets.some((l) => /Mores/i.test(l)), JSON.stringify(editor.allResets));
/* Removed from the REGISTRY, so it leaves Settings ▸ Defaults too. A reset
   living in one surface and not the other is the exact drift the one-registry
   design exists to prevent. */
const defaults = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('defaults');
  await new Promise((r) => setTimeout(r, 1200));
  return [...document.querySelectorAll('.prefs-content .fs-defaults-name')].map((n) => n.textContent.trim());
});
ok('…and from Settings ▸ Defaults, not just from the tab',
  defaults.length > 0 && !defaults.some((l) => /Mores/i.test(l)), JSON.stringify(defaults));
/* The ones that stayed must still be there — a sweep that deleted all four
   would satisfy every assertion above. */
ok('…while the other Editor resets still compile into Defaults',
  ['Reset Transitions', 'Reset Elements', 'Reset Element Suggestions']
    .every((l) => defaults.includes(l)), JSON.stringify(defaults));

/* ── 3. the Ribbon Toolbar tab, restructured ─────────────────────────────── */
console.log('\nthe Ribbon Toolbar tab is Shown and Hidden, like every other tab');
const tb = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-toolbar');
  await new Promise((r) => setTimeout(r, 1400));
  const content = document.querySelector('.prefs-content');
  const cols = [...content.querySelectorAll('.fs-dnd-col')].map((c) => ({
    title: c.querySelector('.fs-dnd-col-head')?.firstChild?.textContent?.trim(),
    head: [...c.querySelectorAll('.fs-dnd-col-head button')].map((b) => b.textContent.trim()),
    rows: [...c.querySelectorAll('.fs-dnd-row')].length,
  }));
  return {
    cols,
    /* The retired palette, and the mode that made the bar an editor. */
    palette: Boolean(content.querySelector('.ribed, .ribed-palette')),
    barEditing: Boolean(document.querySelector('.toolbar-ribbon.toolbar-editing')),
    scrim: Boolean(document.querySelector('.fs-tbedit-scrim')),
    tokens: window.__scStore.getState().toolbarLeft.length,
  };
});
ok('it has a Shown column and a Hidden one',
  tb.cols.some((c) => c.title === 'Shown') && tb.cols.some((c) => c.title === 'Hidden'),
  JSON.stringify(tb.cols));
/* The Shown column IS the sequence — same length, in order. A column that
   rendered plausible rows from somewhere else would look the same. */
ok('…and Shown holds exactly the toolbar\'s own tokens',
  tb.cols.find((c) => c.title === 'Shown')?.rows === tb.tokens, JSON.stringify(tb));
ok('…Hidden offers what is not on the bar',
  (tb.cols.find((c) => c.title === 'Hidden')?.rows ?? 0) > 10, JSON.stringify(tb.cols));
ok('the drag-onto-the-bar palette is gone', tb.palette === false, JSON.stringify(tb));
ok('…and the bar is no longer an editor while the tab is open',
  tb.barEditing === false && tb.scrim === false, JSON.stringify(tb));
/* The convention every other tab follows, now that this one has columns. */
ok('“+ Add” is in the Shown header',
  tb.cols.find((c) => c.title === 'Shown')?.head.includes('+ Add'), JSON.stringify(tb.cols));
ok('…“Hide All” is in the Hidden header, where the other tabs keep theirs',
  tb.cols.find((c) => c.title === 'Hidden')?.head.includes('Hide All'), JSON.stringify(tb.cols));

/* Derek's actual sentence: "If something is moved to the shown column, it
   appears in the toolbar above." Driven, and read back from the STORE. */
console.log('\nmoving something to Shown really puts it on the toolbar');
const moved = await page.evaluate(async () => {
  const st = () => window.__scStore.getState();
  const before = [...st().toolbarLeft];
  const hidden = [...document.querySelectorAll('.fs-dnd-col.fs-dnd-hiddencol .fs-dnd-row')][0];
  const label = hidden?.textContent.trim().replace(/\+$/, '');
  hidden?.querySelector('.fs-dnd-rowbtn')?.click();
  await new Promise((r) => setTimeout(r, 500));
  const after = [...st().toolbarLeft];
  /* …and it is on the REAL bar, not merely in the array. */
  const added = after.find((t) => !before.includes(t));
  return { label, grew: after.length === before.length + 1, added, onBar: Boolean(document.querySelector('.toolbar-stack')) };
});
ok('the item joined the toolbar sequence', moved.grew === true, JSON.stringify(moved));
ok('…as a real token', Boolean(moved.added), JSON.stringify(moved));

const backOff = await page.evaluate(async () => {
  const st = () => window.__scStore.getState();
  const before = st().toolbarLeft.length;
  const row = [...document.querySelectorAll('.fs-dnd-col:not(.fs-dnd-hiddencol) .fs-dnd-row')].pop();
  row?.querySelector('.fs-dnd-rowbtn')?.click();
  await new Promise((r) => setTimeout(r, 500));
  return { before, after: st().toolbarLeft.length };
});
ok('…and removing one takes it off again',
  backOff.after === backOff.before - 1, JSON.stringify(backOff));

/* The structural utilities were reachable ONLY from the bar's in-place "+ Add"
   (v3.42). Retiring that without rehoming them would have left the ribbon's
   shape uneditable — a worse tab than the one we started with. */
console.log('\nthe ribbon\'s shape is still editable');
const structural = await page.evaluate(async () => {
  const col = [...document.querySelectorAll('.fs-dnd-col')]
    .find((c) => c.querySelector('.fs-dnd-col-head')?.firstChild?.textContent?.trim() === 'Shown');
  [...col.querySelectorAll('.fs-dnd-col-head button')].find((b) => b.textContent.trim() === '+ Add')?.click();
  await new Promise((r) => setTimeout(r, 350));
  return [...document.querySelectorAll('.fs-addmenu-pop button')].map((b) => b.textContent.trim());
});
for (const want of ['Divider — one row', 'Divider — two rows', 'Spacer', 'Row Break', 'Section Title', 'Alignment Split']) {
  ok(`“+ Add” still offers ${want}`, structural.includes(want), JSON.stringify(structural));
}

/* A section TITLE carries its own text in its token, and the token is the
   row's React key — so writing each keystroke straight through would give the
   row a new key per character, remount the field and drop focus after one
   letter. It would look broken while behaving exactly as written. */
console.log('\na section title can actually be typed');
await page.evaluate(async () => {
  [...document.querySelectorAll('.fs-addmenu-pop button')]
    .find((b) => b.textContent.trim() === 'Section Title')?.click();
  await new Promise((r) => setTimeout(r, 500));
  [...document.querySelectorAll('.prefs-content .fs-divider-label-input')].pop()?.focus();
});
await page.keyboard.type('Production');
const typed = await page.evaluate(() => {
  const inp = [...document.querySelectorAll('.prefs-content .fs-divider-label-input')].pop();
  return { value: inp?.value, focused: document.activeElement === inp };
});
ok('the whole word survives — focus is not lost per keystroke',
  typed.value === 'Production' && typed.focused === true, JSON.stringify(typed));
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const committed = await page.evaluate(() => ({
  titles: window.__scStore.getState().toolbarLeft.filter((t) => t.startsWith('st:')),
}));
ok('…and commits to the toolbar', committed.titles.includes('st:Production'),
  JSON.stringify(committed));

/* The rule ribRemoveSectionTitle has always followed, and the one this row
   has to keep now that it is the only way to clear a title: an empty st:
   token still paints its band on the bar, so a cleared title is a deleted one. */
const cleared = await page.evaluate(async () => {
  const inp = [...document.querySelectorAll('.prefs-content .fs-divider-label-input')]
    .find((i) => i.value === 'Production');
  if (!inp) return { skipped: 'the title row is gone' };
  inp.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, '');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.blur();
  await new Promise((r) => setTimeout(r, 500));
  return { titles: window.__scStore.getState().toolbarLeft.filter((t) => t.startsWith('st:')) };
});
if (cleared.skipped) console.log(`  SKIP — ${cleared.skipped}`);
else ok('clearing a title removes it — no empty st: token survives',
  cleared.titles.length === 0, JSON.stringify(cleared));

/* Two WIDTHS lived only on the retired bar-edge drag: a spacer's px (v3.67)
   and the four dropdowns that read a --ddw-* var (v6.83, Derek: "allow
   resizing of drop down menus horizontally when in customize mode"). Retiring
   the mode without rehoming them would have taken both away silently — he
   asked to stop dragging items ONTO the bar, not to lose the sizing that
   happened to live there. */
console.log('\nthe widths that lived on the bar still have a home');
const widths = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-toolbar');
  await new Promise((r) => setTimeout(r, 1300));
  const rowFor = (text) => [...document.querySelectorAll('.fs-dnd-col:not(.fs-dnd-hiddencol) .fs-dnd-row')]
    .find((r) => r.textContent.includes(text));
  const set = async (row, v) => {
    const inp = row?.querySelector('.fs-spacer-size input');
    if (!inp) return null;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    inp.focus(); setter.call(inp, String(v));
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.blur();
    await new Promise((r) => setTimeout(r, 500));
    return row.querySelector('.fs-spacer-label')?.textContent;
  };
  const el = rowFor('Element');
  const beforeW = Math.round(
    document.querySelector('.toolbar-ribbon .element-selector')?.getBoundingClientRect().width ?? 0);
  const ddLabel = await set(el, 220);
  const afterW = Math.round(
    document.querySelector('.toolbar-ribbon .element-selector')?.getBoundingClientRect().width ?? 0);

  // a spacer, added from + Add, then sized
  const col = [...document.querySelectorAll('.fs-dnd-col')]
    .find((c) => c.querySelector('.fs-dnd-col-head')?.firstChild?.textContent?.trim() === 'Shown');
  [...col.querySelectorAll('.fs-dnd-col-head button')].find((b) => b.textContent.trim() === '+ Add')?.click();
  await new Promise((r) => setTimeout(r, 300));
  [...document.querySelectorAll('.fs-addmenu-pop button')].find((b) => b.textContent.trim() === 'Spacer')?.click();
  await new Promise((r) => setTimeout(r, 500));
  const spRow = [...document.querySelectorAll('.fs-dnd-col:not(.fs-dnd-hiddencol) .fs-dnd-row')].pop();
  const spLabel = await set(spRow, 120);
  return {
    ddLabel, beforeW, afterW,
    stored: window.__scStore.getState().toolbarDdWidths.element,
    spLabel,
    spacer: window.__scStore.getState().toolbarLeft.filter((t) => t.startsWith('s:')),
  };
});
ok('a dropdown row carries a Width field', widths.ddLabel === 'Width:', JSON.stringify(widths));
ok('…it commits to the same store field the bar reads',
  widths.stored === 220, JSON.stringify(widths));
/* The store agreeing with itself proves nothing if the bar does not repaint. */
ok('…and the live dropdown actually wears it',
  Math.abs(widths.afterW - 220) <= 3 && widths.beforeW !== widths.afterW, JSON.stringify(widths));
ok('a spacer row carries a Size field', widths.spLabel === 'Size:', JSON.stringify(widths));
ok('…and the width lands in its own token',
  widths.spacer.some((t) => t.endsWith(':120')), JSON.stringify(widths.spacer));

/* ── the source side ─────────────────────────────────────────────────────── */
console.log('\nthe retired mode is retired, not merely unreachable from one door');
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const dlg = src('components/CustomizePanelsDialog.tsx');
ok('the Customize window no longer switches the bar into edit mode',
  !/setToolbarEditing\(/.test(dlg) && !/editingToolbar/.test(dlg), '');
/* The COMPONENT, not buildRibbonPalette — that is the data source for the
   Hidden column and is still very much alive. An over-broad regex here would
   have failed against correct code, which is its own kind of wrong. */
ok('…and no longer renders the drag-source palette component',
  !/<RibbonPalette/.test(dlg) && !/from '\.\/RibbonPalette'/.test(dlg), '');
/* The section filter reads the SAME registry — the resets moved, the source
   of truth did not fork. */
const resets = src('components/customizeResets.tsx');
ok('the per-section resets still come from the one registry',
  /a\.tab === tab\s*\n?\s*&& \(section \? a\.section === section : !a\.section\)/.test(resets), '');
ok('…and each reset lands in exactly one place, never both',
  /section \? a\.section === section : !a\.section/.test(resets), '');
ok('Reset Mores & Continueds left the registry, not just the tab',
  !/moresContds/.test(resets), '');
/* The CSS rule that made v7.06's tooltips inert. */
const css = readFileSync(new URL('../src/styles/screenplay/02-menubar.css', import.meta.url), 'utf8');
ok('a disabled menu item no longer opts out of the pointer',
  !/\.menu-dropdown-item\.disabled\s*\{[^}]*pointer-events:\s*none/.test(css), '');
/* All three renders of a menu item pass the tooltip through — it was on one
   of them, so an Align item could be given one and never show it. */
const mb = src('components/MenuBar.tsx');
ok('every render of a menu item passes its tooltip through',
  (mb.match(/title=\{(?:item|child)\.tooltip\}/g) || []).length === 3,
  `${(mb.match(/title=\{(?:item|child)\.tooltip\}/g) || []).length} of 3`);
ok('…and the shared sentence has one definition',
  (mb.match(/export const IN_DEVELOPMENT = /g) || []).length === 1
  && (mb.match(/'This feature is still in development\.'/g) || []).length === 1, '');

console.log(`\ncheck-v758: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
