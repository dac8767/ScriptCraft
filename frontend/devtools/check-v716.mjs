/* check-v716 — the two formatting items Derek queued on 2026-08-13.

   1 The blank-line-before rule must NOT apply to the very first element on
     page 1. It was stated for scene headings only, so a script opening the
     normal way — FADE IN: — started a line down the page. The paginator, the
     PDF exporter and the Pages thumbnails have always agreed (isFirst ? 0);
     the editor is the renderer that disagreed.
   2 The ribbon EDITOR must render the same controls at the same size as the
     live bar. Measured, not eyeballed: same section boxes, same rows, same
     buttons, same x — the whole bar, in both modes.

   Plus the drift that turned up next door: the Pages tool kept PRIVATE copies
   of the shared geometry, under a comment claiming they matched. */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1600, height: 950 });
await boot(page);
await settle(page);

// ── 1: nothing sits below a blank on the first line of page 1 ────────
console.log('\n1. the first element on page 1');

const openWith = async (nodes) => {
  await page.evaluate((content) => {
    window.__scEditor.commands.setContent({ type: 'doc', content });
  }, nodes);
  await settle(page);
  return page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror');
    const first = pm.children[0];
    return {
      cls: first.className,
      marginTop: getComputedStyle(first).marginTop,
      // the real question: does the ink start at the top of the text column?
      offset: Math.round(first.getBoundingClientRect().top - pm.getBoundingClientRect().top),
    };
  });
};

const text = (t) => [{ type: 'text', text: t }];
const cases = [
  ['a scene heading', [{ type: 'sceneHeading', content: text('INT. KITCHEN - DAY') }]],
  ['FADE IN:', [{ type: 'transition', content: text('FADE IN:') }]],
  ['a transition', [{ type: 'transition', content: text('CUT TO:') }]],
  ['action', [{ type: 'action', content: text('She pours the coffee.') }]],
  ['a character cue', [{ type: 'character', content: text('MAYA') }]],
];
for (const [label, head] of cases) {
  const r = await openWith([...head, { type: 'action', content: text('Something happens.') }]);
  ok(`${label} opens the page with no blank above it`,
    r.marginTop === '0px' && r.offset === 0, JSON.stringify(r));
}

/* …and the rule is still THERE for everything that isn't first: FADE IN:
   above a heading must not flatten the heading's two blank lines. */
await page.evaluate(() => {
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: [
      { type: 'transition', content: [{ type: 'text', text: 'FADE IN:' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. KITCHEN - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'She pours the coffee.' }] },
    ],
  });
});
await settle(page);
const after = await page.evaluate(() => {
  const kids = [...document.querySelector('.ProseMirror').children];
  return kids.slice(0, 3).map((e) => getComputedStyle(e).marginTop);
});
ok('the heading BELOW the opening line keeps its two blank lines',
  after[0] === '0px' && after[1] === '32px', JSON.stringify(after));
ok('…and the action below it keeps its one', after[2] === '16px', JSON.stringify(after));

// ── 2: the ribbon editor renders the live bar, not a bigger one ──────
console.log('\n2. ribbon edit mode is the same size as the live bar');

const snap = () => page.evaluate(() => {
  const bar = document.querySelector('.toolbar-ribbon');
  const r = (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left) }; };
  return {
    secs: [...bar.querySelectorAll('.rib-section')].map(r),
    rows: [...bar.querySelectorAll('.rib-row')].map(r),
    btns: [...bar.querySelectorAll('.toolbar-btn')].map((e) => ({
      key: e.getAttribute('title') || e.textContent.trim().slice(0, 12), ...r(e),
    })),
  };
});

await page.evaluate(() => window.__scStore.getState().setToolbarEditing(false));
await settle(page);
const live = await snap();
await page.evaluate(() => window.__scStore.getState().setToolbarEditing(true));
await settle(page);
await page.waitForTimeout(400);
const edit = await snap();

ok('edit mode really is on', await page.evaluate(() =>
  document.querySelector('.toolbar-ribbon')?.classList.contains('toolbar-editing')), '');
ok('the bar has sections to compare', live.secs.length >= 3 && live.btns.length >= 8,
  `${live.secs.length} sections / ${live.btns.length} buttons`);

const same = (a, b) => a.length === b.length && a.every((x, i) => x.w === b[i].w && x.h === b[i].h && x.x === b[i].x);
ok('every SECTION keeps its box and its position',
  same(live.secs, edit.secs),
  JSON.stringify(live.secs.map((s, i) => [s.w, s.x, edit.secs[i]?.w, edit.secs[i]?.x]).filter((p) => p[0] !== p[2] || p[1] !== p[3])));
ok('every ROW keeps its height', same(live.rows, edit.rows), '');

const byKey = new Map(live.btns.map((b) => [b.key, b]));
const grown = edit.btns.filter((b) => { const l = byKey.get(b.key); return l && (l.w !== b.w || l.h !== b.h); });
ok('every BUTTON keeps its size', grown.length === 0,
  JSON.stringify(grown.slice(0, 4).map((b) => `${b.key} ${byKey.get(b.key).w}x${byKey.get(b.key).h}→${b.w}x${b.h}`)));
ok('…and its position', edit.btns.every((b) => { const l = byKey.get(b.key); return !l || l.x === b.x; }), '');

/* The chrome must still be visible — parity is worthless if it bought itself
   by drawing nothing. */
ok('the edit chrome is still drawn', await page.evaluate(() =>
  document.querySelectorAll('.rib-edit-section').length > 0
  && document.querySelectorAll('.rib-edit-item').length > 0), '');

/* …and still WORK. The parity fix turned the ×s off at rest (an invisible
   badge was eating the divider's clicks), so prove the badge still removes
   its control once you hover it — otherwise this trades one silent no-op
   for another. */
const before = await page.locator('.rib-edit-item').count();
await page.hover('.rib-edit-item >> nth=0');
await page.waitForTimeout(120);
await page.locator('.rib-edit-item >> nth=0').locator('.rib-edit-x').click();
await settle(page);
await page.waitForTimeout(200);
const afterRemove = await page.locator('.rib-edit-item').count();
ok('hovering an item still arms its × and the click removes it',
  afterRemove === before - 1, `${before} → ${afterRemove}`);
await page.evaluate(() => window.__scStore.getState().setToolbarEditing(false));

// ── 3: the Pages tool reads the shared geometry, not a copy ──────────
console.log('\n3. one source for the page geometry');
const nav = readFileSync(new URL('../src/components/SceneNavigator.tsx', import.meta.url), 'utf8');
ok('SceneNavigator imports the shared metrics',
  /import \{[^}]*FD_INDENTS[^}]*SPACE_BEFORE[^}]*\} from '\.\.\/utils\/screenplayMetrics'/.test(nav), '');
ok('…and no longer declares its own',
  !/const FD_INDENTS\b/.test(nav) && !/const SPACE_BEFORE\b/.test(nav), '');

const css = readFileSync(new URL('../src/styles/screenplay/06-editor-content.css', import.meta.url), 'utf8');
ok('the first-element rule is stated for EVERY element, once',
  /\.screenplay-element:first-child \{ margin-top: 0; \}/.test(css)
  && !/\.scene-heading:first-child \{ margin-top: 0; \}/.test(css), '');

console.log(`\ncheck-v716: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
