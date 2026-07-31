// check-v574 — the Title tab's preview and the Pages thumbnail render the
// SAME title page. Fields are filled in the real form, Apply writes the real
// nodes, then both renderings are read out of the live DOM and compared
// block by block (align / weight / caps / size-ratio), plus the geometry
// (both centered on the PAPER, not on the asymmetric printable box).
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};

const goto = async (label) => {
  const strip = await page.$(`.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:text-is("${label}")`);
  if (strip && await strip.isVisible()) return strip.click();
  await page.click('.tool-chrome-tabs-dd .tool-ctl');
  await page.click(`.tool-ctl-menu .tool-ctl-menu-item:text-is("${label}")`);
};

const setField = (labelText, value) => page.evaluate(([lt, v]) => {
  const labels = Array.from(document.querySelectorAll('.tp-editor-form label, .tp-editor-form span'));
  const lab = labels.find((l) => (l.textContent || '').trim().toLowerCase() === lt.toLowerCase());
  const field = lab?.parentElement?.querySelector('input, textarea, select');
  if (!field) return false;
  const proto = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement
    : field.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(field, v);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [labelText, value]);

/** Style + geometry of one rendered title page, keyed by its text. */
const readLines = (rootSel, lineSel, pageSel) => page.evaluate(([rs, ls, ps]) => {
  const root = document.querySelector(rs);
  const paper = document.querySelector(ps).getBoundingClientRect();
  return {
    paperCenter: paper.left + paper.width / 2,
    paperW: paper.width,
    lines: Array.from(root.querySelectorAll(ls))
      .filter((e) => (e.textContent || '').trim())
      .map((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return {
          text: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
          align: cs.textAlign, weight: cs.fontWeight, caps: cs.textTransform,
          wrap: cs.whiteSpace,
          // Raw px; normalised below against each rendering's OWN 12pt body
          // line. (Absolute px can't be compared across the two: both are
          // transform-scaled, and computed font-size ignores the transform
          // while getBoundingClientRect does not.)
          sizePx: parseFloat(cs.fontSize),
          center: r.left + r.width / 2,
        };
      }),
  };
}, [rootSel, lineSel, pageSel]);

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await openTool(page, 'Pages');
  await goto('Title');
  await page.waitForSelector('.tp-editor-dialog', { timeout: 8000 });

  for (const [label, value] of [
    ['Title', 'Star Wars - Episode X'], ['Title Size', '28'],
    ['Title Line 2', 'Invasion of the Vong'], ['Title Line 2 Size', '20'],
    ['Written By', 'Derek Carl'],
    ['Based On', 'based on the book "Vector Prime" by R. A. Salvatore'],
    ['Draft', '1st Draft'],
  ]) ok(await setField(label, value), `filled ${label}`);
  await page.waitForTimeout(300);

  const preview = await readLines('.tp-scale-page', ':scope > div', '.tp-scale-page');
  await page.click('.tp-editor-dialog .dialog-actions .dialog-primary');   // Apply
  await page.waitForTimeout(400);
  await goto('All');
  await page.waitForSelector('.page-thumbnail[data-page="title"] .page-thumb-el', { timeout: 8000 });
  const thumb = await readLines('.page-thumbnail[data-page="title"]', '.page-thumb-el',
    '.page-thumbnail[data-page="title"] .page-thumb-content-clip');

  ok(preview.lines.length === thumb.lines.length,
    `both render the same lines (${preview.lines.length} vs ${thumb.lines.length})`);

  // size as a MULTIPLE of that rendering's own body line — scale-independent
  const rel = (r) => {
    const base = r.lines[r.lines.length - 1].sizePx;    // the draft line, 12pt
    return r.lines.map((l) => Math.round((l.sizePx / base) * 100) / 100);
  };
  const pRel = rel(preview), tRel = rel(thumb);

  for (let i = 0; i < Math.min(preview.lines.length, thumb.lines.length); i++) {
    const p = preview.lines[i], t = thumb.lines[i];
    const same = p.text === t.text && p.align === t.align && p.weight === t.weight
      && p.caps === t.caps && p.wrap === t.wrap
      && Math.abs(pRel[i] - tRel[i]) < 0.02;
    ok(same, `"${p.text}" matches — ${p.align}/${p.weight}/${p.caps}/×${pRel[i]}`
      + (same ? '' : ` ≠ thumb ${t.text}|${t.align}/${t.weight}/${t.caps}/×${tRel[i]}`));
  }

  // geometry: centered lines sit on the PAPER's centre in BOTH renderings
  for (const [name, r] of [['preview', preview], ['thumbnail', thumb]]) {
    const title = r.lines[0];
    const off = Math.abs(title.center - r.paperCenter) / r.paperW;   // as a page fraction
    ok(off < 0.004, `${name}: the title centres on the paper (off by ${(off * 100).toFixed(2)}% of the page)`);
  }
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v574: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
