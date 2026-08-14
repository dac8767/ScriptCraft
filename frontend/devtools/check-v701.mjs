// check-v701.mjs — the v7.00 style audit's fixes, proven in the running app.
//
// Every assert here reads a COMPUTED style, because that is the only way these
// bugs were visible in the first place: the CSS looked correct in the file and
// resolved to nothing in the browser. Six theme tokens were consumed by the
// stylesheets and defined by no theme; a hovered primary button lost its fill to
// a specificity trap; four selects in Settings were native controls.
//
// Usage (from frontend/, Vite on :5199):  node devtools/check-v701.mjs
import { launch, boot, seedScript, SCENES_4, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL', msg); } };

const { browser, page } = await launch();
try {
  await boot(page);
  await seedScript(page, SCENES_4);
  await settle(page);

  const setTheme = (t) => page.evaluate((x) => document.documentElement.setAttribute('data-theme', x), t);

  /* ── A1-A6: the six tokens resolve in EVERY theme ─────────────────────── */
  const THEMES = ['dark', 'light', 'sepia', 'paper', 'nord', 'dracula',
                  'solarized-dark', 'solarized-light', 'catppuccin', 'gruvbox', 'midnight'];
  const TOKENS = ['--fd-toolbar-hover', '--fd-hover-bg', '--fd-hover',
                  '--fd-background', '--fd-text-dim', '--fd-text-secondary',
                  '--fd-danger', '--fd-success', '--fd-warning'];
  const unresolved = [];
  for (const theme of THEMES) {
    await setTheme(theme);
    const empty = await page.evaluate((toks) => {
      const cs = getComputedStyle(document.documentElement);
      return toks.filter((t) => !cs.getPropertyValue(t).trim());
    }, TOKENS);
    if (empty.length) unresolved.push(`${theme}: ${empty.join(',')}`);
  }
  ok(unresolved.length === 0,
    `all ${TOKENS.length} theme tokens resolve in all ${THEMES.length} themes${unresolved.length ? ' — ' + unresolved.join(' | ') : ''}`);

  /* ── C60: a hovered primary dialog button KEEPS an accent-ish fill ─────── */
  for (const theme of ['dark', 'light']) {
    await setTheme(theme);
    await page.evaluate(() => window.__scStore.getState().openPreferences('general'));
    await page.waitForSelector('.prefs-window .prefs-footer .dialog-btn-primary', { timeout: 8000 });
    const btn = page.locator('.prefs-window .prefs-footer .dialog-btn-primary');
    const rest = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    await btn.hover();
    await page.waitForTimeout(120);
    const hover = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.mouse.move(4, 4);
    // WebKit reports a color-mix() result as `color(srgb 0.24 0.53 0.86)` —
    // 0-1 floats, not 0-255 ints — so a naive \d+ scrape reads "249569" as a
    // channel. Parse both forms and normalise to 0-255.
    const chan = (s) => {
      const nums = (s.match(/[\d.]+/g) || []).map(Number);
      const rgb3 = s.startsWith('color(') ? nums.slice(0, 3).map((n) => n * 255) : nums.slice(0, 3);
      return rgb3;
    };
    const [hr, hg, hb] = chan(hover);
    const alpha = hover.startsWith('rgba') ? Number(hover.split(',')[3]) : 1;
    // the bug: hover fell through to .dialog-btn:hover, which was transparent
    ok(alpha !== 0 && !(hr === 0 && hg === 0 && hb === 0),
      `[${theme}] hovered primary keeps a fill (${rest} → ${hover})`);
    // and it must still read as the accent, not the plain gray button surface
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fd-accent').trim());
    ok(hb > hr, `[${theme}] and it is still the blue accent, not the neutral button (accent ${accent})`);
  }
  await setTheme('dark');

  /* ── D67-D73: Settings ▸ General has no native controls left ───────────── */
  await page.evaluate(() => window.__scStore.getState().openPreferences('general'));
  await page.waitForSelector('.prefs-window', { timeout: 8000 });
  const natives = await page.evaluate(() => {
    const out = { selects: [], controls: [] };
    for (const el of document.querySelectorAll('.prefs-window select')) {
      const cs = getComputedStyle(el);
      out.selects.push({ h: Math.round(el.getBoundingClientRect().height), fs: cs.fontSize, cls: el.className || '(none)' });
    }
    for (const el of document.querySelectorAll('.prefs-window input:not([type=checkbox]):not([type=radio]), .prefs-window button')) {
      if (el.getBoundingClientRect().height < 2) continue;
      if (!el.className) out.controls.push(el.tagName + ':' + (el.textContent || '').trim().slice(0, 18));
    }
    return out;
  });
  ok(natives.selects.length > 0 && natives.selects.every((s) => s.h >= 28),
    `every Settings select is styled, not a 19px native control (${natives.selects.map((s) => s.h).join(',')})`);
  ok(natives.selects.every((s) => s.cls !== '(none)'),
    'and every one of them carries a class');
  ok(natives.controls.length === 0,
    `no unclassed input/button left in the Settings window${natives.controls.length ? ' — ' + natives.controls.join(', ') : ''}`);

  /* ── D71-D73: the Draft Number row specifically ────────────────────────── */
  const draft = await page.evaluate(() => {
    const inp = document.querySelector('#prefs-draft-label');
    if (!inp) return null;
    const row = inp.closest('.prefs-field-row');
    const btns = [...row.querySelectorAll('button')].map((b) => ({
      text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), cls: b.className,
    }));
    return { inputH: Math.round(inp.getBoundingClientRect().height), inputCls: inp.className, btns };
  });
  ok(draft && draft.inputH >= 30 && draft.inputCls.includes('dialog-input'),
    `Draft Number field is the house input, not a native white box (${draft?.inputH}px)`);
  ok(draft && draft.btns.every((b) => b.cls.includes('dialog-btn')),
    `and both its buttons are house buttons (${draft?.btns.map((b) => b.text + ' ' + b.h + 'px').join(', ')})`);

  /* ── F133: dialog-btn-sm is actually SMALL ─────────────────────────────── */
  await page.evaluate(() => window.__scStore.getState().openPreferences('defaults'));
  await page.waitForSelector('.fs-defaults-tab', { timeout: 8000 });
  const sm = await page.evaluate(() => {
    const b = document.querySelector('.fs-defaults-tab .dialog-btn-sm');
    const std = document.querySelector('.prefs-footer .dialog-btn');
    return b && std ? { sm: Math.round(b.getBoundingClientRect().height), std: Math.round(std.getBoundingClientRect().height) } : null;
  });
  ok(sm && sm.sm < sm.std, `dialog-btn-sm is shorter than the standard button (${sm?.sm}px vs ${sm?.std}px)`);
  await page.click('.prefs-window .tool-window-close').catch(() => {});

  /* ── J228-J241: no control is a black box on the light-warm themes ─────── */
  const lum = (s) => { const [r, g, b] = (s.match(/\d+/g) || [0, 0, 0]).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const theme of ['sepia', 'paper', 'solarized-light']) {
    await setTheme(theme);
    await page.waitForTimeout(150);
    const dark = await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = `<input class="char-profiles-search-input"/><select class="char-sort-select"></select>
        <select class="asset-filter-select"></select><input class="asset-filter-input"/>
        <select class="language-selector"></select><input class="tags-add-input"/>
        <input class="asset-tag-input"/><input class="asset-tags-edit-input"/>`;
      document.body.appendChild(host);
      const page_ = getComputedStyle(document.body).backgroundColor;
      const out = [];
      for (const el of host.children) {
        out.push({ cls: el.className, bg: getComputedStyle(el).backgroundColor });
      }
      host.remove();
      return { page: page_, out };
    });
    const pageL = lum(dark.page);
    // a translucent overlay reports rgba(0,0,0,.05) — that is fine; a SOLID
    // near-black (#222) is the bug. Only opaque colors are compared.
    const offenders = dark.out.filter((c) => !c.bg.startsWith('rgba') && lum(c.bg) < pageL - 60);
    ok(offenders.length === 0,
      `[${theme}] no control renders as a dark box on the light page${offenders.length ? ' — ' + offenders.map((o) => o.cls).join(', ') : ''}`);
  }
  await setTheme('dark');

  /* ── B19: the Element Templates selected row has a VISIBLE highlight ───── */
  const selBg = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="template-element-item selected">x</div>';
    document.body.appendChild(host);
    const bg = getComputedStyle(host.firstElementChild).backgroundColor;
    host.remove();
    return bg;
  });
  const selAlpha = selBg.startsWith('rgba') ? Number(selBg.split(',')[3]) : 1;
  ok(selAlpha !== 0 && selBg !== 'transparent',
    `the selected Element Templates row paints a highlight (${selBg})`);

  /* ── U350: deleting a template ASKS, through the house dialog ──────────── */
  const usesNativeConfirm = await page.evaluate(async () => {
    const src = await fetch('/src/components/TemplateSelectDialog.tsx').then((r) => r.text());
    return /[^.\w]confirm\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, ''));
  });
  ok(!usesNativeConfirm,
    'TemplateSelectDialog no longer calls native confirm() (a Promise is always truthy in Tauri)');

} catch (e) {
  fail++;
  console.log('PROBE ERROR:', String(e).split('\n')[0]);
} finally {
  console.log(`\ncheck-v701: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
