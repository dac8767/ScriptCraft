/* check-v608 — v6.08, Derek: every big two-row ribbon button matches
   EXACTLY — one icon→label distance for all, and hovering highlights the
   icon and label TOGETHER (the wrapper-builtin shape used to paint an
   icon-only box; its label was a CSS ::after outside the hover surface). */
import { launch, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL', m); } };
const { browser, page } = await launch({ width: 1900, height: 950 });
try {
  await page.addInitScript(() => {
    if (localStorage.getItem('__rib_seeded')) return;
    localStorage.clear();
    localStorage.setItem('__rib_seeded', '1');
    // one tall section mixing the shapes: wrapper builtins (plain button,
    // popup host, compound select) and one-block buttons (customize, lock,
    // pinned tools)
    localStorage.setItem('opendraft:viewState', JSON.stringify({
      toolbarLeft: [
        'st:Big', 'b:goto', 'b:find', 'b:fontSize',
        'b:customize', 'b:lockResize', 't:thesaurus', 't:analytics',
      ],
      toolbarZonesSet: true,
    }));
    for (const f of ['BigZone202', 'SepDividers214', 'SurfaceToggles234', 'LockResize255',
                     'ResetSizes267', 'TwoRows294', 'Ribbon295', 'RibbonSections296',
                     'CustomizeItem302', 'DropPanelToggles325']) {
      localStorage.setItem(`opendraft:toolbar${f}`, '1');
    }
  });
  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ProseMirror', { timeout: 25000 });
  for (let i = 0; i < 5; i++) { if (!(await page.$('.dialog-overlay'))) break; await page.keyboard.press('Escape'); await settle(page); }
  await settle(page);

  const items = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.toolbar-ribbon .rib-tall-btn, .toolbar-ribbon .toolbar-priority-block.rib-tall')) {
      const label = el.querySelector('.rib-tall-label');
      if (!label) continue;
      const prev = label.previousElementSibling;
      const gap = prev ? Math.round((label.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) * 10) / 10 : null;
      out.push({ key: el.dataset.key ?? el.getAttribute('title') ?? '?', gap });
    }
    return out;
  });
  ok(items.length >= 7, `all seeded big buttons render a shared-class label (${items.length})`);
  const uniq = [...new Set(items.map((i) => i.gap))];
  ok(uniq.length === 1 && uniq[0] != null,
    `ONE icon→label distance for every button (${uniq.join(', ')}px — ${items.map((i) => i.key).join(' · ')})`);

  for (const sel of ['.toolbar-priority-block.rib-tall[data-key="goto"]',
                     '.toolbar-priority-block.rib-tall[data-key="fontSize"]',
                     '.rib-tall-btn[data-key="thesaurus"]']) {
    const el = await page.$(sel);
    if (!el) { ok(false, `missing ${sel}`); continue; }
    await el.hover();
    await page.waitForTimeout(80);
    const r = await page.evaluate((s) => {
      const block = document.querySelector(s);
      const label = block.querySelector('.rib-tall-label');
      const bg = getComputedStyle(block).backgroundColor;
      const painted = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      const br = block.getBoundingClientRect();
      const lr = label.getBoundingClientRect();
      const inner = block.querySelector('.toolbar-btn');
      const innerBg = inner ? getComputedStyle(inner).backgroundColor : null;
      return {
        painted,
        coversLabel: br.top <= lr.top && br.bottom >= lr.bottom,
        innerSolo: !!(innerBg && innerBg !== 'rgba(0, 0, 0, 0)' && innerBg !== 'transparent'),
      };
    }, sel);
    ok(r.painted && r.coversLabel && !r.innerSolo,
      `hover paints ONE box holding icon + label (${sel.match(/"(\w+)"/)?.[1]})`);
  }
} catch (e) { console.log('  ✗ SCRIPT ERROR:', e.message); fail++; }
finally {
  await browser.close();
  console.log(`\ncheck-v608: ${pass} passed, ${fail} failed`);
}
