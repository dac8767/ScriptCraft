/* check-v630 — Derek's side-by-side against another program ("verify all
   formatting is correct and determine why there are differences"):
   MEASURED verdicts — the font was never wrong (Courier at 12pt, 12pt line
   grid); the density difference was SCENE HEADING spacing: the spec puts
   TWO blank lines before a heading, ours had one. Fixed in all three
   renderers (editor CSS 24pt, paginator SPACE_BEFORE 2, PDF exporter 2,
   industry template marginTop 24). And FADE IN: is the OPENING transition
   — left margin — while every other transition stays right-aligned
   (utils/transitions predicate shared by the editor decoration and the
   exporter; typing flips it live). */
import { launch, boot, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };

try {
  await boot(page);
  await page.evaluate(() => {
    window.__scEditor.commands.setContent({ type: 'doc', content: [
      { type: 'transition', content: [{ type: 'text', text: 'FADE IN:' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. COSTUME SHOP - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'A WALL OF MASKS.' }] },
      { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. JHS - CHOIR ROOM - DAY' }] },
    ] });
  });
  await settle(page); await settle(page);

  const ed = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.ProseMirror .transition')];
    const h = [...document.querySelectorAll('.ProseMirror .scene-heading')];
    const cs = getComputedStyle(document.querySelector('.screenplay-content'));
    return {
      fadeLeft: t[0].classList.contains('transition-left') && getComputedStyle(t[0]).textAlign === 'left',
      fadePad: getComputedStyle(t[0]).paddingLeft,
      cutRight: getComputedStyle(t[1]).textAlign === 'right',
      headingGap: getComputedStyle(h[1]).marginTop,
      font: cs.fontFamily.toLowerCase().includes('courier'),
      size: cs.fontSize, lh: cs.lineHeight,
    };
  });
  ok(ed.fadeLeft && ed.fadePad === '0px', 'FADE IN: sits at the LEFT margin in the editor');
  ok(ed.cutRight, 'CUT TO: stays right-aligned');
  ok(ed.headingGap === '32px', `scene headings carry TWO blank lines (24pt = ${ed.headingGap})`);
  ok(ed.font && ed.size === '16px' && ed.lh === '16px', `Courier at 12pt on a 12pt grid (${ed.size}/${ed.lh})`);

  // typing flips the alignment live — the decoration follows the text
  const flipped = await page.evaluate(() => {
    window.__scEditor.chain().setTextSelection({ from: 1, to: 9 }).insertContent('CUT TO:').run();
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() =>
      r(document.querySelector('.ProseMirror .transition').classList.contains('transition-left')))));
  });
  ok(flipped === false, 'retyping FADE IN: into CUT TO: drops the left alignment live');

  // the PDF exporter agrees — measured, not assumed (bytes parsed in node;
  // bare import specifiers don't resolve inside page.evaluate)
  const dl = page.waitForEvent('download');
  await page.evaluate(async () => {
    window.__scEditor.commands.setContent({ type: 'doc', content: [
      { type: 'transition', content: [{ type: 'text', text: 'FADE IN:' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. COSTUME SHOP - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'A WALL OF MASKS.' }] },
      { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
    ] });
    const mod = await import('/src/utils/pdfExporter.ts');
    await mod.exportPDF(window.__scEditor.getJSON(), 'fmt', window.__scStore.getState().pageLayout);
  });
  const file = '/tmp/check-v630.pdf';
  await (await dl).saveAs(file);
  const { readFileSync } = await import('fs');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdoc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), disableWorker: true }).promise;
  const p1 = await pdoc.getPage(1);
  const items = (await p1.getTextContent()).items
    .filter((i) => 'str' in i && i.str.trim())
    .map((i) => ({ x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), s: i.str }));
  const at = (t) => items.find((i) => i.s.includes(t));
  ok(at('FADE IN')?.x === 108, `exported FADE IN: at the 1.5in action margin (${at('FADE IN')?.x}pt)`);
  ok(at('CUT TO')?.x > 400, `exported CUT TO: right-aligned (${at('CUT TO')?.x}pt)`);
  const gap = at('FADE IN').y - at('INT. COSTUME').y;
  ok(gap === 36, `exported heading sits 2 blank lines below (${gap}pt)`);
  // v6.32, Derek ("exports as Courier Std"): the app's own Courier Prime is
  // EMBEDDED — its name sits in the font descriptors; builtin courier would
  // leave viewers substituting Courier Std.
  const bytes = readFileSync(file).toString('latin1');
  ok(bytes.includes('CourierPrime'), 'Courier Prime is embedded in the export');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
} finally { await browser.close(); }
console.log(`\ncheck-v630: ${pass} passed, ${fail} failed`);
