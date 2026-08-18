/* check-v752 — Derek, two things:
 *   1 "if i click on the bottom half of a template item it does not select."
 *   2 "make sure there is a warning window before allowing the user to change
 *      the template on an existing project."
 *
 * THE DEAD BOTTOM HALF was mine, from v7.50, and the shape of the mistake is
 * worth keeping. The rule I wanted was "a press ON a button is not also a row
 * selection." What I wrote was a stopPropagation on the CONTAINER holding the
 * buttons — and that container is the full width of the card. The buttons take
 * up the first ~50px; the remaining ~1,150px was empty strip quietly eating
 * every click that landed on it. Below the description, the card was dead.
 *
 * So this is checked by GEOMETRY, not by clicking whatever `.click()` happens
 * to pick. A click is dispatched at real coordinates in the wide empty gap
 * beside the buttons, and at the card's corners — the exact places a person
 * aims when they mean "this one" and miss the title. A version of this check
 * that just called card.click() would have passed against the broken code,
 * since that dispatches on the card itself and never on the strip.
 *
 * The other half of the same rule is checked too, in the other direction: View
 * must still open without the press also selecting the row. Fixing a dead zone
 * by deleting the guard entirely would trade one bug for a worse one.
 *
 * THE WARNING is the second gate in front of applying, and it exists because
 * the first one cannot do this job. The conflict dialog only appears when the
 * new template drops an element the script uses; plenty of switches are
 * conflict-free and still re-format every line and swap the page setup. So the
 * warning asks "do you want this at all", the conflict pass asks "here is
 * specifically what breaks", and they are checked as two separate gates in that
 * order.
 *
 * What is NOT warned about matters as much, and both are asserted: re-applying
 * the template the script already has changes nothing, and an EMPTY document is
 * the new-script and Guided Setup flow, where a confirmation on every choice
 * would be noise wearing the costume of safety.
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

const openTab = async () => {
  await page.evaluate(() => window.__scStore.getState().openPreferences('page'));
  await page.waitForSelector('.pst-list', { timeout: 8000 });
  await settle(page);
  await page.waitForTimeout(400);
};
await openTab();

/* ── 1. the whole card selects ───────────────────────────────────────────── */
console.log('\nevery part of a card selects it, not just the top');
const geometry = await page.evaluate(() => {
  const card = document.querySelectorAll('.pst-list .template-select-item')[1];
  const cb = card.getBoundingClientRect();
  const acts = card.querySelector('.template-select-item-actions').getBoundingClientRect();
  const btn = card.querySelector('button').getBoundingClientRect();
  return {
    // how much of the actions row is empty strip beside the buttons
    stripWidth: Math.round(acts.right - btn.right),
    // the actions row really does sit in the card's lower half
    inLowerHalf: acts.top > cb.top + cb.height / 2,
  };
});
ok('the actions row does span the card\'s lower half', geometry.inLowerHalf === true,
  JSON.stringify(geometry));
ok('…with a wide empty strip beside the buttons — the part that was dead',
  geometry.stripWidth > 200, JSON.stringify(geometry));

/* Dispatch at REAL coordinates. card.click() would fire on the card element
   itself and pass even against the broken code. */
const spots = await page.evaluate(async () => {
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const card = cards[1];
  const other = cards[2];
  const hitAt = async (x, y) => {
    other.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // move selection away
    await new Promise((r) => setTimeout(r, 150));
    const el = document.elementFromPoint(x, y);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    await new Promise((r) => setTimeout(r, 200));
    return { under: el.className || el.tagName, selected: card.classList.contains('selected') };
  };
  const cb = card.getBoundingClientRect();
  const acts = card.querySelector('.template-select-item-actions').getBoundingClientRect();
  const btn = card.querySelector('button').getBoundingClientRect();
  return {
    stripBesideButtons: await hitAt((btn.right + acts.right) / 2, acts.top + acts.height / 2),
    bottomRightCorner: await hitAt(cb.right - 6, cb.bottom - 4),
    bottomLeftCorner: await hitAt(cb.left + 6, cb.bottom - 4),
    theDescription: await hitAt(cb.left + 60, acts.top - 8),
    theTitle: await hitAt(cb.left + 40, cb.top + 10),
  };
});
for (const [where, r] of Object.entries(spots)) {
  ok(`clicking ${where.replace(/([A-Z])/g, ' $1').toLowerCase()} selects the card`,
    r.selected === true, JSON.stringify(r));
}

/* The other direction: the guard still has to do its job. */
const button = await page.evaluate(async () => {
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const card = cards[1];
  cards[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  const wasSelected = card.classList.contains('selected');
  const view = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'View');
  const vb = view.getBoundingClientRect();
  document.elementFromPoint(vb.left + vb.width / 2, vb.top + vb.height / 2)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 600));
  const out = {
    wasSelected,
    opened: Boolean(document.querySelector('.page-setup-dialog')),
    nowSelected: card.classList.contains('selected'),
  };
  [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Cancel')?.click();
  await new Promise((r) => setTimeout(r, 400));
  return out;
});
ok('pressing View still opens the page setup', button.opened === true, JSON.stringify(button));
ok('…without the press also selecting the row',
  button.wasSelected === false && button.nowSelected === false, JSON.stringify(button));

/* ── 2. the warning ──────────────────────────────────────────────────────── */
console.log('\nchanging the format of a script with writing in it asks first');
const warned = await page.evaluate(async () => {
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [{ type: 'action', content: [{ type: 'text', text: 'Real work already in progress here.' }] }],
  });
  await new Promise((r) => setTimeout(r, 400));
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const nameOf = (c) => c.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  const wasCurrent = nameOf(cards.find((c) => c.querySelector('.template-select-current-badge')));
  const target = cards.find((c) => !c.querySelector('.template-select-current-badge'));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  [...document.querySelectorAll('.pst-newrow button')]
    .find((b) => /Apply to Script/.test(b.textContent)).click();
  await new Promise((r) => setTimeout(r, 700));
  const box = document.querySelector('.fs-confirm-box');
  return {
    wasCurrent,
    targetName: nameOf(target),
    shown: Boolean(box),
    text: box?.textContent?.trim() || '',
    buttons: box ? [...box.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
  };
});
ok('a warning window appears before anything changes', warned.shown === true, JSON.stringify(warned));
ok('…naming the template it would switch to',
  warned.text.includes(warned.targetName), JSON.stringify(warned.targetName));
/* It has to say what actually happens, not just "are you sure" — the page
   setup swap is the half a writer would not expect. */
ok('…saying the script gets re-formatted', /re-formatted/i.test(warned.text), warned.text.slice(0, 120));
ok('…and that the page setup is replaced too',
  /page setup|margins/i.test(warned.text), warned.text.slice(0, 200));
ok('…offering a way out as well as a way through',
  warned.buttons.some((b) => /^Cancel$/i.test(b)) && warned.buttons.some((b) => /Change Format/i.test(b)),
  JSON.stringify(warned.buttons));

/* Cancel must leave everything exactly as it was. */
const backedOut = await page.evaluate(async () => {
  [...document.querySelectorAll('.fs-confirm-box button')]
    .find((b) => /^Cancel$/i.test(b.textContent.trim())).click();
  await new Promise((r) => setTimeout(r, 600));
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const nameOf = (c) => c.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  return {
    gone: !document.querySelector('.fs-confirm-box'),
    current: nameOf(cards.find((c) => c.querySelector('.template-select-current-badge'))),
  };
});
ok('cancelling closes it', backedOut.gone === true, JSON.stringify(backedOut));
ok('…and the script keeps the template it had',
  backedOut.current === warned.wasCurrent, JSON.stringify({ backedOut, was: warned.wasCurrent }));

/* And going through must actually go through — a warning that blocks the thing
   it warns about is its own bug. */
const wentThrough = await page.evaluate(async () => {
  [...document.querySelectorAll('.pst-newrow button')]
    .find((b) => /Apply to Script/.test(b.textContent)).click();
  await new Promise((r) => setTimeout(r, 700));
  [...document.querySelectorAll('.fs-confirm-box button')]
    .find((b) => /Change Format/i.test(b.textContent.trim()))?.click();
  await new Promise((r) => setTimeout(r, 800));
  // a conflict question may follow — that is gate 2, and it is check-v751's
  const res = [...document.querySelectorAll('button')]
    .find((b) => /Apply Without Resolving/i.test(b.textContent.trim()));
  if (res) { res.click(); await new Promise((r) => setTimeout(r, 700)); }
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const nameOf = (c) => c.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  return { current: nameOf(cards.find((c) => c.querySelector('.template-select-current-badge'))) };
});
ok('confirming really does change the template',
  wentThrough.current === warned.targetName, JSON.stringify({ wentThrough, wanted: warned.targetName }));

/* ── what must NOT be warned about ───────────────────────────────────────── */
console.log('\nand it stays quiet where there is nothing at stake');
const reapply = await page.evaluate(async () => {
  // the card is already selected and already current — applying changes nothing
  [...document.querySelectorAll('.pst-newrow button')]
    .find((b) => /Apply to Script/.test(b.textContent)).click();
  await new Promise((r) => setTimeout(r, 700));
  const box = document.querySelector('.fs-confirm-box');
  if (box) {
    [...box.querySelectorAll('button')].find((b) => /^Cancel$/i.test(b.textContent.trim()))?.click();
    await new Promise((r) => setTimeout(r, 400));
  }
  return { warned: Boolean(box) };
});
ok('re-applying the template the script already has does not ask',
  reapply.warned === false, JSON.stringify(reapply));

const emptyDoc = await page.evaluate(async () => {
  const ed = window.__scEditor;
  ed.commands.setContent({ type: 'doc', content: [{ type: 'action' }] });
  await new Promise((r) => setTimeout(r, 400));
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const target = cards.find((c) => !c.querySelector('.template-select-current-badge'));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  [...document.querySelectorAll('.pst-newrow button')]
    .find((b) => /Apply to Script/.test(b.textContent)).click();
  await new Promise((r) => setTimeout(r, 800));
  const box = document.querySelector('.fs-confirm-box');
  const out = { warned: Boolean(box) };
  if (box) {
    [...box.querySelectorAll('button')].find((b) => /^Cancel$/i.test(b.textContent.trim()))?.click();
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
});
/* The new-script and Guided Setup flows land here on every choice. */
ok('an empty document is not warned about — that is the new-script flow',
  emptyDoc.warned === false, JSON.stringify(emptyDoc));

console.log('\nboth windows, one gate');
const hook = readFileSync(new URL('../src/hooks/useApplyTemplate.tsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/components/TemplateCard.tsx', import.meta.url), 'utf8');
/* The warning lives with the applying, so the Format window got it too without
   being told — the same reason the page layout and the conflict pass live
   there. */
ok('the warning is part of applying, not of one window',
  /confirmDialog\(/.test(hook), '');
ok('…gated on the template actually changing', /const changing = activeId !== template\.id/.test(hook), '');
ok('…and on the document having something in it', /changing && !isEmptyDoc\(\)/.test(hook), '');
/* Never window.confirm: under Tauri it is an async IPC shim returning a
   Promise, and a Promise is always truthy, so the guard would pass whatever
   the writer answered. */
ok('it uses confirmDialog, never window.confirm',
  !/window\.confirm|[^.]\bconfirm\(/.test(hook), '');
ok('the row decides selection by what was pressed, not by a blanket guard',
  /closest\('button, input, select, a'\)/.test(card), '');

console.log(`\ncheck-v752: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
