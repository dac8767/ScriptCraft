// check-v573 — the title-page thumbnail shows the TRUE format.
// Probes computed styles + real geometry in the All tab's title thumb:
// centered title/credit, bold uppercase title at its custom size, draft
// anchored left, contact anchored right, and the title optically centered
// on the PAPER (not on the asymmetric printable box).
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';

const { browser, page } = await launch();
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  cond ? pass++ : fail++;
};

async function gotoTab(label) {
  const strip = await page.$(`.tool-chrome-tabs:not(.tool-chrome-tabs-measure) .tool-chrome-tab:text-is("${label}")`);
  if (strip && await strip.isVisible()) { await strip.click(); return; }
  await page.click('.tool-chrome-tabs-dd .tool-ctl');
  await page.click(`.tool-ctl-menu .tool-ctl-menu-item:text-is("${label}")`);
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await page.evaluate(() => {
    window.__scEditor.commands.insertContentAt(0, [
      { type: 'titlePage', attrs: { field: 'title', tpTitleFontSize: 24 }, content: [{ type: 'text', text: 'Belkadan Rising' }] },
      { type: 'titlePage', attrs: { field: 'author' }, content: [{ type: 'text', text: 'Written by Derek Carl' }] },
      { type: 'titlePage', attrs: { field: 'draft' }, content: [{ type: 'text', text: '1st Draft - 2026-07-17' }] },
      { type: 'titlePage', attrs: { field: 'contact' }, content: [{ type: 'text', text: 'derekcarl@pm.me' }] },
    ]);
  });

  await openTool(page, 'Pages');
  await gotoTab('All');
  await page.waitForSelector('.page-thumbnail[data-page="title"] .page-thumb-el', { timeout: 8000 });

  const probe = await page.evaluate(() => {
    const thumb = document.querySelector('.page-thumbnail[data-page="title"]');
    const els = Array.from(thumb.querySelectorAll('.page-thumb-el'));
    const byText = (frag) => els.find((e) => (e.textContent || '').toLowerCase().includes(frag));
    const read = (e) => {
      if (!e) return null;
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return {
        text: (e.textContent || '').trim(),
        align: cs.textAlign, weight: cs.fontWeight, transform: cs.textTransform,
        fontSize: cs.fontSize, left: r.left, right: r.right,
        center: r.left + r.width / 2,
      };
    };
    const clip = thumb.querySelector('.page-thumb-content-clip').getBoundingClientRect();
    return {
      title: read(byText('belkadan')),
      author: read(byText('written by')),
      draft: read(byText('1st draft')),
      contact: read(byText('@pm.me')),
      paperCenter: clip.left + clip.width / 2,
      paperLeft: clip.left,
      paperRight: clip.right,
      // an action line from script page 1, for the body-indent contrast
      action: (() => {
        const s = document.querySelector('.page-thumbnail[data-page="1"] .page-thumb-el');
        return s ? getComputedStyle(s).textAlign : null;
      })(),
    };
  });

  ok(probe.title?.align === 'center', `the title is centered (${probe.title?.align})`);
  ok(probe.title?.weight === '700', `the title is bold (${probe.title?.weight})`);
  ok(probe.title?.transform === 'uppercase', `the title renders in caps (${probe.title?.transform})`);
  ok(probe.title?.fontSize === '32px', `the custom 24pt title size is honored (${probe.title?.fontSize})`);
  ok(probe.author?.align === 'center', `the credit is centered (${probe.author?.align})`);
  ok(probe.draft?.align === 'left', `the draft line anchors left (${probe.draft?.align})`);
  ok(probe.contact?.align === 'right', `contact anchors right (${probe.contact?.align})`);

  // true paper centering: the centered blocks' box center sits on the PAPER's
  // center, not on the printable box's (which is ~(1.5in-0.76in)/2 right of it)
  const off = Math.abs((probe.title?.center ?? 0) - probe.paperCenter);
  ok(off < 1.5, `the title centers on the paper, not the text box (off by ${off.toFixed(2)}px)`);
  const authorOff = Math.abs((probe.author?.center ?? 0) - probe.paperCenter);
  ok(authorOff < 1.5, `the credit block centers on the paper too (off by ${authorOff.toFixed(2)}px)`);

  // the anchored lines keep the body margins (they are NOT paper-shifted)
  ok(probe.draft.left > probe.paperLeft && probe.draft.left < probe.paperCenter,
    'the draft line sits inside the left margin');

  // and the script pages are untouched — body elements still read left
  ok(probe.action === 'start' || probe.action === 'left',
    `script pages keep body formatting (${probe.action})`);
} catch (e) {
  console.log('  ✗ SCRIPT ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\ncheck-v573: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
