/* check-v633 — wrap parity at the measured reference geometry (Derek: "the
   word 'of' is in a third row in scriptcraft, while it is at the end of the
   second row with a different program").
   The reference measures out to true 10-cpi Courier with full-width columns
   1.5"→7.8" (63 chars). Three renderers must agree: the EDITOR (CSS columns,
   no letter-spacing squeeze), the PAGINATOR (shared screenplayMetrics), and
   the PDF EXPORTER (trailing-space fit fix + columnFor). This check drives
   the editor DOM and parses the exported PDF bytes; the pure wrap math lives
   in screenplayMetrics.test.ts. */
import { launch, boot, settle } from './driver.mjs';

const SAMPLE = 'A TALL MAN in coveralls mops in an empty cafeteria. He hears a DISTANT CHOIR and looks up, revealing the eerily blank face of';
const JESSICA = 'JESSICA (17), a devout honor student, wearing a cross necklace. Standing beside her is her best friend,';
const LINE1 = 'A TALL MAN in coveralls mops in an empty cafeteria. He hears a';
const LINE2 = 'DISTANT CHOIR and looks up, revealing the eerily blank face of';
const JLINE = 'JESSICA (17), a devout honor student, wearing a cross necklace.';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await page.evaluate(([sample, jessica]) => {
    window.__scEditor.commands.setContent({ type: 'doc', content: [
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. JHS - CAFETERIA - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: sample }] },
      { type: 'action', content: [{ type: 'text', text: jessica }] },
    ] });
  }, [SAMPLE, JESSICA]);
  await settle(page); await settle(page);

  // ── the default page layout carries the measured 0.7" right margin ──
  const layout = await page.evaluate(() => window.__scStore.getState().pageLayout);
  ok(Math.abs(layout.rightMargin - 0.7) < 0.005, `default right margin is 0.7in (${layout.rightMargin})`);

  // ── editor: per-character rects reveal the real wrap points ──
  const ed = await page.evaluate(() => {
    const getLines = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = [];
      let n;
      while ((n = walker.nextNode())) {
        for (let i = 0; i < n.length; i++) {
          const r = document.createRange();
          r.setStart(n, i); r.setEnd(n, i + 1);
          parts.push({ ch: n.textContent[i], top: Math.round(r.getBoundingClientRect().top) });
        }
      }
      const lines = [];
      for (const p of parts) {
        if (!lines.length || Math.abs(p.top - lines[lines.length - 1].top) > 4) lines.push({ top: p.top, text: '' });
        lines[lines.length - 1].text += p.ch;
      }
      return lines.map((l) => l.text.trim());
    };
    const actions = [...document.querySelectorAll('.ProseMirror .action')];
    const cs = getComputedStyle(document.querySelector('.screenplay-content'));
    return {
      sampleLines: getLines(actions[0]),
      jessicaLines: getLines(actions[1]),
      spacing: cs.letterSpacing,
      actionWidth: actions[0].getBoundingClientRect().width,
    };
  });
  ok(ed.spacing === 'normal', `letter-spacing squeeze is GONE (${ed.spacing})`);
  // 6.3in + the 14px break-spaces phantom-space allowance (invisible ink)
  ok(Math.abs(ed.actionWidth - (6.3 * 96 + 14)) < 1.5, `action column is 6.3in + space allowance (${ed.actionWidth.toFixed(1)}px)`);
  ok(ed.sampleLines.length === 2, `the sample action wraps to TWO editor lines (${ed.sampleLines.length})`);
  ok(ed.sampleLines[0] === LINE1, `editor line 1 ends "He hears a" ("…${(ed.sampleLines[0] || '').slice(-16)}")`);
  ok(ed.sampleLines[1] === LINE2, `editor line 2 ends "face of" ("…${(ed.sampleLines[1] || '').slice(-16)}")`);
  ok(ed.jessicaLines[0] === JLINE, `the 63-char JESSICA line fits ONE editor line`);

  // ── export: the same document, measured from the PDF bytes ──
  const dl = page.waitForEvent('download');
  await page.evaluate(async () => {
    const mod = await import('/src/utils/pdfExporter.ts');
    await mod.exportPDF(window.__scEditor.getJSON(), 'wrap633', window.__scStore.getState().pageLayout);
  });
  const file = '/tmp/check-v633.pdf';
  await (await dl).saveAs(file);
  const { readFileSync } = await import('fs');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdoc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), disableWorker: true }).promise;
  const p1 = await pdoc.getPage(1);
  const items = (await p1.getTextContent()).items
    .filter((i) => 'str' in i && i.str.trim())
    .map((i) => ({ x: Math.round(i.transform[4]), w: i.width, s: i.str }));
  const find = (s) => items.find((i) => i.s === s);
  ok(!!find(LINE1), 'exported line 1 is exactly the reference break');
  ok(!!find(LINE2), 'exported line 2 is exactly the reference break');
  const j = find(JLINE);
  ok(!!j, 'exported JESSICA line holds all 63 chars');
  if (j) {
    ok(j.x === 108, `action starts at 1.5in (${j.x}pt)`);
    const rightEdge = j.x + j.w;
    ok(Math.abs(rightEdge - 561.6) < 2, `63 chars end at the 7.8in content edge (${rightEdge.toFixed(1)}pt = ${(rightEdge / 72).toFixed(3)}in)`);
  }
} catch (e) {
  console.log('PROBE ERROR:', e.message);
} finally { await browser.close(); }
console.log(`\ncheck-v633: ${pass} passed, ${fail} failed`);
