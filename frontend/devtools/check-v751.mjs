/* check-v751 — Derek, of the template list now in Settings ▸ Page Setup: "the
 * window lacks the ability to select a template and apply it, like the other
 * window has."
 *
 * I had left selection out of that list on purpose in v7.50, reasoning it was
 * a management list where clicking a row meant nothing. Derek wants it to be
 * both, so it is both — and the interesting risk is not the selecting, it is
 * the APPLYING.
 *
 * Applying a template reads like one line and is four things:
 *
 *   · the active template id (Industry Standard being `null`, not its own id),
 *   · that template's PAGE LAYOUT copied onto the script — without which the
 *     entire page of fields behind View looks like it works and changes
 *     nothing, which is precisely the bug v7.10 existed to fix,
 *   · a CONFLICT pass, because a template can disable an element the script is
 *     already using or lock formatting it has already applied, and applying
 *     blindly mangles the draft silently,
 *   · starter content, seeded into a genuinely empty document only.
 *
 * Three of those four are invisible when missing. A second implementation in
 * the Settings tab would have got the first one right and been perfectly
 * capable of dropping the other three, so both surfaces go through one
 * useApplyTemplate — and the assertions below are written to catch a
 * reimplementation, not just a wiring slip: the page layout is proven to
 * travel by EDITING a template's page setup first and reading the number back
 * off the script afterwards.
 *
 * One thing deliberately differs from the Format window. That window closes
 * itself on Apply; the Settings tab stays open and says so with a toast, since
 * shutting the whole Settings window from under someone mid-configuration
 * would be its own surprise. Asserted, because a difference that quietly
 * disappears is as much a bug as one that quietly appears.
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

console.log('\na row in the Settings list is a choice now');
const initial = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const nameOf = (c) => c.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  return {
    selected: cards.filter((c) => c.classList.contains('selected')).map(nameOf),
    current: cards.filter((c) => c.querySelector('.template-select-current-badge')).map(nameOf),
    applyBtn: [...document.querySelectorAll('.pst-newrow button')]
      .some((b) => /Apply to Script/.test(b.textContent)),
  };
});
ok('the list offers an Apply', initial.applyBtn === true, JSON.stringify(initial));
ok('…and opens with the script\'s own template already chosen',
  initial.selected.length === 1 && initial.selected[0] === initial.current[0],
  JSON.stringify(initial));

const picked = await page.evaluate(async () => {
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const other = cards.find((c) => !c.querySelector('.template-select-current-badge'));
  other.click();
  await new Promise((r) => setTimeout(r, 300));
  return {
    name: other.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim(),
    selected: other.classList.contains('selected'),
    onlyOne: document.querySelectorAll('.pst-list .template-select-item.selected').length,
  };
});
ok('clicking a row selects it', picked.selected === true, JSON.stringify(picked));
ok('…and only it', picked.onlyOne === 1, JSON.stringify(picked));

/* THE PAGE LAYOUT MUST TRAVEL. Edit the chosen template's top margin through
   View, then apply it, and read the number off the SCRIPT. This is the
   assertion a reimplementation would fail: setting the active id alone passes
   everything else here and leaves every page-setup field a decoration. */
console.log('\napplying carries the template\'s page setup onto the script');
/* The dialog's field is inches; the layout stores POINTS (topMargin). 1.5in is
   108pt exactly, so the assertion is not chasing a rounding artefact. */
const TOP_IN = 1.5;
const TOP_PT = 108;
const carried = await page.evaluate(async (top) => {
  const card = [...document.querySelectorAll('.pst-list .template-select-item.selected')][0];
  [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'View').click();
  await new Promise((r) => setTimeout(r, 600));
  const field = [...document.querySelectorAll('.page-setup-dialog .page-setup-row')]
    .find((r) => /^Top/.test(r.querySelector('label')?.textContent || ''))
    ?.querySelector('input');
  if (!field) return { skipped: 'no Top margin field' };
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(field, String(top));
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  [...document.querySelectorAll('.page-setup-dialog .dialog-actions button')]
    .find((b) => b.textContent.trim() === 'Apply').click();
  await new Promise((r) => setTimeout(r, 500));

  const scriptTopBefore = window.__scStore.getState().pageLayout.topMargin;
  [...document.querySelectorAll('.pst-newrow button')]
    .find((b) => /Apply to Script/.test(b.textContent)).click();
  await new Promise((r) => setTimeout(r, 900));
  // step past the conflict question if one was raised
  const skip = [...document.querySelectorAll('button')]
    .find((b) => /Apply Without Resolving|Resolve & Apply/i.test(b.textContent.trim()));
  if (skip) { skip.click(); await new Promise((r) => setTimeout(r, 700)); }
  return {
    scriptTopBefore,
    scriptTopAfter: window.__scStore.getState().pageLayout.topMargin,
    settingsStillOpen: Boolean(document.querySelector('.pst-list')),
    toast: document.querySelector('[class*=toast]')?.textContent?.trim() || null,
  };
}, TOP_IN);
if (carried.skipped) {
  console.log(`  SKIP the page-layout carry-over — ${carried.skipped}`);
} else {
  ok('the template\'s edited top margin lands on the script',
    carried.scriptTopAfter === TOP_PT, JSON.stringify(carried));
  ok('…and it really changed, so the assertion is not reading a coincidence',
    carried.scriptTopBefore !== TOP_PT, JSON.stringify(carried));
  /* The deliberate difference from the Format window. */
  ok('Settings stays open rather than closing out from under you',
    carried.settingsStillOpen === true, JSON.stringify(carried));
  ok('…and says the template was applied', /applied/i.test(carried.toast || ''),
    JSON.stringify(carried.toast));
}

const moved = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const nameOf = (c) => c.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  return cards.filter((c) => c.querySelector('.template-select-current-badge')).map(nameOf);
});
ok('the current badge moved to the applied template',
  moved.length === 1 && moved[0] === picked.name, JSON.stringify({ moved, picked: picked.name }));

/* THE CONFLICT PASS. The writer must be ASKED, not have the draft silently
   rewritten nor the template silently refused. */
console.log('\nconflicts are still asked about, not skipped');
const conflict = await page.evaluate(async () => {
  /* The reachable conflict is a DISABLED ELEMENT, not locked formatting: every
     Industry Standard rule sets allowFormatOverride, so getLockedFormatting
     returns nothing locked and the violation branch cannot fire for it. A
     camera shot is the honest trigger — the stage, radio and AV formats have
     no camera elements, so applying one to a script containing a shot has to
     ask what to do with it. */
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. ROOM - DAY' }] },
      { type: 'shot', content: [{ type: 'text', text: 'CLOSE ON HER' }] },
    ],
  });
  await new Promise((r) => setTimeout(r, 400));

  const cards = [...document.querySelectorAll('.pst-list .template-select-item')];
  const nameOf = (c) => c.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  const before = cards.find((c) => c.querySelector('.template-select-current-badge'));
  const wasCurrent = before ? nameOf(before) : null;
  const target = cards.find((c) => /Radio Play/.test(nameOf(c) || ''));
  if (!target) return { skipped: 'Radio Play not listed' };
  target.click();
  await new Promise((r) => setTimeout(r, 250));
  [...document.querySelectorAll('.pst-newrow button')]
    .find((b) => /Apply to Script/.test(b.textContent)).click();
  await new Promise((r) => setTimeout(r, 700));
  /* v7.52 put a confirmation in front of this — changing the format of a script
     with writing in it is not a one-click act. Consent to it here; check-v752
     is where the warning itself is driven. */
  const consent = [...document.querySelectorAll('button')]
    .find((b) => /^Change Format$/i.test(b.textContent.trim()));
  if (consent) { consent.click(); await new Promise((r) => setTimeout(r, 700)); }
  const dlg = [...document.querySelectorAll('.dialog-box, [class*=conflict]')]
    .find((d) => /conflict/i.test(d.className) || /conflict/i.test(d.textContent));
  const out = { asked: Boolean(dlg), wasCurrent, wasWarned: Boolean(consent) };
  if (dlg) {
    out.choices = [...dlg.querySelectorAll('button')].map((b) => b.textContent.trim());
    [...dlg.querySelectorAll('button')].find((b) => /^Cancel$/i.test(b.textContent.trim()))?.click();
    await new Promise((r) => setTimeout(r, 700));
    out.currentAfterCancel = [...document.querySelectorAll('.pst-list .template-select-item')]
      .find((c) => c.querySelector('.template-select-current-badge'))
      ?.querySelector('.template-select-item-name')?.childNodes[0]?.textContent.trim();
  }
  return out;
});
if (conflict.skipped) {
  console.log(`  SKIP the conflict pass — ${conflict.skipped}`);
} else {
  ok('applying a template that drops an element the script uses asks first',
    conflict.asked === true, JSON.stringify(conflict));
  ok('…offering to resolve, to apply anyway, or to back out',
    (conflict.choices || []).length >= 3, JSON.stringify(conflict.choices));
  /* Backing out must leave the script exactly as it was. A "Cancel" that has
     already switched the template is the same lie as a Cancel that saves. */
  ok('…and backing out leaves the script on the template it had',
    conflict.currentAfterCancel === conflict.wasCurrent, JSON.stringify(conflict));
}

console.log('\none apply, used twice');
const hook = readFileSync(new URL('../src/hooks/useApplyTemplate.tsx', import.meta.url), 'utf8');
const tabSrc = readFileSync(new URL('../src/components/PageSetupTab.tsx', import.meta.url), 'utf8');
const dlgSrc = readFileSync(new URL('../src/components/TemplateSelectDialog.tsx', import.meta.url), 'utf8');
ok('both surfaces go through useApplyTemplate',
  /useApplyTemplate\(/.test(tabSrc) && /useApplyTemplate\(/.test(dlgSrc), '');
/* Each of the three invisible halves, asserted from the one place they live —
   so deleting one fails here even if some future check only drives the dialog. */
ok('the page layout is part of applying, not of the dialog',
  /setPageLayout\(\s*\n?\s*useFormattingTemplateStore\.getState\(\)\.getTemplatePageLayout/.test(hook), '');
ok('the conflict pass is too', /detectTemplateConflicts\(editor, template\)/.test(hook), '');
ok('…and starter content, for empty documents only',
  /isEmptyDoc\(\)/.test(hook) && /starterDocument/.test(hook), '');
ok('Industry Standard is still stored as null, not as its own id',
  /template\.id === INDUSTRY_STANDARD_ID \? null : template\.id/.test(hook), '');
/* Neither caller may keep its own copy of any of that. */
for (const [label, src] of [['the tab', tabSrc], ['the window', dlgSrc]]) {
  ok(`${label} keeps no apply logic of its own`,
    !/detectTemplateConflicts|resolveTemplateConflicts|starterDocument/.test(src), '');
}
/* The conflict dialog rides along with the flow rather than being three
   handlers each caller has to remember to wire. */
ok('both render the conflict question the hook hands back',
  /\{conflictDialog\}/.test(tabSrc) && /\{conflictDialog\}/.test(dlgSrc), '');

console.log(`\ncheck-v751: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
