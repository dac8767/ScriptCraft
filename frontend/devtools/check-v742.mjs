/* check-v742 — seven dialogs onto the one shell.
 *
 * Queue #8, second half. Each of these hand-rolled the overlay Modal exists to
 * provide, and each carried the bug Modal's docstring names: the backdrop
 * closed on a plain `onClick`, so selecting text inside the box and releasing
 * the mouse outside it dismissed the dialog and threw the work away.
 *
 * That bug cannot be seen by reading the source — `onClick` looks correct —
 * and it cannot be seen by clicking, because a click that starts and ends on
 * the backdrop SHOULD close. It only shows up in the drag. So this drives the
 * real gesture: press inside the box, release outside, and assert the dialog
 * is still there.
 *
 * The second thing worth asserting is that adopting a shell did not INVENT
 * behaviour. Two of the seven deliberately have no way out — the welcome
 * screen is a forced choice, and the launcher's Cancel is optional — so the
 * shell must not hand them an Escape they never had.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const src = (p) => readFileSync(new URL(`../src/components/${p}`, import.meta.url), 'utf8');

const MIGRATED = ['GoToPage.tsx', 'OpenFile.tsx', 'VerifyEmailDialog.tsx',
  'ScriptFormatPickerDialog.tsx', 'NewScriptDialog.tsx', 'NewScriptLauncher.tsx',
  'WelcomeDialog.tsx'];

console.log('\nthe seven adopted the shell');
for (const f of MIGRATED) {
  const s = src(f);
  ok(`${f.replace('.tsx', '')} renders <Modal>`, /<Modal[\s>]/.test(s), '');
  ok(`…and no longer builds its own overlay`, !/className="dialog-overlay/.test(s), '');
}

console.log('\nthe backdrop bug they all carried');

const { browser, page } = await launch();
await boot(page);
await settle(page);

/* Go to Page is the smallest of them and opens from the store, so the gesture
   can be driven without walking a menu. */
const drag = await page.evaluate(async () => {
  window.__scStore.getState().setGoToPageOpen(true);
  await new Promise((r) => setTimeout(r, 400));
  const box = document.querySelector('.dialog-box');
  const overlay = document.querySelector('.dialog-overlay');
  if (!box || !overlay) return { opened: false };
  const b = box.getBoundingClientRect();
  const opts = { bubbles: true, cancelable: true };
  // press INSIDE the box…
  box.dispatchEvent(new MouseEvent('mousedown', { ...opts, clientX: b.left + 10, clientY: b.top + 10 }));
  // …release on the backdrop, the way a text selection that overshoots does
  overlay.dispatchEvent(new MouseEvent('mouseup', { ...opts, clientX: 5, clientY: 5 }));
  overlay.dispatchEvent(new MouseEvent('click', { ...opts, clientX: 5, clientY: 5 }));
  await new Promise((r) => setTimeout(r, 250));
  return { opened: true, stillUp: Boolean(document.querySelector('.dialog-box')) };
});
ok('the dialog opened', drag.opened === true, JSON.stringify(drag));
ok('a drag that STARTS inside and ends on the backdrop does not dismiss it',
  drag.stillUp === true, JSON.stringify(drag));

/* …while a press that genuinely starts on the backdrop still closes, or the
   fix above would just be a dialog you cannot dismiss. */
const press = await page.evaluate(async () => {
  const overlay = document.querySelector('.dialog-overlay');
  if (!overlay) return { had: false };
  overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
  await new Promise((r) => setTimeout(r, 250));
  return { had: true, gone: !document.querySelector('.dialog-box') };
});
ok('a press that starts ON the backdrop still closes it', press.had && press.gone, JSON.stringify(press));

/* Escape, which three of the seven did not have before. */
const esc = await page.evaluate(async () => {
  window.__scStore.getState().setGoToPageOpen(true);
  await new Promise((r) => setTimeout(r, 300));
  const before = Boolean(document.querySelector('.dialog-box'));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  return { before, after: Boolean(document.querySelector('.dialog-box')) };
});
ok('Escape closes it now', esc.before && !esc.after, JSON.stringify(esc));

console.log('\nadopting a shell did not invent an exit');
{
  const w = src('WelcomeDialog.tsx');
  // it has no onClose at all — it is a forced choice
  ok('the welcome screen still cannot be dismissed',
    /closeOnBackdrop=\{false\}/.test(w) && /closeOnEscape=\{false\}/.test(w), '');
  const l = src('NewScriptLauncher.tsx');
  ok('the launcher offers an exit only when it was given one',
    /closeOnBackdrop=\{Boolean\(onClose\)\}/.test(l) && /closeOnEscape=\{Boolean\(onClose\)\}/.test(l), '');
}

console.log('\nthe shell grew to fit, rather than the dialogs staying out');
{
  const m = src('Modal.tsx');
  for (const p of ['overlayClassName', 'overlayStyle', 'onBoxKeyDown', 'boxRef']) {
    ok(`Modal accepts ${p}`, new RegExp(`${p}\\?:`).test(m), '');
  }
  // the backdrop rule itself, which is the whole reason for the migration
  ok('…and still closes on mousedown, not click',
    /onMouseDown=\{\(e\) => \{[\s\S]{0,220}e\.target === e\.currentTarget/.test(m), '');
}

console.log(`\ncheck-v742: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
