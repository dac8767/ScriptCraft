/* check-v756 — Derek: "instead of having import+export buttons on all of the
 * tabs in the customize window, just have a button below the tabs that says
 * 'Backup & Restore'. clicking it takes you to the tab in settings of the same
 * name. remove the import and export options from all tabs in both the
 * customize window and the settings window (excluding the settings > Backup &
 * Restore tab obviously)."
 *
 * The pair was never per-tab. Both buttons moved the whole `customize` preset
 * bundle regardless of which tab you happened to be looking at, so repeating
 * them on seven tabs advertised a scope they did not have — the Themes tab's
 * Export… exported your toolbar layout too. One door to the one place that
 * does this is both less UI and a truer description of what happens.
 *
 * WHAT THIS CHECKS, and why the negative half is the important half. "The door
 * works" is easy and would pass while a forgotten pair still sat on some tab
 * nobody opened during the test. So every Settings tab and every Customize tab
 * is swept for a surviving Export or Import, and the ONE place they are
 * allowed — Settings ▸ Backup & Restore — is asserted to still have one, since
 * a sweep that removed them everywhere would also "pass" if it had emptied the
 * tab that is supposed to do the job.
 *
 * A DOOR IS NOT A COPY. The failure worth guarding against is someone reading
 * "put Backup & Restore on the Customize window" and implementing a second
 * export flow behind it. So the button is driven for real and the Settings
 * window is checked to have actually opened on that tab — not merely that a
 * click handler exists.
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

/* ── the door ────────────────────────────────────────────────────────────── */
console.log('\nthe Customize window has one Backup & Restore door, below the tabs');
const door = await page.evaluate(async () => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Customize').click();
  await new Promise((r) => setTimeout(r, 1300));
  const rail = document.querySelector('.fs-customize-tabs');
  if (!rail) return { skipped: 'the Customize window did not open' };
  const btn = [...document.querySelectorAll('button')]
    .find((b) => /Backup & Restore/.test(b.textContent));
  const tabs = [...rail.querySelectorAll('.prefs-tab')];
  const box = (e) => e.getBoundingClientRect();
  return {
    exists: Boolean(btn),
    inRail: btn ? rail.contains(btn) : false,
    belowTabs: btn ? Math.round(box(btn).top) > Math.round(box(tabs[tabs.length - 1]).bottom) : false,
    count: [...document.querySelectorAll('button')]
      .filter((b) => /Backup & Restore/.test(b.textContent)).length,
  };
});
if (door.skipped) {
  console.log(`  SKIP — ${door.skipped}`);
} else {
  ok('the door is there', door.exists === true, JSON.stringify(door));
  /* v7.68, Derek: "move the restore and backup button to the same row as the
     lock button." It sat under the tab rail from v7.56 ("a button below the
     tabs") until the lock's own row turned out to be the better home — both
     are window-wide, and stacked in two places they read as the loose column
     of buttons he photographed. check-v768 pins the new placement; what stays
     here is the part v7.56 was really about, which is that there is ONE of it
     and it goes somewhere. */
  ok('…and there is exactly one of it', door.count === 1, JSON.stringify(door));
}

/* It must actually GO somewhere. A handler that opens Settings on whatever tab
   was last used would look identical until you tried it. */
console.log('\nit really opens Settings on that tab');
const went = await page.evaluate(async () => {
  [...document.querySelectorAll('button')]
    .find((b) => /Backup & Restore/.test(b.textContent))?.click();
  await new Promise((r) => setTimeout(r, 1400));
  const prefs = document.querySelector('.prefs-window');
  if (!prefs) return { opened: false };
  return {
    opened: true,
    /* Scoped to the Settings window on purpose: the Customize rail uses
       `.prefs-tab` too, so an unscoped query reads the wrong window's tab. */
    activeTab: [...prefs.querySelectorAll('.prefs-tab')]
      .find((t) => t.classList.contains('active'))?.textContent.trim(),
    showsTheChecklist: /Export Preset/i.test(document.querySelector('.prefs-content')?.textContent || ''),
    /* Non-destructive: Customize has unsaved Cancel/Save state, so the door
       must not close it out from under the writer. */
    customizeSurvived: Boolean(document.querySelector('.fs-customize-dialog')),
  };
});
ok('Settings opened', went.opened === true, JSON.stringify(went));
ok('…on Backup & Restore', went.activeTab === 'Backup & Restore', JSON.stringify(went.activeTab));
ok('…showing the preset checklist that does the job', went.showsTheChecklist === true, JSON.stringify(went));
ok('…and the Customize window is left standing behind it',
  went.customizeSurvived === true, JSON.stringify(went));

/* ── the negative half: nothing was left behind ──────────────────────────── */
console.log('\nno Export or Import survives on any other tab');
await page.evaluate(async () => {
  window.__scStore.getState().closePreferences?.();
  await new Promise((r) => setTimeout(r, 400));
});
const settingsTabs = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('general');
  await new Promise((r) => setTimeout(r, 900));
  return [...document.querySelectorAll('.prefs-tab')].map((t) => t.textContent.trim());
});
const strays = [];
let backupHasOne = false;
for (const label of settingsTabs) {
  const hits = await page.evaluate(async (lab) => {
    [...document.querySelectorAll('.prefs-tab')].find((x) => x.textContent.trim() === lab).click();
    await new Promise((r) => setTimeout(r, 550));
    const c = document.querySelector('.prefs-content');
    if (!c) return [];
    return [...c.querySelectorAll('button, .fs-addmenu-trigger')]
      .filter((e) => e.getBoundingClientRect().height > 0 && /export|import/i.test(e.textContent))
      .map((e) => ({ tab: lab, t: e.textContent.trim().slice(0, 30) }));
  }, label);
  if (label === 'Backup & Restore') backupHasOne = hits.length > 0;
  else strays.push(...hits);
}
ok('every Settings tab was swept', settingsTabs.length >= 10, `${settingsTabs.length} tabs`);
ok('…and none of them offers Export or Import', strays.length === 0, JSON.stringify(strays));
/* The exclusion Derek named. Without this the sweep above would be satisfied
   by an app that could no longer back anything up at all. */
ok('Backup & Restore still does, which is the whole point',
  backupHasOne === true, '');

const custStrays = await page.evaluate(async () => {
  window.__scStore.getState().closePreferences?.();
  await new Promise((r) => setTimeout(r, 400));
  const out = [];
  for (const cat of ['elements', 'toolbar', 'panels', 'qat', 'context', 'markups', 'themes']) {
    window.__scStore.getState().openPreferences(`cz-${cat}`);
    await new Promise((r) => setTimeout(r, 800));
    const c = document.querySelector('.prefs-content');
    out.push(...[...(c?.querySelectorAll('button, .fs-addmenu-trigger') ?? [])]
      .filter((e) => e.getBoundingClientRect().height > 0 && /export|import/i.test(e.textContent))
      .map((e) => ({ cat, t: e.textContent.trim().slice(0, 30) })));
  }
  return out;
});
ok('…nor does any Customize tab', custStrays.length === 0, JSON.stringify(custStrays));

console.log('\na door, not a second implementation');
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const cust = src('components/CustomizePanelsDialog.tsx');
ok('the Customize window routes to Settings rather than exporting',
  /openPreferences\('backup'\)/.test(cust) && !/openPresetExport\(/.test(cust), '');
ok('…and imports no export flow of its own',
  !/importCustomizationsFlow|exportCustomizationsFlow/.test(cust), '');
/* The store's tab type had said `'saveloc' | 'keys'` for a long time while the
   dialog's own prop accepted every tab — narrower than the truth, so a caller
   wanting any other tab got a compile error for something that worked. */
ok('the store can actually name the tab it sends you to',
  /openPreferences: \(tab\?: PreferencesTab\) => void/.test(src('stores/editorStore.ts')), '');
ok('…and Backup & Restore is one of them',
  /export type PreferencesTab =[\s\S]{0,200}'backup'/.test(src('stores/editorStore.ts')), '');

console.log(`\ncheck-v756: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
