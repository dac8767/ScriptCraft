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
 *     [ adders ] ……………………………… [ resets ] │ [ Export  Import ]
 *
 * Left acts on the list above it. Right is the tab's own housekeeping, with a
 * hairline between undoing your changes and moving them between installs —
 * near enough to confuse, far enough apart to matter.
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

/* Quick Access is the tab Derek screenshotted, and the one where all three
   groups are present — adders, a reset, and the transfer pair. */
console.log('\nthe tab Derek screenshotted is one row, not three blocks');
const qat = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-qat');
  await new Promise((r) => setTimeout(r, 1200));
  const bar = document.querySelector('.prefs-content .fs-tabbar');
  if (!bar) return { skipped: 'no action bar on the Quick Access tab' };
  const groups = [...bar.querySelectorAll('.fs-tabbar-group')];
  const btns = [...bar.querySelectorAll('button')];
  const box = (e) => e.getBoundingClientRect();
  return {
    groups: groups.length,
    labels: btns.map((b) => b.textContent.trim()),
    // every button on ONE row: same top, within a pixel or two
    tops: [...new Set(btns.map((b) => Math.round(box(b).top)))],
    barTop: Math.round(box(bar).top),
    firstGroupLeft: Math.round(box(groups[0]).left),
    lastGroupLeft: Math.round(box(groups[groups.length - 1]).left),
    panelRight: Math.round(document.querySelector('.prefs-content').getBoundingClientRect().right),
    lastGroupRight: Math.round(box(groups[groups.length - 1]).right),
    hasDivider: Boolean(bar.querySelector('.fs-tabbar-divider')),
    borderTop: getComputedStyle(bar).borderTopWidth,
  };
});
if (qat.skipped) {
  console.log(`  SKIP — ${qat.skipped}`);
} else {
  ok('the adders, the reset and the transfer pair are all present',
    ['Add Divider', 'Add Spacer', 'Reset Items', 'Export…', 'Import…']
      .every((l) => qat.labels.includes(l)), JSON.stringify(qat.labels));
  /* THE ASSERTION. Three stacked blocks means three different tops. */
  ok('…on a single row', qat.tops.length === 1, `${qat.tops.length} distinct tops: ${JSON.stringify(qat.tops)}`);
  ok('…in three groups, not one undifferentiated queue', qat.groups === 3, JSON.stringify(qat.groups));
  /* Adders left, housekeeping right — the direction carries the meaning. */
  ok('the adders sit left of the housekeeping',
    qat.firstGroupLeft < qat.lastGroupLeft, JSON.stringify(qat));
  ok('…and the housekeeping is pushed to the far edge',
    qat.panelRight - qat.lastGroupRight < 40, JSON.stringify(qat));
  ok('a hairline separates resets from transfer', qat.hasDivider === true, JSON.stringify(qat));
  ok('and a rule separates the bar from the tab\'s content',
    parseFloat(qat.borderTop) > 0, JSON.stringify(qat.borderTop));
}

/* The bar is ONE component, so it must appear the same way on every tab that
   has anything to put in it — that is what stops the stack growing back one
   tab at a time. */
console.log('\nevery Customize tab closes the same way');
const perTab = [];
for (const cat of ['toolbar', 'panels', 'qat', 'context', 'themes', 'elements']) {
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
      strayAdderRow: Boolean(content?.querySelector('.fs-tbzone-adders')),
    };
  }, cat);
  perTab.push(r);
}
ok('every tab has the bar', perTab.every((t) => t.bar), JSON.stringify(perTab.filter((t) => !t.bar)));
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
const lifted = perTab.filter((t) => ['toolbar', 'panels', 'qat'].includes(t.cat));
ok('the lifted adder rows left nothing behind',
  lifted.every((t) => !t.strayAdderRow), JSON.stringify(lifted.filter((t) => t.strayAdderRow)));

console.log('\none bar, one definition');
const resets = readFileSync(new URL('../src/components/customizeResets.tsx', import.meta.url), 'utf8');
const dlg = readFileSync(new URL('../src/components/CustomizePanelsDialog.tsx', import.meta.url), 'utf8');
ok('TabActionBar replaced ResetSection rather than joining it',
  /export function TabActionBar/.test(resets) && !/export function ResetSection/.test(resets), '');
ok('…and the dialog renders exactly one of them',
  (dlg.match(/<TabActionBar/g) || []).length === 1, '');
/* The resets still come from the one registry Settings ▸ Defaults compiles —
   the bar changed the arrangement, not the source of truth. */
ok('the bar still reads the shared reset registry',
  /CUSTOMIZE_RESETS\.filter\(\(a\) => a\.tab === tab\)/.test(resets), '');
/* The heading went with the section it labelled. It announced what its own
   buttons already say. */
ok('the "Reset to Default" heading is gone with the section',
  !/Reset to Default<\/h3>/.test(resets), '');

console.log(`\ncheck-v755: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
