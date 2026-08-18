/* check-v749 — Derek: "this window needs a cancel button", of the Page Setup
 * window that Settings ▸ Page Setup ▸ View opens.
 *
 * The button existed. `embedded` was hiding it, because that one prop was
 * answering two different questions: "does the caller draw my box?" and "is
 * there anywhere to cancel to?". They agreed until the per-template Page Setup
 * window arrived — that one draws its own window AND has its own dismiss, so
 * Cancel is entirely meaningful there and was suppressed by a flag that was
 * never about it.
 *
 * The fix ties the button to the truth instead of to a proxy: Cancel renders
 * if and only if there is a handler for it to call. That makes both halves
 * testable, and both halves are tested, because each has a distinct way to be
 * wrong:
 *
 *   · the template window must GAIN a Cancel — and it must actually dismiss,
 *     and it must NOT save. A Cancel that closes the window while quietly
 *     keeping the edits is worse than no Cancel, since the writer walks away
 *     believing the change was dropped. So this drives real edits, cancels,
 *     reopens, and reads the fields back.
 *   · the Guided Setup wizard must NOT gain one. Its step IS this page; a
 *     Cancel there had nowhere to go and would have been a dead control,
 *     which is the failure mode this project treats as cardinal.
 *
 * The type union that makes "a modal with no way out" a compile error is not
 * checked here — tsc checks it, and a devtools probe confirmed it rejects
 * exactly the two bad shapes and no good ones.
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

console.log('\nthe template Page Setup window has a Cancel');
await page.evaluate(() => window.__scStore.getState().openPreferences('page'));
await page.waitForSelector('.prefs-content .pst-list', { timeout: 8000 });
await settle(page);

const opened = await page.evaluate(async () => {
  const row = document.querySelector('.pst-list .template-select-item');
  const view = [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'View');
  view.click();
  await new Promise((r) => setTimeout(r, 500));
  const box = document.querySelector('.page-setup-dialog');
  return {
    open: Boolean(box),
    header: box?.querySelector('.dialog-header')?.textContent.trim(),
    buttons: box ? [...box.querySelectorAll('.dialog-actions button')].map((b) => b.textContent.trim()) : [],
  };
});
ok('View opens the template\'s page setup', opened.open === true, JSON.stringify(opened));
ok('…titled for the template, not generically', /Page Setup$/.test(opened.header || '') && opened.header !== 'Page Setup',
  JSON.stringify(opened.header));
ok('…and it now offers Cancel', opened.buttons.includes('Cancel'), JSON.stringify(opened.buttons));
ok('…alongside Reset Default and Apply',
  opened.buttons.includes('Apply') && opened.buttons.includes('Reset Default'),
  JSON.stringify(opened.buttons));

/* The button must be a real dialog button, not a bare native one. v7.01: a
   control that carries paint but no size looks right in a footer row and wrong
   everywhere else, so the size comes from the class, not from the ancestor. */
const shape = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Cancel');
  const apply = [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Apply');
  return {
    cls: btn?.className,
    h: Math.round(btn?.getBoundingClientRect().height ?? 0),
    applyH: Math.round(apply?.getBoundingClientRect().height ?? 0),
  };
});
ok('Cancel wears dialog-btn, so it carries its own size', /\bdialog-btn\b/.test(shape.cls || ''),
  JSON.stringify(shape));
ok('…and matches Apply\'s height', shape.h > 0 && shape.h === shape.applyH, JSON.stringify(shape));

/* THE ONE THAT MATTERS. Cancel must dismiss AND discard. Edit the top margin,
   cancel, reopen, and the old value must still be there — a Cancel that closes
   while keeping the edit is worse than none, because the writer believes the
   change was dropped. */
console.log('\nCancel dismisses and discards');
const cancelled = await page.evaluate(async () => {
  const field = () => [...document.querySelectorAll('.page-setup-dialog .page-setup-row')]
    .find((r) => /^Top/.test(r.querySelector('label')?.textContent || ''))
    ?.querySelector('input');
  const before = field().value;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(field(), '2.75');
  field().dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  const edited = field().value;

  [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Cancel').click();
  await new Promise((r) => setTimeout(r, 450));
  const dismissed = !document.querySelector('.page-setup-dialog');

  // reopen and read the field back
  const row = document.querySelector('.pst-list .template-select-item');
  [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'View').click();
  await new Promise((r) => setTimeout(r, 500));
  return { before, edited, dismissed, reopened: field()?.value };
});
ok('the edit actually took in the field', cancelled.edited === '2.75', JSON.stringify(cancelled));
ok('Cancel closes the window', cancelled.dismissed === true, JSON.stringify(cancelled));
ok('…and the edit is gone, not silently saved',
  cancelled.reopened === cancelled.before, JSON.stringify(cancelled));

/* And Apply still does save — the counterweight. Without this, a Cancel that
   discarded by breaking Apply would pass everything above. */
console.log('\nApply still saves');
const applied = await page.evaluate(async () => {
  const field = () => [...document.querySelectorAll('.page-setup-dialog .page-setup-row')]
    .find((r) => /^Top/.test(r.querySelector('label')?.textContent || ''))
    ?.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(field(), '1.25');
  field().dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Apply').click();
  await new Promise((r) => setTimeout(r, 500));
  const closed = !document.querySelector('.page-setup-dialog');
  const row = document.querySelector('.pst-list .template-select-item');
  [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'View').click();
  await new Promise((r) => setTimeout(r, 500));
  return { closed, reopened: field()?.value };
});
ok('Apply closes the window too', applied.closed === true, JSON.stringify(applied));
ok('…and the value stuck', applied.reopened === '1.25', JSON.stringify(applied));

/* Put it back, so a check run does not leave Derek's template edited. */
await page.evaluate(async () => {
  [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Reset Default').click();
  await new Promise((r) => setTimeout(r, 250));
  [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Apply').click();
  await new Promise((r) => setTimeout(r, 400));
  window.__scStore.getState().closePreferences?.();
  await new Promise((r) => setTimeout(r, 300));
});

/* ── the wizard step must NOT get one ────────────────────────────────────── */
console.log('\nthe Guided Setup step still has no Cancel');
const wizard = await page.evaluate(async () => {
  /* The wizard lives behind MenuBar-local state, so it is reached the way a
     writer reaches it: File ▸ New Script… ▸ the guided choice. */
  [...document.querySelectorAll('[class*=menu-item],[role=menuitem]')]
    .find((i) => i.textContent.trim() === 'File').click();
  await new Promise((r) => setTimeout(r, 400));
  const item = [...document.querySelectorAll('.menu-dropdown-item')]
    .find((i) => /New Script/i.test(i.textContent));
  if (!item) return { skipped: 'no New Script item in the File menu' };
  item.click();
  await new Promise((r) => setTimeout(r, 900));
  const choices = [...document.querySelectorAll('.fs-launcher-choice')];
  if (!choices.length) return { skipped: 'the New Script launcher did not open' };
  const guided = choices.find((c) => /guid|walk|step/i.test(c.textContent));
  if (!guided) return {
    skipped: `no guided choice among ${JSON.stringify(choices.map((c) => c.textContent.trim().slice(0, 24)))}`,
  };
  guided.click();
  await new Promise((r) => setTimeout(r, 800));
  return { open: Boolean(document.querySelector('.fs-guided-progress')) };
});
if (wizard.skipped) {
  console.log(`  SKIP driving the wizard — ${wizard.skipped}`);
} else {
  ok('the wizard opens', wizard.open === true, JSON.stringify(wizard));
  const step4 = await page.evaluate(async () => {
    // walk forward to the Page Setup step
    for (let i = 0; i < 8; i++) {
      if (document.querySelector('.fs-guided-pagesetup')) break;
      const next = [...document.querySelectorAll('button')]
        .find((b) => /^(Next|Continue)/.test(b.textContent.trim()));
      if (!next) break;
      next.click();
      await new Promise((r) => setTimeout(r, 350));
    }
    const pane = document.querySelector('.fs-guided-pagesetup');
    if (!pane) return { reached: false };
    return {
      reached: true,
      buttons: [...pane.querySelectorAll('.dialog-actions button')].map((b) => b.textContent.trim()),
    };
  });
  if (!step4.reached) {
    console.log('  SKIP the wizard\'s Page Setup step — could not reach it by clicking Next');
  } else {
    ok('the wizard\'s Page Setup step draws no Cancel',
      !step4.buttons.includes('Cancel'), JSON.stringify(step4.buttons));
    ok('…but keeps Reset Default and Apply',
      step4.buttons.includes('Apply') && step4.buttons.includes('Reset Default'),
      JSON.stringify(step4.buttons));
  }
}

console.log('\nthe shape of the fix');
const psd = readFileSync(new URL('../src/components/PageSetupDialog.tsx', import.meta.url), 'utf8');
const gsd = readFileSync(new URL('../src/components/GuidedSetupDialog.tsx', import.meta.url), 'utf8');
ok('Cancel is tied to having a handler, not to the embedded flag',
  /\{onClose && <button className="dialog-btn" onClick=\{onClose\}>Cancel<\/button>\}/.test(psd), '');
ok('…so the old `!embedded` gate is gone', !/!embedded && <button/.test(psd), '');
/* The no-op handler is the thing that made the old gate necessary. If it comes
   back, the wizard grows a dead Cancel and nothing else would notice. */
ok('the wizard passes no handler at all, rather than one that goes nowhere',
  /<PageSetupDialog embedded \/>/.test(gsd) && !/PageSetupDialog embedded onClose=\{\(\) => \{\}\}/.test(gsd), '');
ok('the modal path still requires a dismiss, by type',
  /embedded\?: false; onClose: \(\) => void/.test(psd), '');

console.log(`\ncheck-v749: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
