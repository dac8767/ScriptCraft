// devtools/check-scene-header.mjs — v5.06 geometry check for Derek's marked-up
// screenshot: titles centred over their REGIONS (Scene = badge+heading,
// Length = metrics+icon), resize bars halfway between adjacent regions.
// One run prints every number. ~5s on the kit.
import { launch, boot, seedScript, openTool, fullscreen, waitScenes, shot, SCENES_4, useSceneList } from './driver.mjs';

const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await openTool(page, 'Scenes');
await fullscreen(page);
await useSceneList(page);
await waitScenes(page, 4);

const r = await page.evaluate(() => {
  const hdr = document.querySelector('.scene-list-header');
  const row = document.querySelector('.navigator-scene .scene-heading-row');
  const box = (el) => el.getBoundingClientRect();
  const mid = (a, b) => Math.round(((a + b) / 2) * 10) / 10;
  // Title text centre = the text node's box, NOT the span's — the absolutely-
  // positioned grip inside the span skews selectNodeContents (v5.05 lesson).
  const titleMid = (el) => {
    const tn = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const rg = document.createRange(); rg.selectNode(tn);
    const b = rg.getBoundingClientRect(); return mid(b.left, b.right);
  };
  const gripMid = (el) => { const b = box(el); return mid(b.left, b.right); };

  const num = box(row.querySelector('.scene-num-cell'));
  const head = box(row.querySelector('.scene-heading-text'));
  const syn = box(row.querySelector('.scene-synopsis-field'));
  const met = box(row.querySelector('.scene-metrics'));
  const icon = box(row.querySelector('.scene-length'));
  return {
    sceneRegion: { want: mid(num.left, head.right), got: titleMid(hdr.querySelector('.scene-col-title-head')) },
    synRegion:   { want: mid(syn.left, syn.right), got: titleMid(hdr.querySelector('.scene-col-title-syn')) },
    lengthRegion:{ want: mid(met.left, icon.right), got: titleMid(hdr.querySelector('.scene-col-title-met')) },
    bar1: { want: mid(head.right, syn.left), got: gripMid(hdr.querySelector('.scene-col-title-head .scene-col-grip')) },
    bar2: { want: mid(syn.right, met.left), got: gripMid(hdr.querySelector('.scene-col-title-met .scene-col-grip')) },
  };
});
let fail = 0;
for (const [k, { want, got }] of Object.entries(r)) {
  const d = Math.abs(want - got);
  console.log(`${d <= 1.5 ? 'OK  ' : 'FAIL'} ${k.padEnd(13)} want ${want}  got ${got}  (Δ${d.toFixed(1)}px)`);
  if (d > 1.5) fail++;
}
await shot(page, '.scenes-tool', new URL('./last-scene-header.png', import.meta.url).pathname, 300);
await browser.close();
process.exit(fail ? 1 : 0);
