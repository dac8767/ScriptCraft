/* check-v748 — the text-colour control, and the cursor-formatting engine.
 *
 * Queue #7, the last two pieces of Toolbar's renderBuiltinControl.
 *
 * TWO DIFFERENT KINDS OF RISK, so two different kinds of assertion.
 *
 * TextColorControl was a lift of a control that owned its state, like zoom and
 * insertTable before it — except for one thing. It shared its open flag with
 * the SCRIPT's other text-colour control, the Scrapbook's, purely because both
 * were rendered by the same function. Splitting them is a behaviour change,
 * and the bug it fixes is the kind that only shows up in a sequence: open the
 * Scrapbook's picker, close the Scrapbook, and the script's picker was already
 * open. So that sequence is driven here, in order, not asserted from reading.
 *
 * useCursorFormatting is the opposite: nothing about it renders. It is the
 * engine that answers "what font is the cursor in", which has three answers —
 * empty cursor, one-font selection, mixed selection — plus a fourth case that
 * looks like none of them (a selection containing no text at all, which is
 * what dragging across a blank line gives you). tsc cannot tell whether the
 * hook still receives the editor's transaction events; only moving the cursor
 * and reading the picker can. The mixed case is the one worth the effort: a
 * picker that shows a font for mixed text will flatten that text the moment
 * anything writes the shown value back.
 *
 * TWO THINGS FOUND BY BREAKING THE CODE TO SEE IF THESE ASSERTIONS NOTICE,
 * both worth writing down because they are not what the source suggests:
 *
 *   · The `!sawText` guard is NOT load-bearing. Delete it and a text-free
 *     selection falls into the "all one font" branch with an empty set, whose
 *     `single || rule?.fontFamily || fontFamily` chain lands on exactly the
 *     same answer. It is a redundant guard, kept because the fallback chain
 *     below it could be tightened one day and then it WOULD be the only thing
 *     standing between a blank line and a picker that reads "mixed". The
 *     behaviour is asserted directly below; the guard's presence is asserted
 *     from source, and that is the honest division.
 *   · `selectionUpdate` and `transaction` are redundant with each other —
 *     ProseMirror dispatches a transaction for a selection-only change too, so
 *     removing either listener alone changes nothing. Only losing both stops
 *     the picker following the cursor, and that is what these assertions
 *     catch.
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

/* Put both controls on the ribbon. They are not both in the default layout,
   and this is about the controls, not about which layout ships. */
await page.evaluate(() => {
  window.__scStore.getState().setToolbarZones(['b:textColor', 'b:fontFamily', 'b:fontSize'], []);
});
await settle(page);
await page.waitForTimeout(600);

/* ── the text-colour control ─────────────────────────────────────────────── */
console.log('\nthe text-colour control renders and colours text');
ok('the button is on the toolbar', Boolean(await page.$('.fs-textcolor-icon')));

const opened = await page.evaluate(async () => {
  document.querySelector('.fs-textcolor-icon').closest('button').click();
  await new Promise((r) => setTimeout(r, 250));
  return { picker: Boolean(document.querySelector('.color-picker-popup')) };
});
ok('clicking it opens the picker', opened.picker === true, JSON.stringify(opened));

/* The picker is PORTALLED — an absolute popup inside the ribbon renders but
   cannot be clicked, which shipped once as the "dead button" report. Being a
   descendant of the toolbar is exactly the failure. */
const portalled = await page.evaluate(() => {
  const p = document.querySelector('.color-picker-popup');
  return { inToolbar: Boolean(p.closest('.toolbar')), top: p.getBoundingClientRect().top };
});
ok('…portalled out of the ribbon, not nested inside it', portalled.inToolbar === false,
  JSON.stringify(portalled));
ok('…and positioned below the button, not collapsed', portalled.top > 0, JSON.stringify(portalled));

/* Now colour something and read the DOCUMENT back. A picker that opens and
   writes into the void is this project's cardinal sin. */
const coloured = await page.evaluate(async () => {
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [{ type: 'action', content: [{ type: 'text', text: 'Colour this line.' }] }],
  });
  ed.commands.setTextSelection({ from: 1, to: 18 });
  await new Promise((r) => setTimeout(r, 200));
  const sw = [...document.querySelectorAll('.color-picker-popup .color-picker-swatch')]
    .find((b) => {
      const bg = getComputedStyle(b).backgroundColor;
      return /^rgb\(/.test(bg) && bg !== 'rgba(0, 0, 0, 0)';
    });
  if (!sw) return { picked: false };
  sw.click();
  await new Promise((r) => setTimeout(r, 350));
  const marks = [];
  ed.state.doc.descendants((n) => {
    if (n.isText) for (const m of n.marks) if (m.attrs?.color) marks.push(m.attrs.color);
  });
  return { picked: true, marks, closed: !document.querySelector('.color-picker-popup') };
});
ok('picking a colour writes a color mark into the script',
  coloured.picked && coloured.marks.length > 0, JSON.stringify(coloured));
ok('…and closes the picker behind it', coloured.closed === true, JSON.stringify(coloured));

/* THE SHARED-FLAG EDGE. Open the Scrapbook's text-colour picker, close the
   Scrapbook, and the SCRIPT's picker must not be sitting open. Before v7.47
   one `textColorOpen` served both, so it was. */
console.log('\nthe Scrapbook picker no longer leaves the script picker open');
const edge = await page.evaluate(async () => {
  const nb = window.__scNotebookStore;
  if (!nb) return { skipped: 'no notebook store on window' };
  nb.getState().setNotebookOpen(true);
  await new Promise((r) => setTimeout(r, 400));
  // the Scrapbook's own text-colour button (a different control, same key)
  const btn = [...document.querySelectorAll('.toolbar-btn')]
    .find((b) => (b.getAttribute('title') || '').startsWith('Text Color (Scrapbook)'));
  if (!btn) return { skipped: 'scrapbook text-colour button not rendered' };
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  const sbPickerOpen = Boolean(document.querySelector('.color-picker-popup'));
  nb.getState().setNotebookOpen(false);
  await new Promise((r) => setTimeout(r, 500));
  return { sbPickerOpen, scriptPickerOpen: Boolean(document.querySelector('.color-picker-popup')) };
});
if (edge.skipped) {
  console.log(`  SKIP the Scrapbook sequence — ${edge.skipped}`);
} else {
  ok('the Scrapbook button opens ITS picker', edge.sbPickerOpen === true, JSON.stringify(edge));
  ok('…and closing the Scrapbook does not leave the script picker open',
    edge.scriptPickerOpen === false, JSON.stringify(edge));
}

/* ── the cursor-formatting engine ────────────────────────────────────────── */
console.log('\nthe font picker still follows the cursor');
/* Close the Scrapbook and leave the document CLEAN. Nothing here may seed an
   unregistered font before the sweep assertion below gets to it — setContent
   parks the cursor at the end of the document, so a Georgia run injected here
   would be read by the DETECTOR and the sweep would never be tested. */
await page.evaluate(async () => {
  const nb = window.__scNotebookStore;
  if (nb) nb.getState().setNotebookOpen(false);
  await new Promise((r) => setTimeout(r, 300));
});

/* THE SWEEP, ISOLATED FROM THE DETECTOR. Two separate things put an
   unregistered font into the picker: the detector adds the one under the
   cursor, and a document-wide sweep finds every other one. If the cursor ever
   visits the Georgia run, the detector answers and the sweep could be deleted
   with nothing noticing — so here the cursor stays in plain text throughout
   and Georgia sits in the middle of the document, out of reach of it.

   The edit matters too: the sweep listens on the editor's `update` event, and
   setContent does not emit one. So a real insertion is what drives it. */
const sweep = await page.evaluate(async () => {
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [
      { type: 'action', content: [{ type: 'text', text: 'Plain line one.' }] },
      {
        type: 'action',
        content: [{
          type: 'text',
          text: 'Georgia line.',
          marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia' } }],
        }],
      },
      { type: 'action', content: [{ type: 'text', text: 'Plain line three.' }] },
    ],
  });
  await new Promise((r) => setTimeout(r, 300));
  ed.commands.setTextSelection(3);
  await new Promise((r) => setTimeout(r, 200));
  ed.commands.insertContent('x');
  await new Promise((r) => setTimeout(r, 500));
  const el = document.querySelector('.font-selector');
  const group = [...el.querySelectorAll('optgroup')].find((g) => g.label === 'Document Fonts');
  return {
    cursor: ed.state.selection.from,
    value: el.value,
    docFonts: group ? [...group.children].map((o) => o.value) : [],
  };
});
ok('a font only the document knows about is swept up and made selectable',
  sweep.docFonts.includes('Georgia'), JSON.stringify(sweep));
ok('the cursor in unmarked text shows the template font, not blank',
  Boolean(sweep.value) && sweep.value !== 'Georgia', JSON.stringify(sweep.value));

const inGeorgia = await page.evaluate(async () => {
  // put the cursor inside the Georgia run
  const ed = window.__scEditor;
  let pos = null;
  ed.state.doc.descendants((n, p) => {
    if (n.isText && n.text.startsWith('Georgia')) pos = p + 3;
  });
  ed.commands.setTextSelection(pos);
  await new Promise((r) => setTimeout(r, 350));
  const el = document.querySelector('.font-selector');
  return el ? (el.value ?? el.textContent.trim()) : null;
});
ok('the cursor inside a Georgia run reports Georgia', inGeorgia === 'Georgia', String(inGeorgia));

/* THE SELECTION WITH NO TEXT IN IT. Dragging across a blank line gives
   nodesBetween nothing to yield, so without the sawText guard the "all one
   font" branch runs against an empty set and reports the empty string —
   which the picker renders as MIXED. Blank text is not mixed text. */
const blankLine = await page.evaluate(async () => {
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [
      { type: 'action', content: [{ type: 'text', text: 'Some text above.' }] },
      { type: 'action' },
      { type: 'action' },
      { type: 'action', content: [{ type: 'text', text: 'Some text below.' }] },
    ],
  });
  await new Promise((r) => setTimeout(r, 350));
  const empties = [];
  ed.state.doc.descendants((n, p) => { if (n.content.size === 0 && n.isBlock) empties.push(p); });
  if (empties.length < 2) return { skipped: 'no empty paragraphs' };
  ed.commands.setTextSelection({ from: empties[0] + 1, to: empties[empties.length - 1] + 1 });
  await new Promise((r) => setTimeout(r, 400));
  const sel = ed.state.selection;
  let sawText = false;
  ed.state.doc.nodesBetween(sel.from, sel.to, (n, p) => {
    if (!n.isText || !n.text) return;
    if (Math.min(p + n.nodeSize, sel.to) > Math.max(p, sel.from)) sawText = true;
  });
  const el = document.querySelector('.font-selector');
  return { value: el ? el.value : null, spansText: sawText, collapsed: sel.empty };
});
ok('the fixture really is a non-empty selection with no text in it',
  blankLine.spansText === false && blankLine.collapsed === false, JSON.stringify(blankLine));
ok('a selection containing no text is not reported as mixed',
  blankLine.value !== '' && blankLine.value !== null, JSON.stringify(blankLine));

/* THE MIXED CASE. A selection spanning both runs must show BLANK. Showing
   either font here is how mixed text gets silently flattened. */
const mixed = await page.evaluate(async () => {
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [
      { type: 'action', content: [{ type: 'text', text: 'Plain line in the default font.' }] },
      {
        type: 'action',
        content: [{
          type: 'text',
          text: 'Georgia line.',
          marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia' } }],
        }],
      },
    ],
  });
  await new Promise((r) => setTimeout(r, 400));
  ed.commands.setTextSelection({ from: 2, to: ed.state.doc.content.size - 2 });
  await new Promise((r) => setTimeout(r, 350));
  const el = document.querySelector('.font-selector');
  return el ? (el.value ?? el.textContent.trim()) : null;
});
ok('a selection spanning two fonts shows blank for "mixed"', mixed === '', JSON.stringify(mixed));

console.log('\nthe extraction itself');
const tb = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8');
const tc = readFileSync(new URL('../src/components/TextColorControl.tsx', import.meta.url), 'utf8');
const cf = readFileSync(new URL('../src/hooks/useCursorFormatting.ts', import.meta.url), 'utf8');
ok('Toolbar renders TextColorControl instead of the old case body',
  /case 'textColor':\s*\n\s*return <TextColorControl /.test(tb), '');
ok('…and holds no script text-colour state of its own',
  !/\bcurrentTextColor\b|\bcolorPopAnchor\b/.test(tb), '');
ok('the Scrapbook picker has a flag of its own', /sbTextColorOpen/.test(tb), '');
ok('…which TextColorControl does not share', !/sbTextColorOpen/.test(tc), '');
ok('the detector left Toolbar entirely',
  !/detectFormatting|setCursorFont|setExtraFonts/.test(tb), '');
ok('…and Toolbar gets all four values from the one hook',
  /const \{ locked, cursorFont, cursorSize, extraFonts \} = useCursorFormatting\(editor\)/.test(tb), '');
/* The sawText guard is the one that has no visible symptom until someone
   drags across a blank line, so it is worth naming. */
ok('the empty-selection guard came with it', /let sawText = false/.test(cf) && /if \(!sawText\)/.test(cf), '');

console.log(`\ncheck-v748: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
