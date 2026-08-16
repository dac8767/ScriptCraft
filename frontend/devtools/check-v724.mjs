/* check-v724 — Derek's three, filed against v7.23.
 *
 *   1 the title page's date still ignores Settings ▸ Dates & Times
 *   2 Feedback: no attachment icon, the label reads "Add a Screenshot:"
 *   3 a window opening while Settings is open closes Settings
 *
 * On (1): v7.11 taught the title-page BUILDERS to format the date and this
 * came back anyway, because the draft line lives in the document as TEXT.
 * Once a page was built with an ISO date nothing re-rendered it — Set Draft
 * copied the old suffix verbatim, and the importers pass no format at all.
 * So the assertion that matters is not "the builder formats it" (v7.11
 * already proved that) but "a page ALREADY carrying an ISO date catches up
 * when the setting changes", which is what Derek was looking at.
 *
 * On (3): the reason nothing could close Settings was that its open state was
 * TWO things — a local prefsOpen in MenuBar OR'd with the store's request bus.
 * Clearing the bus left the local flag holding the window open, so any fix
 * that did not collapse them first would have been a silent no-op.
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
await settle(page);

/** A title page as the builders leave it: structured data on the title node,
 *  the draft line as rendered TEXT — built with an ISO date, Derek's case. */
const seedTitlePage = async (label = 'First Draft') => page.evaluate((lbl) => {
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: [
      {
        type: 'titlePage',
        attrs: { field: 'title', tpTitle: 'EPISODE X', tpDraft: lbl, tpDraftDate: '2026-07-17' },
        content: [{ type: 'text', text: 'EPISODE X' }],
      },
      { type: 'titlePage', attrs: { field: 'draft' }, content: [{ type: 'text', text: `${lbl} - 2026-07-17` }] },
      { type: 'action', content: [{ type: 'text', text: 'A line so the doc is not just a title page.' }] },
    ],
  }, true);
}, label);

const draftLine = () => page.evaluate(() => {
  let out = null;
  window.__scEditor.state.doc.descendants((n) => {
    if (n.type.name === 'titlePage' && n.attrs.field === 'draft') { out = n.textContent; return false; }
    return true;
  });
  return out;
});

const setDateFormat = async (id) => {
  await page.evaluate(async (fmt) => {
    const m = await window.__scImport('/src/stores/settingsStore.ts');
    m.useSettingsStore.getState().setDateFormat(fmt);
  }, id);
  await settle(page);
};

console.log('\n1. the title page follows Settings ▸ Dates & Times');
await setDateFormat('iso');
await seedTitlePage();
await settle(page);
ok('an ISO setting leaves an ISO page alone', (await draftLine()) === 'First Draft - 2026-07-17', String(await draftLine()));

/* THE BUG. The page is already built and sitting there; Derek changes the
   setting. Before v7.24 the line kept the format it was built with forever. */
await setDateFormat('local');
ok('changing the setting re-renders the date on the page already open',
  (await draftLine()) === 'First Draft - 7/17/2026', String(await draftLine()));
await setDateFormat('european');
ok('…and again, in the next format', (await draftLine()) === 'First Draft - 17/7/2026', String(await draftLine()));

/* The other half: a page LOADED while the setting is already set. This is the
   importers' case — they pass no format, so the catch-up has to happen on the
   load itself, which is the one choke point every open/import path goes
   through (setContent always stamps preventUpdate). */
await setDateFormat('local');
await seedTitlePage('Shooting Draft');
await settle(page);
ok('a page LOADED carrying an ISO date catches up too (the importers\' case)',
  (await draftLine()) === 'Shooting Draft - 7/17/2026', String(await draftLine()));

/* And it must not read as an edit — a script that marks itself dirty the
   moment it opens is a worse bug than the date format it corrects. */
const meta = await page.evaluate(async () => {
  const seen = [];
  const onTx = ({ transaction }) => {
    if (transaction.docChanged) {
      seen.push({
        display: transaction.getMeta('tpDisplayRefresh') ?? null,
        history: transaction.getMeta('addToHistory') ?? null,
      });
    }
  };
  window.__scEditor.on('transaction', onTx);
  const m = await window.__scImport('/src/stores/settingsStore.ts');
  m.useSettingsStore.getState().setDateFormat('friendly');
  await new Promise((r) => setTimeout(r, 400));
  window.__scEditor.off('transaction', onTx);
  return seen;
});
ok('the catch-up is stamped a display refresh, and kept out of undo',
  meta.some((t) => t.display === true && t.history === false), JSON.stringify(meta));
const edSrc = readFileSync(new URL('../src/components/ScreenplayEditor.tsx', import.meta.url), 'utf8');
ok('…and the unsaved-changes tracker reads that stamp',
  /markUnsaved = \(\{ transaction \}[\s\S]{0,400}getMeta\(DISPLAY_REFRESH_META\)\) return;/.test(edSrc), '');

/* Set Draft was the OTHER way an ISO date survived: it copied the old date
   suffix verbatim onto the new label. */
const afterSetDraft = await page.evaluate(async () => {
  const [dlg, settings] = await Promise.all([
    window.__scImport('/src/components/SetDraftDialog.tsx'),
    window.__scImport('/src/stores/settingsStore.ts'),
  ]);
  settings.useSettingsStore.getState().setDateFormat('local');
  dlg.applyDraftNumber(window.__scEditor, 'Second Draft', { toast: false });
  await new Promise((r) => setTimeout(r, 200));
  let out = null, structured = null;
  window.__scEditor.state.doc.descendants((n) => {
    if (n.type.name !== 'titlePage') return true;
    if (n.attrs.field === 'draft') out = n.textContent;
    if (n.attrs.field === 'title') structured = n.attrs.tpDraft;
    return true;
  });
  return { out, structured };
});
ok('Set Draft re-renders the date instead of carrying the old one forward',
  afterSetDraft.out === 'Second Draft - 7/17/2026', JSON.stringify(afterSetDraft));
ok('…and writes the new label into the structured field, so a refresh keeps it',
  afterSetDraft.structured === 'Second Draft', JSON.stringify(afterSetDraft));

const draftSrc = readFileSync(new URL('../src/components/SetDraftDialog.tsx', import.meta.url), 'utf8');
ok('Set Draft no longer parses the line back out of its own rendering',
  !/dateMatch/.test(draftSrc) && /writeTitlePageDraftLine\(/.test(draftSrc), '');
const layoutSrc = readFileSync(new URL('../src/utils/titlePageDraftLine.ts', import.meta.url), 'utf8');
ok('the "Label - Date" join is the builders\' join, not a second copy',
  /deriveTitleFields\(/.test(layoutSrc) && !/join\(' - '\)/.test(layoutSrc), '');

console.log('\n2. the Feedback window');
const fb = await page.evaluate(async () => {
  /* The form is gated behind the once-only tester profile — without it the
     tool renders the name/email card and every assertion below would pass
     against nothing. */
  localStorage.setItem('opendraft:feedbackProfile', JSON.stringify({ name: 'Tester T', email: 't@example.com' }));
  window.__scStore.getState().openTool('feedback');
  await new Promise((r) => setTimeout(r, 700));
  const head = document.querySelector('.fb-attach-head');
  return {
    found: Boolean(head),
    title: head?.querySelector('.fb-attach-title')?.textContent ?? null,
    // the head's OWN icon — the button icons live inside .fb-attach-btns
    ownIcons: [...(head?.children ?? [])].filter((c) => c.tagName.toLowerCase() === 'svg').length,
    buttons: [...(head?.querySelectorAll('.fb-attach-btns button') ?? [])].map((b) => b.textContent.trim()),
  };
});
ok('the attach area is on screen at all', fb.found === true, JSON.stringify(fb));
ok('the label reads "Add a Screenshot:"', fb.title === 'Add a Screenshot:', String(fb.title));
ok('the attachment icon is gone', fb.found && fb.ownIcons === 0, JSON.stringify(fb));
ok('…and the three buttons are untouched',
  JSON.stringify(fb.buttons) === JSON.stringify(['Full Screen', 'Area', 'Browse…']), JSON.stringify(fb.buttons));
const css = readFileSync(new URL('../src/styles/screenplay/22-tools-extra.css', import.meta.url), 'utf8');
ok('the paperclip\'s 6px indent went with it, so v7.14\'s alignment holds',
  /\.fb-attach-title \{ margin-left: 0; \}/.test(css), '');

console.log('\n3. Settings yields to a window opening over it');
/* USAGE, not the word — the file keeps a comment explaining what went and
   why, and a check that forbids naming a thing forbids documenting it. */
const menuSrc = readFileSync(new URL('../src/components/MenuBar.tsx', import.meta.url), 'utf8');
ok('the window\'s open state is ONE thing — the local prefsOpen is gone',
  !/setPrefsOpen\(|\[prefsOpen,/.test(menuSrc) && /open=\{preferencesRequest\.open\}/.test(menuSrc), '');
const setSrc = readFileSync(new URL('../src/stores/settingsStore.ts', import.meta.url), 'utf8');
ok('…and the third copy (settingsStore.settingsOpen, read by nothing) too',
  !/setSettingsOpen/.test(setSrc), '');

const openSettings = async () => page.evaluate(async () => {
  window.__scStore.getState().openPreferences();
  await new Promise((r) => setTimeout(r, 350));
  return Boolean(document.querySelector('.prefs-window'));
});
const settingsUp = () => page.evaluate(() => Boolean(document.querySelector('.prefs-window')));

ok('Settings opens', await openSettings(), '');
const floated = await page.evaluate(async () => {
  const s = window.__scStore.getState();
  // a tool REMOVED from the sidebar floats a window — the shape that matters
  s.setToolConfig({ ...s.toolConfig, goals: { side: 'right', enabled: false } });
  s.openTool('goals');
  await new Promise((r) => setTimeout(r, 350));
  return window.__scStore.getState().tempTool;
});
ok('…a tool window really was born', floated === 'goals', String(floated));
ok('a tool window opening closes it', !(await settingsUp()), '');

await page.evaluate(() => window.__scStore.getState().setTempTool(null));
ok('Settings reopens', await openSettings(), '');
await page.evaluate(async () => {
  window.__scStore.getState().setToolMode('design', 'floating');
  window.__scStore.getState().openTool('design');
  await new Promise((r) => setTimeout(r, 350));
});
ok('…but Design does not — the tool you keep up WHILE working elsewhere',
  await settingsUp(), '');

await page.evaluate(async () => {
  window.__scStore.getState().setTempTool(null);
  window.__scStore.getState().setActiveTool(null);
  window.__scStore.getState().setActiveToolRight(null);
  await new Promise((r) => setTimeout(r, 200));
});
ok('Settings reopens again', await openSettings(), '');
/* Open Recent HAND-ROLLS its overlay — it is one of the fourteen dialogs that
   never adopted the Modal shell. Picked deliberately: a rule living inside
   Modal would have covered two thirds of the app's dialogs and looked like it
   covered all of them. */
const openFileSrc = readFileSync(new URL('../src/components/OpenFile.tsx', import.meta.url), 'utf8');
ok('the dialog under test is one Modal does NOT wrap',
  !/<Modal/.test(openFileSrc) && /className="dialog-overlay"/.test(openFileSrc), '');
const dialogClosed = await page.evaluate(async () => {
  window.__scStore.getState().setOpenFileOpen(true);
  await new Promise((r) => setTimeout(r, 400));
  const up = Boolean(document.querySelector('.open-from-project-dialog'));
  const prefs = Boolean(document.querySelector('.prefs-window'));
  window.__scStore.getState().setOpenFileOpen(false);
  return { up, prefs };
});
ok('a dialog opening closes it', dialogClosed.up && !dialogClosed.prefs, JSON.stringify(dialogClosed));
const prefsSrc = readFileSync(new URL('../src/components/PreferencesDialog.tsx', import.meta.url), 'utf8');
ok('…watched at the overlay, so every dialog is covered, not just Modal\'s',
  /classList\.contains\('dialog-overlay'\)[\s\S]{0,400}new MutationObserver/.test(prefsSrc), '');
const modalSrc = readFileSync(new URL('../src/components/Modal.tsx', import.meta.url), 'utf8');
ok('…and the Modal shell carries no second copy of the rule',
  !/closePreferences/.test(modalSrc), '');
/* A confirm renders .fs-confirm-overlay, a different class — so a confirm
   raised BY Settings cannot pull the window out from under its own question. */
const confirmSrc = readFileSync(new URL('../src/components/ConfirmDialog.tsx', import.meta.url), 'utf8');
ok('a confirm is exempt: it is not a .dialog-overlay',
  /fs-confirm-overlay/.test(confirmSrc) && !/className="dialog-overlay"/.test(confirmSrc), '');
const confirmKept = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences();
  await new Promise((r) => setTimeout(r, 350));
  const m = await window.__scImport('/src/components/ConfirmDialog.tsx');
  const answer = m.confirmDialog('Reset everything?');
  await new Promise((r) => setTimeout(r, 400));
  const out = {
    confirmUp: Boolean(document.querySelector('.fs-confirm-overlay')),
    prefs: Boolean(document.querySelector('.prefs-window')),
  };
  document.querySelector('.fs-confirm-cancel')?.click();
  await answer;
  return out;
});
ok('…and Settings really does survive one', confirmKept.confirmUp && confirmKept.prefs, JSON.stringify(confirmKept));

console.log(`\ncheck-v724: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
