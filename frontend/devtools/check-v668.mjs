/* check-v668 — Derek: "the current button 'annotation visibility' should be
   called 'Annotation Filter'. Make a new button that is called 'View
   Annotations'. This is a simple on or off toggle, like the toggle for the
   side panels, and the ribbon toolbar."

   1 both buttons render on the ribbon, side by side
   2 the old one is called Annotation Filter and still opens the filter menu
   3 View Annotations is a plain toggle — one click hides, one click shows
   4 it actually hides the annotation icons on the script (not just the tint)
   5 its icon and lit state carry which way it is set
   6 it is the SAME state as View ▸ Annotations ▸ Show Annotations in Script
   7 Customize's palette lists both, under their new names */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

/* Address the buttons by their BUILTIN KEY, not by title: HoverTooltip
   moves `title` into data-tip-stash while the pointer is over a button (it
   suppresses the native tooltip), so a title selector goes blind exactly
   when the check is clicking. The first draft of this check chased that for
   an hour. `tipOf` reads whichever attribute currently holds the text. */
const VIEW = '.toolbar [data-key="viewAnnotations"] button';
const FILTER = '.toolbar [data-key="annotationsMenu"] button';
const tipOf = (el) => el.getAttribute('title') ?? el.getAttribute('data-tip-stash');
const state = async () => {
  const st = await page.evaluate((v) => {
    const btn = document.querySelector(v);
    return {
      found: !!btn,
      visible: window.__scStore.getState().markupsVisible,
      lit: btn ? btn.classList.contains('active') : null,
      title: btn ? (btn.getAttribute('title') ?? btn.getAttribute('data-tip-stash')) : null,
      icons: document.querySelectorAll('.markup-margin-icon').length,
    };
  }, VIEW);
  // a missing button must FAIL, not read as "not lit" — the first draft of
  // this check passed "the button goes unlit" on a null
  if (!st.found) throw new Error('the View Annotations button vanished from the ribbon');
  return st;
};

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  // put both buttons on the ribbon the way Customize would
  await page.evaluate(() => {
    const s = window.__scStore.getState();
    s.setToolbarZones(
      [...s.toolbarLeft.filter((t) => t !== 'b:viewAnnotations' && t !== 'b:annotationsMenu'),
        'b:viewAnnotations', 'b:annotationsMenu'],
      s.toolbarRight,
    );
  });
  await settle(page);
  // one annotation, so there is something to show and hide
  await page.evaluate(() => {
    const st = window.__scStore.getState();
    const ed = window.__scEditor;
    st.setMarkups([]);
    let at = null;
    ed.state.doc.forEach((n, pos) => { if (at === null && n.type.name === 'action') at = pos; });
    const node = ed.state.doc.nodeAt(at);
    ed.view.dispatch(ed.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, markupId: 'vis-probe' }));
    st.addMarkup({
      id: 'vis-probe', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'probe' }] }] },
      icon: 'flag', color: '#e05555', highlight: null, anchor: 'point', done: false, createdAt: new Date().toISOString(),
    });
    st.setMarkupsVisible(true);
  });
  await page.waitForSelector('.markup-margin-icon', { timeout: 5000 });
  await settle(page);

  /* ── 1–2: both buttons, renamed ── */
  ok(await page.locator(VIEW).count() === 1, 'the View Annotations toggle is on the ribbon');
  const filterName = await page.evaluate((f) => {
    const el = document.querySelector(f);
    return el ? (el.getAttribute('title') ?? el.getAttribute('data-tip-stash')) : null;
  }, FILTER);
  ok(filterName === 'Annotation Filter', `and the old button is now called Annotation Filter ("${filterName}")`);
  const oldName = await page.evaluate(() =>
    document.querySelectorAll('[title="Annotation Visibility"], [data-tip-stash="Annotation Visibility"]').length);
  ok(oldName === 0, `nothing is called "Annotation Visibility" any more (${oldName} found)`);
  await page.click(FILTER);
  await settle(page);
  const menuUp = await page.locator('.markup-filter-pop').count();
  ok(menuUp === 1, `the filter still opens its type/status popover (${menuUp})`);
  await page.click('.toolbar');                       // dismiss it
  await settle(page);

  /* ── 3–5: the toggle ── */
  const on = await state();
  ok(on.visible && on.lit, `it starts lit while annotations show (visible ${on.visible}, lit ${on.lit})`);
  ok(on.icons > 0, `the annotation icon is on the script (${on.icons})`);
  await page.click(VIEW);
  await settle(page);
  const off = await state();
  ok(!off.visible, 'one click turns annotations off');
  ok(off.icons === 0, `and the icon really leaves the script (${off.icons})`);
  ok(!off.lit, 'the button goes unlit');
  ok(/Show annotations/i.test(off.title), `and offers to bring them back ("${off.title}")`);
  await page.click(VIEW);
  await settle(page);
  const back = await state();
  ok(back.visible && back.icons > 0 && back.lit, `a second click turns them back on (${back.icons} icon)`);

  /* ── 6: one state, two doors ── */
  await page.evaluate(() => window.__scStore.getState().setMarkupsVisible(false));
  await settle(page);
  const viaMenu = await state();
  ok(!viaMenu.lit && viaMenu.icons === 0,
    'setting it from the View menu leaves the button in the same state — one source, two doors');
  await page.evaluate(() => window.__scStore.getState().setMarkupsVisible(true));
  await settle(page);

  /* ── 7: the palette (the registry the ribbon and Customize share) ── */
  await page.evaluate(() => window.__scStore.getState().openPreferences('cz-toolbar'));
  await page.waitForSelector('.fs-prefs-body, .cz-toolbar, .dialog-body', { timeout: 8000 });
  await settle(page);
  const listed = await page.evaluate(() => {
    const txt = document.body.innerText;
    return { view: txt.includes('View Annotations'), filter: txt.includes('Annotation Filter'), old: txt.includes('Annotation Visibility') };
  });
  ok(listed.view && listed.filter, `Customize lists both buttons (View Annotations ${listed.view}, Annotation Filter ${listed.filter})`);
  ok(!listed.old, 'and no longer offers "Annotation Visibility"');

} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v668: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
