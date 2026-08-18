/* check-v757 — three reports from the feedback queue.
 *
 *   1. "everytime there is a shown/ hidden section, make the ADD buttons appear
 *       in the Shown column header. the button should read '+Add', and can have
 *       these options when applicable: Divider, Spacer. Move '+ New Theme' to
 *       the header of the themes Shown column header. move 'Add Transition' to
 *       the header of the Shown column in the editor tab. change the name to
 *       '+ New Transition'"
 *   2. "make the[m] sit on the same row"  (Continued Text / More Text)
 *   3. "The scrapbook side panel window is showing twice. it looked this way as
 *       soon as I opened the tool from the ribbon toolbar"
 *
 * ── 3 is the real bug, and it was a rule that had only ever been half applied.
 *
 * v4.37 wrote down the invariant — "a tool lives in exactly ONE place" — and
 * then enforced it against ONE of the four places a tool can be: the fullscreen
 * takeover. The left panel slot, the right panel slot and the floating temp
 * slot were never checked against each other. So a tool could hold two at once,
 * and since each surface renders whatever ITS slot holds, two of them drew the
 * same tool side by side.
 *
 * The path Derek hit is the one that needs no unusual state at all. Opening the
 * Scrapbook while its tool is not seated in a panel floats it as a temp window;
 * NotebookSurface then auto-docks its navigator (the v5.50 behaviour) by
 * calling setActiveTool — which seated it in the panel WITHOUT the float ever
 * being told to let go. Panel and float both drew it. One gesture, two windows.
 *
 * WHY THIS IS DRIVEN AND NOT ASSERTED FROM THE SOURCE. The setters look
 * perfectly correct in isolation; the bug is what happens when two of them run
 * in sequence from two different components. Nothing short of driving the real
 * sequence and COUNTING WHAT IS ON SCREEN would have caught it — a source
 * regex, a type, and a unit test on either setter alone all pass against the
 * broken code. So the assertions below count rendered navigators, and check
 * the store's four slots as a SET rather than one at a time.
 *
 * ── 1 and 2 are arrangement, which is exactly what type-checking cannot see.
 * A button keeps its class, its label and its handler while sitting in the
 * wrong container, so these are measured by position too: which element the
 * adder is INSIDE, and whether the two pickers share a top.
 *
 * The negative halves matter more than the positive ones here. "The adder is in
 * the header" passes just as well when a second copy is still sitting in the
 * bar below — which is the drift this repo's one-source rule exists to stop,
 * and which a screenshot of either half would not reveal.
 */
import { readFileSync } from 'node:fs';
import { launch, boot } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

/* ── 3. the Scrapbook, twice ─────────────────────────────────────────────── */
console.log('\nthe Scrapbook opens once, however you open it');

/** Where the store thinks `tool` is, and how many of it are on screen. */
const whereIs = (tool) => page.evaluate((t) => {
  const s = window.__scStore.getState();
  const slots = [];
  if (s.activeTool === t) slots.push('left');
  if (s.activeToolRight === t) slots.push('right');
  if (s.tempTool === t) slots.push('float');
  if (s.fullscreenTool === t) slots.push('fullscreen');
  return { slots, trees: document.querySelectorAll('.fs-nb-tree').length };
}, tool);

/* THE reported gesture. The tool is not seated in a panel, so opening it floats
   it — and the float's own auto-dock then seats it. Two slots, on the old code,
   from one click. */
const ribbon = await page.evaluate(async () => {
  const st = () => window.__scStore.getState();
  const cfg = st().toolConfig;
  st().setToolConfig({ ...cfg, notebook: { ...cfg.notebook, enabled: false } });
  await new Promise((r) => setTimeout(r, 400));
  st().openTool('notebook');
  await new Promise((r) => setTimeout(r, 1800));
});
const afterRibbon = await whereIs('notebook');
ok('opening it from the ribbon puts it in exactly one place',
  afterRibbon.slots.length === 1, JSON.stringify(afterRibbon));
/* The assertion that would have caught Derek's screenshot. Slots are the cause;
   this is the symptom he actually saw. */
ok('…and exactly one of it is drawn',
  afterRibbon.trees === 1, JSON.stringify(afterRibbon));

/* The same rule from the other direction: moving the tool from one panel to the
   other, the whole gesture as a writer performs it. The CONFIG side moves with
   it — a panel only lists the tools configured to its own side, so seating a
   right-configured tool in the left slot is a state the UI cannot produce, and
   a probe that did only that would be measuring nothing real. */
const moveTo = (side) => page.evaluate(async (s) => {
  const st = () => window.__scStore.getState();
  const cfg = st().toolConfig;
  st().setToolConfig({ ...cfg, notebook: { ...cfg.notebook, enabled: true, side: s } });
  await new Promise((r) => setTimeout(r, 300));
  if (s === 'left') st().setActiveTool('notebook'); else st().setActiveToolRight('notebook');
  await new Promise((r) => setTimeout(r, 700));
}, side);

await moveTo('right');
await moveTo('left');
const afterMove = await whereIs('notebook');
ok('moving it to the left panel vacates the right', afterMove.slots.join() === 'left',
  JSON.stringify(afterMove));
/* And it must not have gone the other way. A setter that vacated everything
   INCLUDING its own target would satisfy "exactly one place" by holding none —
   the tool would simply refuse to open, and every slot assertion here would
   still pass. Counting what is DRAWN is what separates one from zero. */
ok('…and one is still drawn there, not vacated into nothing',
  afterMove.trees === 1, JSON.stringify(afterMove));

await moveTo('right');
const afterBack = await whereIs('notebook');
ok('…and moving it back to the right vacates the left', afterBack.slots.join() === 'right',
  JSON.stringify(afterBack));
ok('…still exactly one drawn', afterBack.trees === 1, JSON.stringify(afterBack));

/* The third way in, and the one the two setters above do NOT cover: openTool's
   docked branch returns a state patch of its own rather than calling either
   setter, so the rule has to be spelled out there too or it simply does not
   apply on that path.
 *
 * The gesture that reaches it is ordinary. A tool is open on the right; the
 * writer moves it to the left panel in Customize — which changes the config
 * and leaves the right slot still pointing at it — and then clicks it in the
 * ribbon. openTool reads the new config, seats it on the left, and the right
 * slot is never told. Both panels draw it. */
const reseated = await page.evaluate(async () => {
  const st = () => window.__scStore.getState();
  const cfg = st().toolConfig;
  st().setToolConfig({ ...cfg, notebook: { ...cfg.notebook, enabled: true, side: 'right' } });
  await new Promise((r) => setTimeout(r, 250));
  st().openTool('notebook');                       // open on the right
  await new Promise((r) => setTimeout(r, 700));
  const before = st().activeToolRight;
  const c2 = st().toolConfig;                      // move it in Customize…
  st().setToolConfig({ ...c2, notebook: { ...c2.notebook, side: 'left' } });
  await new Promise((r) => setTimeout(r, 400));
  st().openTool('notebook');                       // …and click it in the ribbon
  await new Promise((r) => setTimeout(r, 800));
  return { before, ...(await (async () => {
    const s = st();
    return { L: s.activeTool, R: s.activeToolRight, trees: document.querySelectorAll('.fs-nb-tree').length };
  })()) };
});
ok('the probe really did open it on the right first',
  reseated.before === 'notebook', JSON.stringify(reseated));
ok('…and re-opening it after its panel moved leaves only the new slot',
  reseated.L === 'notebook' && reseated.R === null, JSON.stringify(reseated));
ok('…with one of it drawn, not two', reseated.trees === 1, JSON.stringify(reseated));

/* The invariant is a RULE, not a special case for one tool. Check a second one
   so a fix hard-coded to 'notebook' fails here. */
const other = await page.evaluate(async () => {
  const st = () => window.__scStore.getState();
  st().setActiveToolRight('scenes');
  await new Promise((r) => setTimeout(r, 250));
  st().setActiveTool('scenes');
  await new Promise((r) => setTimeout(r, 400));
  const s = st();
  return { L: s.activeTool, R: s.activeToolRight };
});
ok('the rule holds for every tool, not just the Scrapbook',
  other.L === 'scenes' && other.R === null, JSON.stringify(other));

/* v6.52: the temp slot may legitimately carry a DIFFERENT float-exempt tool
   while a panel holds something else. Only the SAME tool gets evicted — a fix
   that blanket-cleared tempTool would silently close Helper Text every time a
   panel tool opened, which is the exact regression v6.52 was written to stop.
   `helpertext` is the id, lower-case: FLOAT_EXEMPT lists it that way, and a
   camel-cased guess opens nothing and floats nothing, which would make this
   assertion pass against anything. */
const exempt = await page.evaluate(async () => {
  const st = () => window.__scStore.getState();
  st().openTool('helpertext');
  await new Promise((r) => setTimeout(r, 600));
  const floating = st().tempTool;
  st().setActiveTool('scenes');
  await new Promise((r) => setTimeout(r, 400));
  return { floating, stillFloating: st().tempTool, left: st().activeTool };
});
/* Asserted with no escape hatch. "It wasn't floating, so nothing was lost" is
   how this check silently stops testing anything. */
ok('the probe really did float a second tool', exempt.floating === 'helpertext',
  JSON.stringify(exempt));
ok('…and seating an unrelated tool in a panel leaves it alone',
  exempt.stillFloating === 'helpertext' && exempt.left === 'scenes',
  JSON.stringify(exempt));

/* ── 2. the two continuation pickers ─────────────────────────────────────── */
console.log('\nContinued Text and More Text sit on one row');
const mores = await page.evaluate(async () => {
  window.__scStore.getState().openPreferences('cz-elements');
  await new Promise((r) => setTimeout(r, 1400));
  const fields = [...document.querySelectorAll('.prefs-content .fs-mores-field')];
  if (fields.length < 2) return { skipped: `found ${fields.length} continuation fields` };
  const box = (e) => e.getBoundingClientRect();
  const row = fields[0].parentElement;
  return {
    sameRow: Math.abs(Math.round(box(fields[0]).top) - Math.round(box(fields[1]).top)) <= 2,
    sideBySide: Math.round(box(fields[0]).right) <= Math.round(box(fields[1]).left),
    sharedParent: fields[0].parentElement === fields[1].parentElement,
    rowClass: row.className,
    /* Each picker must still FIT its longest option. Sizing a control to the
       value that happens to be selected fits that one and clips the rest, so
       measure the select against the widest <option> it offers. */
    fits: fields.map((f) => {
      const sel = f.querySelector('select');
      if (!sel) return null;
      const probe = document.createElement('span');
      const cs = getComputedStyle(sel);
      probe.style.cssText = `position:fixed;left:-9999px;white-space:pre;font:${cs.font}`;
      document.body.appendChild(probe);
      let widest = 0;
      for (const o of sel.options) { probe.textContent = o.textContent; widest = Math.max(widest, probe.offsetWidth); }
      probe.remove();
      // + the chevron and the field's own horizontal padding
      const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 18;
      return { label: f.querySelector('.props-label')?.textContent, w: Math.round(sel.offsetWidth), need: Math.ceil(widest + chrome) };
    }),
    /* v7.55's cap must still hold — this is the complaint that produced it.
       Measured as SLACK (the field's width minus the control inside it), not
       as a share of the panel: the share threshold is exactly what let a 304px
       Export Themes… through in v7.53 and cost Derek a second report. A field
       is too wide when there is dead space beside its own control, whatever
       fraction of the window that happens to be. */
    slack: fields.map((f) => Math.round(box(f).width - (f.querySelector('select')?.offsetWidth ?? 0))),
    widths: fields.map((f) => Math.round(box(f).width)),
    panelW: Math.round(document.querySelector('.prefs-content').getBoundingClientRect().width),
  };
});
if (mores.skipped) {
  console.log(`  SKIP — ${mores.skipped}`);
} else {
  ok('the two pickers share a top', mores.sameRow === true, JSON.stringify(mores));
  ok('…one genuinely beside the other, not overlapping',
    mores.sideBySide === true, JSON.stringify(mores));
  ok('…in one row container rather than two stacked blocks',
    mores.sharedParent === true && /fs-mores-row/.test(mores.rowClass), JSON.stringify(mores.rowClass));
  ok('each still fits its longest option',
    mores.fits.every((f) => f && f.w >= f.need), JSON.stringify(mores.fits));
  /* Two on a row must not undo v7.55 by letting each stretch to half the
     panel. A field wider than its own control is the "marooned label" shape. */
  ok('…and neither stretched, leaving dead space beside its picker',
    mores.slack.every((s) => s <= 8), JSON.stringify(mores));
}

/* ── 1. adders live on the list they add to ──────────────────────────────── */
console.log('\nevery Shown column header carries its own adder');

/** For one Customize tab: what each column header holds, and what the tab's
 *  action bar holds. */
const tabAdders = (cat) => page.evaluate(async (c) => {
  window.__scStore.getState().openPreferences(`cz-${c}`);
  await new Promise((r) => setTimeout(r, 1100));
  const content = document.querySelector('.prefs-content');
  if (!content) return { skipped: `no content for ${c}` };
  const cols = [...content.querySelectorAll('.fs-dnd-col')].map((col) => ({
    title: col.querySelector('.fs-dnd-col-head')?.firstChild?.textContent?.trim() ?? '',
    hidden: col.classList.contains('fs-dnd-hiddencol'),
    head: [...col.querySelectorAll('.fs-dnd-col-head button')].map((b) => b.textContent.trim()),
  }));
  return {
    cols,
    bar: [...content.querySelectorAll('.fs-tabbar button')].map((b) => b.textContent.trim()),
  };
}, cat);

/* Derek named the shape: "everytime there is a shown/hidden section". These are
   the tabs that have one AND have something to add. */
const EXPECT = {
  panels: { headers: { 'Left Panel': '+ Add', 'Right Panel': '+ Add' } },
  qat: { headers: { Shown: '+ Add' } },
  themes: { headers: { Shown: '+ New Theme' } },
  elements: { headers: { Shown: '+ New Transition' } },
};
for (const [cat, want] of Object.entries(EXPECT)) {
  const got = await tabAdders(cat);
  if (got.skipped) { console.log(`  SKIP ${cat} — ${got.skipped}`); continue; }
  for (const [title, label] of Object.entries(want.headers)) {
    const col = got.cols.find((c) => c.title === title);
    ok(`${cat}: “${label}” is in the ${title} column header`,
      Boolean(col) && col.head.includes(label), JSON.stringify(got.cols));
  }
  /* THE NEGATIVE HALF. An adder that moved but left a copy behind is two
     sources for one action, and the tab would look correct in a screenshot of
     either end of it. Hide All / Show All are not adders — they act on the
     whole list — so the sweep is for the adding verbs only. */
  ok(`${cat}: no adder was left behind in the action bar`,
    !got.bar.some((l) => /^\+|^Add /.test(l)), JSON.stringify(got.bar));
  /* An adder in a HIDDEN column would be nonsense: you cannot add to the list
     of things you are not showing. */
  ok(`${cat}: the Hidden column has no adder`,
    got.cols.filter((c) => c.hidden).every((c) => !c.head.some((l) => /^\+|^Add /.test(l))),
    JSON.stringify(got.cols.filter((c) => c.hidden)));
}

/* The menu Derek specified, opened for real. A trigger that renders and opens
   nothing is the silent no-op this project treats as the cardinal sin.
 *
 * The trigger TOGGLES, so a menu one block left standing open is a menu the
 * next block's click closes — which reads exactly like a broken trigger. Every
 * interaction below dismisses whatever is open first.
 *
 * Dismiss with ESCAPE, not with a click on the body. AddMenu closes on
 * MOUSEDOWN outside, and `el.click()` dispatches a click with no mousedown
 * before it — so a synthetic body click leaves the menu standing while a real
 * user's click would have closed it. That cost a wrong answer here: with two
 * popups portalled to the body, querying `.fs-addmenu-pop` returned the older
 * one and the Left Panel's Divider appeared to be filed under the right.
 *
 * The popup count is asserted for the same reason. If two are ever open at
 * once, this must fail rather than quietly measure the wrong one. */
const openColumnMenu = (cat, title) => page.evaluate(async ([c, t]) => {
  window.__scStore.getState().openPreferences(`cz-${c}`);
  await new Promise((r) => setTimeout(r, 1100));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  const col = [...document.querySelectorAll('.fs-dnd-col')]
    .find((x) => x.querySelector('.fs-dnd-col-head')?.firstChild?.textContent?.trim() === t);
  const btn = [...(col?.querySelectorAll('.fs-dnd-col-head button') ?? [])]
    .find((b) => b.textContent.trim() === '+ Add');
  if (!btn) return { skipped: `no + Add in ${c}/${t}` };
  /* It must WEAR the header's own button class — a form-field-looking menu
     trigger beside a "Show All" reads as a mistake rather than a control. */
  const wearsHeaderClass = btn.classList.contains('fs-dnd-headbtn');
  btn.click();
  await new Promise((r) => setTimeout(r, 350));
  const pops = [...document.querySelectorAll('.fs-addmenu-pop')];
  return {
    wearsHeaderClass,
    opened: pops.length === 1,
    popCount: pops.length,
    items: [...(pops[0]?.querySelectorAll('button, [role="menuitem"]') ?? [])]
      .map((b) => b.textContent.trim()).filter(Boolean),
  };
}, [cat, title]);

console.log('\nthe + Add menus offer what he asked for');
for (const [cat, colTitle] of [['qat', 'Shown'], ['panels', 'Left Panel'], ['panels', 'Right Panel']]) {
  const menu = await openColumnMenu(cat, colTitle);
  if (menu.skipped) { console.log(`  SKIP ${cat}/${colTitle} — ${menu.skipped}`); continue; }
  ok(`${cat}/${colTitle}: the menu really opens, with Divider and Spacer`,
    menu.opened && menu.items.includes('Divider') && menu.items.includes('Spacer'),
    JSON.stringify(menu));
  ok(`${cat}/${colTitle}: …and only those two`, menu.items.length === 2, JSON.stringify(menu.items));
  ok(`${cat}/${colTitle}: …and the trigger is dressed as a header button`,
    menu.wearsHeaderClass === true, JSON.stringify(menu));
}

/* An adder in a COLUMN header has to add to THAT column. The panels adder used
   to hard-code side: 'left' — correct for the left header by accident and wrong
   for the right one, which is precisely the bug a shared helper invites if the
   column never tells it which list it is on. */
console.log('\nthe panel adders add to the panel they sit on');
for (const side of ['left', 'right']) {
  const title = side === 'left' ? 'Left Panel' : 'Right Panel';
  await page.evaluate(() => window.__scStore.getState().setPanelDividers([]));
  const menu = await openColumnMenu('panels', title);
  if (menu.skipped) { console.log(`  SKIP ${side} — ${menu.skipped}`); continue; }
  const added = await page.evaluate(async () => {
    const item = [...document.querySelectorAll('.fs-addmenu-pop button')]
      .find((b) => b.textContent.trim() === 'Divider');
    if (!item) return { skipped: 'the menu did not open' };
    item.click();
    await new Promise((r) => setTimeout(r, 500));
    return { sides: window.__scStore.getState().panelDividers.map((d) => d.side) };
  });
  if (added.skipped) { console.log(`  SKIP ${side} — ${added.skipped}`); continue; }
  ok(`the ${side} header's Divider goes to the ${side} panel`,
    added.sides.length === 1 && added.sides[0] === side, JSON.stringify(added));
}

/* ── the source side: one definition, no leftovers ───────────────────────── */
console.log('\none menu definition, and nothing left behind');
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const dlg = src('components/CustomizePanelsDialog.tsx');
ok('the header menus come from one helper, not a copy per column',
  /const columnAddMenu = \(/.test(dlg) && (dlg.match(/<AddMenu/g) || []).length === 1,
  `${(dlg.match(/<AddMenu/g) || []).length} AddMenu literals`);
/* Letting a caller dress the trigger must not have FORKED it — one trigger
   element whose class an option replaces, not a second branch rendering a
   header-flavoured button beside the original. */
const add = src('components/AddMenu.tsx');
ok('AddMenu still renders one trigger, dressed by its caller',
  (add.match(/className=\{triggerClass/g) || []).length === 1
  && !/triggerClass \? \(/.test(add), '');
/* The Themes tab's bar had one occupant, and it left. A bar with nothing in it
   is a rule and a gap. */
ok('the Themes tab stopped rendering an action bar it has nothing for',
  !/<TabActionBar/.test(src('components/ThemesTab.tsx')), '');
/* The prop that carried Export/Import went with them in v7.56. An unused prop
   is a second door standing open. */
ok('TabActionBar\'s retired presets slot is gone, not left empty',
  !/presets\?: React\.ReactNode/.test(src('components/customizeResets.tsx')), '');
/* Annotations is NOT an exception that was missed — it has no shown-against-
   hidden columns at all (it builds a combo from a grid), so its adder has no
   column header to move into and correctly stays in the bar. */
const markups = await tabAdders('markups');
ok('Annotations has no Shown column, so its adder rightly stays in the bar',
  markups.cols.length === 0 && markups.bar.some((l) => /^\+ Add Preset/.test(l)),
  JSON.stringify(markups));

/* The invariant, said once, where it is enforced. */
const store = src('stores/editorStore.ts');
for (const [setter, vacates] of [['setActiveTool', 'activeToolRight'], ['setActiveToolRight', 'activeTool']]) {
  const body = store.slice(store.indexOf(`${setter}: (tool) =>`), store.indexOf(`${setter}: (tool) =>`) + 1800);
  ok(`${setter} vacates ${vacates}, the temp slot and the takeover`,
    body.includes(`s.${vacates} === tool`) && body.includes('s.tempTool === tool')
      && body.includes('s.fullscreenTool === tool'), '');
}

console.log(`\ncheck-v757: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
