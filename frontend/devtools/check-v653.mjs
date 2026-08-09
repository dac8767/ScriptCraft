/* check-v653 — Derek's freeform-card batch:
   1 the card moves when dragged from ANYWHERE in its header — driven with
     a slow, human-like gesture (tiny first steps), which is what the v6.52
     threshold-without-preventDefault version failed on
   2 the card resizes from any edge/corner (east grows, north/west move the
     card's origin as they resize)
   3 the Connect button sits in the BOTTOM-RIGHT corner
   4 click-place-click connecting: circle on the first card's edge, circle
     on the second's; the line meets both cards where they were placed
   5 Escape cancels a half-placed connection
   6 a pre-v6.53 link (no anchors) still draws center to center */
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 950 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const W = '.tool-window[data-tool="beatboard"]';
const card = (id) => `${W} .beat-card-wrap-free[data-beat-id="${id}"]`;
const beatOf = (id) => page.evaluate((i) => {
  const b = window.__scStore.getState().beats.find((x) => x.id === i);
  return { x: b.x, y: b.y, w: b.cardWidth, h: b.cardHeight, links: b.mindLinks ?? [], anchors: b.mindAnchors ?? {} };
}, id);

/** A hand-like drag: press, creep, then travel. */
async function humanDrag(from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 1, from.y);            // the sub-threshold creep
  await page.mouse.move(from.x + 2, from.y + 1);
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + (dx * i) / 8, from.y + (dy * i) / 8);
  }
  await page.mouse.up();
}

try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await page.evaluate(() => {
    window.__scStore.setState((s) => ({ toolSizes: { ...s.toolSizes, beatboard: { w: 1300, h: 760 } } }));
    const st = window.__scStore.getState();
    st.setToolMode('beatboard', 'floating');
    st.openTool('beatboard');
  });
  await page.waitForSelector(W, { timeout: 8000 });
  await page.click(`${W} [data-ctl="view"]`);
  await page.click('.tool-ctl-menu .tool-ctl-menu-item:has-text("Freeform")');
  await settle(page);
  const ids = await page.evaluate(() => {
    const st = window.__scStore.getState();
    const colId = st.beatColumns[0]?.id || st.addBeatColumn('S');
    st.addBeat('Origin card', colId);
    st.addBeat('Target card', colId);
    const beats = window.__scStore.getState().beats;
    const a = beats[beats.length - 2], b = beats[beats.length - 1];
    st.updateBeat(a.id, { x: 60, y: 80, cardWidth: 240, cardHeight: 120 });
    st.updateBeat(b.id, { x: 560, y: 80, cardWidth: 240, cardHeight: 120 });
    return { a: a.id, b: b.id };
  });
  await settle(page);

  // ── 1: header drag, human-paced, over the title input ──
  const before1 = await beatOf(ids.a);
  const titleBox = await page.$eval(`${card(ids.a)} .beat-card-title`, (el) => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await humanDrag(titleBox, 90, 60);
  await settle(page);
  const after1 = await beatOf(ids.a);
  ok(after1.x - before1.x > 70 && after1.y - before1.y > 40,
    `slow header drag over the title moves the card (${before1.x},${before1.y} → ${after1.x},${after1.y})`);
  const focusedAfterDrag = await page.evaluate(() => document.activeElement?.classList.contains('beat-card-title') ?? false);
  ok(!focusedAfterDrag, 'the drag left the title unfocused (no text-selection fight)');

  // a plain click still focuses the title for editing
  await page.click(`${card(ids.a)} .beat-card-title`);
  await settle(page);
  ok(await page.evaluate(() => document.activeElement?.classList.contains('beat-card-title') ?? false),
    'a plain click on the title still focuses it');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement.blur());

  // drag from the header's blank strip (between title and buttons) too
  const before1b = await beatOf(ids.a);
  const topBox = await page.$eval(`${card(ids.a)} .beat-card-top`, (el) => {
    const r = el.getBoundingClientRect(); return { x: r.x + 12, y: r.y + r.height / 2 };
  });
  await humanDrag(topBox, -40, 30);
  await settle(page);
  const after1b = await beatOf(ids.a);
  ok(Math.abs(after1b.x - (before1b.x - 40)) < 12 && Math.abs(after1b.y - (before1b.y + 30)) < 12,
    'dragging the header beside the title moves it too');

  // ── 2: resize from any edge ──
  const beforeE = await beatOf(ids.b);
  const eZone = await page.$eval(`${card(ids.b)} .fs-edge-e`, (el) => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await humanDrag(eZone, 80, 0);
  await settle(page);
  const afterE = await beatOf(ids.b);
  ok(afterE.w - beforeE.w > 60 && afterE.x === beforeE.x,
    `east edge widens the card, left edge pinned (${beforeE.w} → ${afterE.w}px)`);

  const beforeN = await beatOf(ids.b);
  const nZone = await page.$eval(`${card(ids.b)} .fs-edge-n`, (el) => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await humanDrag(nZone, 0, -50);
  await settle(page);
  const afterN = await beatOf(ids.b);
  ok(afterN.h - beforeN.h > 30 && afterN.y < beforeN.y,
    `north edge grows upward — height up, top moves (${beforeN.y}→${afterN.y}, h ${beforeN.h}→${afterN.h})`);

  const beforeWst = await beatOf(ids.b);
  const wZone = await page.$eval(`${card(ids.b)} .fs-edge-w`, (el) => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await humanDrag(wZone, 40, 0);
  await settle(page);
  const afterW = await beatOf(ids.b);
  ok(afterW.x > beforeWst.x && afterW.w < beforeWst.w,
    `west edge moves the left side in (${beforeWst.x}→${afterW.x}, w ${beforeWst.w}→${afterW.w})`);

  // ── 3: the Connect button is in the bottom-right corner ──
  const btnPos = await page.evaluate((sel) => {
    const wrap = document.querySelector(sel);
    const btn = wrap.querySelector('.beat-card-linkbtn');
    if (!btn) return null;
    const w = wrap.getBoundingClientRect(), b = btn.getBoundingClientRect();
    return { right: Math.round(w.right - b.right), bottom: Math.round(w.bottom - b.bottom), inHeader: !!wrap.querySelector('.beat-card-top .beat-card-linkbtn') };
  }, card(ids.a));
  ok(btnPos && btnPos.right >= 0 && btnPos.right < 14 && btnPos.bottom >= 0 && btnPos.bottom < 14 && !btnPos.inHeader,
    `Connect sits in the bottom-right corner (${btnPos && `${btnPos.right}px from the right, ${btnPos.bottom}px up`})`);

  // ── 4: click-place-click, with the circles on chosen edges ──
  await page.click(`${card(ids.a)} .beat-card-linkbtn`);
  await settle(page);
  ok(await page.evaluate((s) => document.querySelector(s)?.classList.contains('mind-armed'), card(ids.a)),
    'clicking Connect arms the card for its edge circle');
  // place the start circle on the origin's RIGHT edge, near the top
  const aBox = await page.$eval(card(ids.a), (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(aBox.x + aBox.w - 3, aBox.y + aBox.h * 0.25);
  await settle(page);
  ok(await page.evaluate(() => !!document.querySelector('.mind-anchor-preview')),
    'a circle follows the pointer along the card edge');
  await page.mouse.down(); await page.mouse.up();
  await settle(page);
  const midState = await page.evaluate((s) => ({
    fixed: !!document.querySelector('.mind-anchor-set'),
    origin: document.querySelector(s)?.classList.contains('mind-link-origin'),
  }), card(ids.a));
  ok(midState.fixed && midState.origin, 'the start circle sticks and the origin stays highlighted');

  // now the target's LEFT edge, near the bottom
  const bBox = await page.$eval(card(ids.b), (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(bBox.x + 3, bBox.y + bBox.h * 0.75);
  await settle(page);
  ok(await page.evaluate((s) => document.querySelector(s)?.classList.contains('mind-link-target'), card(ids.b)),
    'the card under the pointer lights up as the target');
  await page.mouse.down(); await page.mouse.up();
  await settle(page);
  const linked = await beatOf(ids.a);
  ok(linked.links.includes(ids.b), 'the second click makes the connection');
  const anch = linked.anchors[ids.b];
  ok(anch && anch.from.ax > 0.9 && anch.from.ay > 0.1 && anch.from.ay < 0.45,
    `the start anchor kept its spot on the right edge (${anch && JSON.stringify(anch.from)})`);
  ok(anch && anch.to.ax < 0.1 && anch.to.ay > 0.55,
    `the end anchor kept its spot on the left edge (${anch && JSON.stringify(anch.to)})`);
  // the drawn line meets the cards at those points
  const geo = await page.evaluate((sels) => {
    const line = [...document.querySelectorAll('.mind-lines g line')].find((l) => !l.classList.contains('mind-line-hit'));
    const a = document.querySelector(sels.a).getBoundingClientRect();
    const b = document.querySelector(sels.b).getBoundingClientRect();
    const svg = document.querySelector('.mind-lines').getBoundingClientRect();
    return {
      x1: +line.getAttribute('x1') + svg.x, y1: +line.getAttribute('y1') + svg.y,
      x2: +line.getAttribute('x2') + svg.x, y2: +line.getAttribute('y2') + svg.y,
      aRight: a.right, bLeft: b.left,
    };
  }, { a: card(ids.a), b: card(ids.b) });
  ok(Math.abs(geo.x1 - geo.aRight) < 6, `the line starts on the origin's right edge (${Math.round(geo.x1)} vs ${Math.round(geo.aRight)})`);
  ok(Math.abs(geo.x2 - geo.bLeft) < 6, `and ends on the target's left edge (${Math.round(geo.x2)} vs ${Math.round(geo.bLeft)})`);

  // ── 5: Escape cancels a half-placed connection ──
  await page.click(`${card(ids.a)} .beat-card-linkbtn`);
  await settle(page);
  await page.keyboard.press('Escape');
  await settle(page);
  const cancelled = await page.evaluate((s) => ({
    armed: document.querySelector(s)?.classList.contains('mind-armed'),
    preview: !!document.querySelector('.mind-anchor-preview'),
  }), card(ids.a));
  ok(!cancelled.armed && !cancelled.preview, 'Escape cancels the placement');

  // ── 6: a pre-v6.53 link (no anchors) still runs center to center ──
  await page.evaluate((i) => {
    const st = window.__scStore.getState();
    st.updateBeat(i.a, { mindLinks: [i.b], mindAnchors: {} });
  }, ids);
  await settle(page);
  const legacy = await page.evaluate((sels) => {
    const line = [...document.querySelectorAll('.mind-lines g line')].find((l) => !l.classList.contains('mind-line-hit'));
    const svg = document.querySelector('.mind-lines').getBoundingClientRect();
    const a = document.querySelector(sels.a).getBoundingClientRect();
    return {
      x1: +line.getAttribute('x1') + svg.x, y1: +line.getAttribute('y1') + svg.y,
      acx: a.x + a.width / 2, acy: a.y + a.height / 2,
    };
  }, { a: card(ids.a) });
  ok(Math.abs(legacy.x1 - legacy.acx) < 4 && Math.abs(legacy.y1 - legacy.acy) < 4,
    'an anchorless link draws from the card center, exactly as before');
} catch (e) {
  console.log('PROBE ERROR:', e.message);
  fail++;
} finally { await browser.close(); }
console.log(`\ncheck-v653: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
