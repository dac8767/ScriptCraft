/* check-v716 — the two formatting items Derek queued on 2026-08-13.

   1 The blank-line-before rule must NOT apply to the very first element on
     page 1. It was stated for scene headings only, so a script opening the
     normal way — FADE IN: — started a line down the page. The paginator, the
     PDF exporter and the Pages thumbnails have always agreed (isFirst ? 0);
     the editor is the renderer that disagreed.
   2 The ribbon EDITOR must render the same controls at the same size as the
     live bar. RETIRED in v7.59 with the second renderer it compared — see the
     note below where it used to run.

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
/* ── 2 (RETIRED) ─────────────────────────────────────────────────────────
   This part measured the ribbon EDITOR against the live bar — same section
   boxes, same rows, same buttons, same x — because for a while the bar had two
   renderings and they drifted apart by a few pixels each time either was
   touched.

   v7.58 retired in-place bar editing and v7.59 deleted its renderer, so there
   is exactly ONE rendering of the ribbon now. The property this asserted is no
   longer something the code could get wrong: there is nothing to disagree
   with. Removed rather than left passing vacuously — a check that can only
   pass is a check that says nothing, and reading one is worse than reading
   none. check-v759 owns what replaced it (the bar is highlighted, not
   re-rendered, while its tab is open). */


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
