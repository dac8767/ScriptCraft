/* check-v735 — Derek's feedback queue, all of it.
 *
 *   A  status messages move to the page, where Save lands
 *   B  the "download folder" setting says what it does
 *   C  CUT TO BLACK.
 *   D  the suggestion table says Character Name
 *   E  seven items leave the context menu; two join it
 *   F  the feedback thank-you drops half an inch
 *
 * A is the one worth the browser. "Settings saved" was in the bottom-right
 * corner and Save was on the page — one status channel in each place, and the
 * eye in neither. The fix reads the SAME savedFlashSpot() the save flash uses,
 * so the assertion is that the two agree with each other, measured, rather
 * than that a number matches a constant.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const { browser, page } = await launch();
await boot(page);
await page.evaluate(() => {
  window.__scEditor.commands.setContent({ type: 'doc', content: [
    { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. ROOM - DAY' }] },
    { type: 'action', content: [{ type: 'text', text: 'She crosses to the window.' }] },
  ] });
});
await settle(page);

console.log('\nA. a status message lands where Save does');

const placed = await page.evaluate(async () => {
  const t = await window.__scImport('/src/components/Toast.tsx');
  t.showToast('Settings saved', 'success');
  await new Promise((r) => setTimeout(r, 400));
  const stack = document.querySelector('.fs-toast-stack');
  const pill = document.querySelector('.fs-toast');
  const pageR = document.querySelector('.page')?.getBoundingClientRect() ?? null;
  if (!stack || !pill || !pageR) return { found: false, stack: !!stack, pill: !!pill };
  const s = stack.getBoundingClientRect();
  const p = pill.getBoundingClientRect();
  return {
    found: true,
    corner: stack.classList.contains('fs-toast-stack--corner'),
    // centred on the PAGE, not the window — the page shifts when a panel opens
    centreDelta: Math.round((p.left + p.width / 2) - (pageR.left + pageR.width / 2)),
    fromPageTop: Math.round(p.top - pageR.top),
    viewportH: window.innerHeight,
    text: pill.textContent,
  };
});
ok('the message rendered', placed.found === true, JSON.stringify(placed));
ok('…on the page, not in the corner', placed.corner === false, JSON.stringify(placed));
ok('…centred on the page itself', Math.abs(placed.centreDelta) <= 2, JSON.stringify(placed));
ok('…near the top of it, not the bottom of the window',
  placed.fromPageTop < placed.viewportH / 2, JSON.stringify(placed));

/* The point is that the two channels agree. Fire a real save flash and check
   they land on the same vertical line, a hair apart — if one moves and the
   other does not, that is the drift this change exists to prevent. */
const both = await page.evaluate(async () => {
  const sf = await window.__scImport('/src/utils/saveFlash.ts');
  const t = await window.__scImport('/src/components/Toast.tsx');
  sf.flashSaved('Saved');
  t.showToast('Settings saved', 'success');
  await new Promise((r) => setTimeout(r, 400));
  const flash = document.querySelector('.fs-page-saved')?.getBoundingClientRect() ?? null;
  const pill = document.querySelector('.fs-toast')?.getBoundingClientRect() ?? null;
  if (!flash || !pill) return { both: false, flash: !!flash, pill: !!pill };
  return {
    both: true,
    centreDelta: Math.round((flash.left + flash.width / 2) - (pill.left + pill.width / 2)),
    gap: Math.round(pill.top - flash.top),
    overlap: pill.top < flash.bottom,
  };
});
ok('a save flash and a status message both showed', both.both === true, JSON.stringify(both));
ok('…on the same vertical line', both.both && Math.abs(both.centreDelta) <= 2, JSON.stringify(both));
ok('…stacked, not printed over each other', both.overlap === false, JSON.stringify(both));

/* And the fallback. No page to measure — a status pinned to a page that is not
   there would render off-screen, which is worse than the corner it came from. */
const noPage = await page.evaluate(async () => {
  const t = await window.__scImport('/src/components/Toast.tsx');
  const page = document.querySelector('.page');
  const parent = page.parentElement;
  parent.removeChild(page);                       // simulate a takeover
  t.showToast('Settings saved', 'success');
  await new Promise((r) => setTimeout(r, 400));
  const stack = document.querySelector('.fs-toast-stack');
  const r = stack?.getBoundingClientRect() ?? null;
  const res = {
    corner: !!stack?.classList.contains('fs-toast-stack--corner'),
    onScreen: !!r && r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0,
  };
  parent.appendChild(page);
  return res;
});
ok('with no page it falls back to the corner', noPage.corner === true, JSON.stringify(noPage));
ok('…and is still on screen', noPage.onScreen === true, JSON.stringify(noPage));

console.log('\nB–F. the rest of the queue');

const prefs = src('components/PreferencesDialog.tsx');
ok('the folder setting no longer claims scripts are "downloaded"',
  !/Save downloaded scripts to/.test(prefs), '');
ok('…it says what it actually seeds', /Save and Export open in/.test(prefs), '');
ok('…and the stored key keeps its old name (renaming it would reset his path)',
  /downloadFolder/.test(src('stores/settingsStore.ts')), '');

const tpl = src('stores/formattingTemplateStore.ts');
ok('CUT TO BLACK takes a period', /'CUT TO BLACK\.'/.test(tpl), '');
ok('…and the colon form is gone', !/'CUT TO BLACK:'/.test(tpl), '');

ok('the suggestion table says Character Name',
  /character: 'Character Name'/.test(src('components/SuggestionRulesEditor.tsx')), '');

const ctx = src('components/ScriptContextMenu.tsx');
for (const [id, label] of [['insertSection', 'Insert Section'], ['insertMarker', 'Insert Marker'],
  ['insertChecklist', 'Add To-Do List'], ['addScriptNote', 'Add Note'],
  ['revisionMode', 'Revision Mode'], ['revisionColor', 'Revision Color'], ['tagAs', 'Tag as…']]) {
  ok(`${label} is gone from the context menu`, !new RegExp(`id: '${id}'`).test(ctx), '');
}
ok('Dual Dialogue was added', /id: 'dualDialogue'/.test(ctx), '');
ok('Insert Image was added', /id: 'insertImage'/.test(ctx), '');
// they run the SAME command the toolbar button does — not a second copy
ok('…both through the toolbar command bus',
  (ctx.match(/scriptcraft:command/g) || []).length >= 2, '');
ok('Add Annotation was already there (he expected it missing)', /id: 'markupScript'/.test(ctx), '');

/* Removed from the registry means removed from BOTH surfaces — the menu and
   Customize read the same list, which is why one deletion is enough. */
const listed = await page.evaluate(async () => {
  const m = await window.__scImport('/src/components/ScriptContextMenu.tsx');
  return m.CONTEXT_MENU_SECTIONS.map((x) => x.id);
});
ok('the live registry dropped all seven',
  !['insertSection', 'insertMarker', 'insertChecklist', 'addScriptNote',
    'revisionMode', 'revisionColor', 'tagAs'].some((id) => listed.includes(id)), JSON.stringify(listed));
ok('…and kept the ones he uses', ['element', 'markupScript', 'thesaurus', 'spelling']
  .every((id) => listed.includes(id)), JSON.stringify(listed));

const css = src('styles/screenplay/22-tools-extra.css');
ok('the feedback thank-you drops half an inch further',
  /\.fb-sent-msg[^}]*margin-top: calc\(var\(--dz-fb-sent-top, 32%\) \+ 48px\)/.test(css), '');

console.log(`\ncheck-v735: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
