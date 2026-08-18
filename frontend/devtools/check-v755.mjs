/* check-v755 — Derek, of the bottom of the Customize tabs: "now it just looks
 * like a random stack of buttons. figure out a way to organize where buttons
 * that is clean and intuitive. the size is good, the arrangement/presentation
 * is not."
 *
 * The stack was structural, not stylistic. Three blocks ended each tab, each
 * authored somewhere different and none aware of the others: the tab's own
 * adder row (inside the tab body), a Reset section with its own heading (from
 * customizeResets), and the Export/Import row (from the dialog's globals). Each
 * carried its own margin. Stacked, they read as three unrelated afterthoughts,
 * which is exactly what they were.
 *
 * One TabActionBar now, with the grammar every dialog footer in this app
 * already uses:
 *
 *     [ adders ] ……………………………………………………… [ resets ]
 *
 * Left acts on the list above it. Right is the tab's own housekeeping.
 *
 * v7.56 removed the third group. Export… / Import… moved the whole preset
 * bundle whatever tab you were on, so repeating them per tab implied a scope
 * they never had; they are one Backup & Restore door beside the tabs now. The
 * hairline went with them — a rule between a group and nothing is just a rule.
 *
 * v7.57 emptied the LEFT group nearly everywhere: an adder belongs on the list
 * it adds to, so every tab with a Shown column moved its adder into that
 * column's header (check-v757 owns that half). What this file still owns is
 * the ARRANGEMENT of whatever is left: one row, one bar per tab, grouped and
 * pushed to the edges — and, now, that a tab with nothing left to put in a bar
 * draws no bar rather than an empty rule.
 *
 * WHY THIS IS CHECKED BY GEOMETRY. "Arrangement" is precisely the property
 * that no type and no unit test can see. Every one of these buttons could keep
 * its class, its label and its handler while drifting back into a stack, and
 * nothing would fail. So the assertions read POSITION: everything on one row,
 * the adders genuinely left of the utilities, one bar rather than three blocks.
 *
 * The sizes are NOT re-checked here — check-v753 owns that, and Derek said the
 * size was already right. What v753 gained from this round is the measure it
 * should have used all along: slack, a control's width minus the width its own
 * label needs, rather than a share of the panel. The share threshold is what
 * let Export Themes… through at 304px and cost Derek a second report.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

/** Measure one tab's action bar. */
const measureBar = (cat) => page.evaluate(async (c) => {
  window.__scStore.getState().openPreferences(`cz-${c}`);
  await new Promise((r) => setTimeout(r, 1200));
  const bar = document.querySelector('.prefs-content .fs-tabbar');
  if (!bar) return { skipped: `no action bar on the ${c} tab` };
  const groups = [...bar.querySelectorAll('.fs-tabbar-group')];
  const btns = [...bar.querySelectorAll('button')];
  const box = (e) => e.getBoundingClientRect();
  return {
    groups: groups.length,
    labels: btns.map((b) => b.textContent.trim()),
    // every button on ONE row: same top, within a pixel or two
    tops: [...new Set(btns.map((b) => Math.round(box(b).top)))],
    firstGroupLeft: Math.round(box(groups[0]).left),
    lastGroupLeft: Math.round(box(groups[groups.length - 1]).left),
    panelRight: Math.round(document.querySelector('.prefs-content').getBoundingClientRect().right),
    lastGroupRight: Math.round(box(groups[groups.length - 1]).right),
    hasDivider: Boolean(bar.querySelector('.fs-tabbar-divider')),
    borderTop: getComputedStyle(bar).borderTopWidth,
  };
}, cat);

/* Quick Access is the tab Derek screenshotted. v7.57 moved its adders into the
   Shown column header, so what remains in its bar is the tab's own reset —
   which is exactly the group whose ARRANGEMENT this file is about. */
console.log('\nthe tab Derek screenshotted is one row, not three blocks');
const qat = await measureBar('qat');
if (qat.skipped) {
  console.log(`  SKIP — ${qat.skipped}`);
} else {
  ok('the tab\'s reset is there', qat.labels.includes('Reset Items'), JSON.stringify(qat.labels));
  /* v7.57 lifted Add Divider / Add Spacer into the Shown column header. They
     must not ALSO be here — an adder in two places is the drift this repo's
     one-source rule exists to stop, and it would look identical in a
     screenshot of either half. */
  ok('…and the adders left for the column header rather than staying too',
    !qat.labels.some((l) => /^\+?\s*Add /.test(l)), JSON.stringify(qat.labels));
  ok('…and no per-tab Export/Import came back',
    !qat.labels.some((l) => /Export|Import/.test(l)), JSON.stringify(qat.labels));
  /* THE ASSERTION. Three stacked blocks means three different tops. */
  ok('…on a single row', qat.tops.length === 1, `${qat.tops.length} distinct tops: ${JSON.stringify(qat.tops)}`);
  ok('…and pushed to the far edge, not left-dumped',
    qat.panelRight - qat.lastGroupRight < 40, JSON.stringify(qat));
  /* The hairline separated resets from transfer. With transfer gone there is
     nothing left for it to separate, and drawing one anyway would be a line
     between a group and nothing. */
  ok('no hairline is drawn now that there is nothing to separate',
    qat.hasDivider === false, JSON.stringify(qat));
  ok('and a rule separates the bar from the tab\'s content',
    parseFloat(qat.borderTop) > 0, JSON.stringify(qat.borderTop));
}

/* The left-then-right grammar still has to hold where BOTH groups exist.
   v7.58 that is ANNOTATIONS: it builds a combo from a grid rather than listing
   shown against hidden, so its "+ Add Preset" has no column header to move
   into and stays in the bar beside the tab's reset. (The Ribbon Toolbar tab
   held this role in v7.57; it grew Shown/Hidden columns, and its Hide All went
   to the Hidden header where every other tab keeps one.) Without this the
   direction of the bar would go unchecked entirely. */
console.log('\nwhere both groups still exist, the direction holds');
const tb = await measureBar('markups');
if (tb.skipped) {
  console.log(`  SKIP — ${tb.skipped}`);
} else {
  ok('two groups, not one undifferentiated queue', tb.groups === 2, JSON.stringify(tb.groups));
  ok('…the tab-wide action sits left of the housekeeping',
    tb.firstGroupLeft < tb.lastGroupLeft, JSON.stringify(tb));
  ok('…the housekeeping is pushed to the far edge',
    tb.panelRight - tb.lastGroupRight < 40, JSON.stringify(tb));
  ok('…and it is all still one row', tb.tops.length === 1, JSON.stringify(tb.tops));
}

/* The bar is ONE component, so it must appear the same way on every tab that
   has anything to put in it — that is what stops the stack growing back one
   tab at a time. */
console.log('\nevery Customize tab closes the same way');
const perTab = [];
for (const cat of ['toolbar', 'panels', 'qat', 'context', 'themes', 'elements', 'markups']) {
  const r = await page.evaluate(async (c) => {
    window.__scStore.getState().openPreferences(`cz-${c}`);
    await new Promise((r) => setTimeout(r, 900));
    const content = document.querySelector('.prefs-content');
    const bar = content?.querySelector('.fs-tabbar');
    return {
      cat: c,
      bar: Boolean(bar),
      rowsInBar: bar ? [...new Set([...bar.querySelectorAll('button')]
        .map((b) => Math.round(b.getBoundingClientRect().top)))].length : 0,
      // the retired stack
      oldResetSection: Boolean(content?.querySelector('.fs-reset-section')),
      oldSoloGlobals: Boolean(content?.querySelector('.fs-customize-globals-solo')),
      strayAdderRow: Boolean(content?.querySelector('.fs-tbzone-adders, .fs-markup-cz-footrow')),
      barCount: content?.querySelectorAll('.fs-tabbar').length ?? 0,
    };
  }, cat);
  perTab.push(r);
}
/* v7.57: a tab renders a bar iff it has something to put in one. Themes is now
   the only tab with nothing — its + New Theme moved into the Shown column
   header and it registers no resets — and it must draw NO bar rather than an
   empty rule with a gap under it. Naming the exception explicitly is what
   stops "no bar" quietly spreading to a tab that should have had one. */
const NO_BAR = ['themes'];
ok('every tab that has something to put in a bar has one',
  perTab.filter((t) => !NO_BAR.includes(t.cat)).every((t) => t.bar),
  JSON.stringify(perTab.filter((t) => !NO_BAR.includes(t.cat) && !t.bar)));
ok('…and the one tab with nothing left in it draws no empty rule',
  perTab.filter((t) => NO_BAR.includes(t.cat)).every((t) => !t.bar),
  JSON.stringify(perTab.filter((t) => NO_BAR.includes(t.cat) && t.bar)));
ok('…and its contents never wrap into a second row',
  perTab.every((t) => t.rowsInBar <= 1), JSON.stringify(perTab.map((t) => [t.cat, t.rowsInBar])));
/* The old blocks are removed, not merely hidden — a stack that still exists in
   the markup is a stack somebody will render again. */
ok('the old Reset section is gone everywhere',
  perTab.every((t) => !t.oldResetSection), JSON.stringify(perTab.filter((t) => t.oldResetSection)));
ok('…so is the separate Export/Import row',
  perTab.every((t) => !t.oldSoloGlobals), JSON.stringify(perTab.filter((t) => t.oldSoloGlobals)));
/* Tabs whose adders were lifted into the bar must not have left the old row
   behind — that is how you end up with the buttons in two places. */
ok('no tab kept a loose adder or reset row beside the bar',
  perTab.every((t) => !t.strayAdderRow), JSON.stringify(perTab.filter((t) => t.strayAdderRow)));
/* v7.56: a tab whose adders need its own component's state renders its own bar
   (Editor, Annotations); the dialog renders one for the rest.
   v7.58, Derek: "move teh reset buttons so they are each under their respective
   section." One bar per TAB was right while a tab was one list. The Editor tab
   is four sections, so its single bar could only follow one of them — it sat
   under Transitions and read as belonging to it while resetting Elements and
   Suggestions too. It renders one bar per section now; every other tab still
   gets exactly one, which is what stops the stack growing back. */
const PER_SECTION = { elements: 3 };
ok('…and one bar per tab, except the tab that is four sections',
  perTab.every((t) => t.barCount === (PER_SECTION[t.cat] ?? (t.bar ? 1 : 0))),
  JSON.stringify(perTab.map((t) => [t.cat, t.barCount])));

console.log('\none bar, one definition');
const resets = readFileSync(new URL('../src/components/customizeResets.tsx', import.meta.url), 'utf8');
const dlg = readFileSync(new URL('../src/components/CustomizePanelsDialog.tsx', import.meta.url), 'utf8');
ok('TabActionBar replaced ResetSection rather than joining it',
  /export function TabActionBar/.test(resets) && !/export function ResetSection/.test(resets), '');
/* Two now: the tab-level bar, and the Editor tab's Element Suggestions
   section — that section's editor lives in this file, so its reset renders
   here. The other two Editor sections render theirs in EditElementsDialog. */
ok('…and the dialog renders only the bars it owns',
  (dlg.match(/<TabActionBar/g) || []).length === 2, '');
/* The resets still come from the one registry Settings ▸ Defaults compiles —
   the bar changed the arrangement, not the source of truth. */
ok('the bar still reads the shared reset registry',
  /CUSTOMIZE_RESETS\.filter\(\(a\) => a\.tab === tab/.test(resets), '');
/* The heading went with the section it labelled. It announced what its own
   buttons already say. */
ok('the "Reset to Default" heading is gone with the section',
  !/Reset to Default<\/h3>/.test(resets), '');

console.log(`\ncheck-v755: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
