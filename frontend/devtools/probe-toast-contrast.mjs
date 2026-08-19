/* Measure the real contrast of every toast variant in every theme.
   Renders the actual .fs-toast classes inside the running app so the tokens
   resolve exactly as they do on screen, then computes the WCAG ratio. */
import { launch, boot, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1400, height: 900 });
await boot(page);
await settle(page);

const themes = await page.evaluate(() => {
  const out = new Set(['']);
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules || []) {
      const m = /\[data-theme="([^"]+)"\]/.exec(r.selectorText || '');
      if (m) out.add(m[1]);
    }
  }
  return [...out];
});

const rows = await page.evaluate((themeList) => {
  const lum = (c) => {
    const f = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  /* getComputedStyle returns TWO formats here: `rgb(224, 224, 224)` in 0-255,
     and `color(srgb 0.914 0.954 1)` in 0-1 — color-mix() resolves to the
     latter. Reading the second as if it were the first makes every mixed
     background come out near-black, which inverts every verdict this probe
     produces. It did, on the first run. */
  const parse = (s) => {
    const n = (s.match(/[\d.]+/g) || []).slice(s.startsWith('color(') ? 0 : 0, 3).map(Number);
    return /^color\(/.test(s) ? n.map((v) => v * 255) : n;
  };
  const ratio = (a, b) => {
    const [L1, L2] = [lum(parse(a)), lum(parse(b))].sort((x, y) => y - x);
    return (L1 + 0.05) / (L2 + 0.05);
  };

  const host = document.createElement('div');
  host.className = 'fs-toast-stack';
  document.body.appendChild(host);
  const results = [];
  for (const theme of themeList) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    for (const kind of ['info', 'success', 'error']) {
      const el = document.createElement('div');
      el.className = `fs-toast fs-toast--${kind}`;
      el.textContent = 'This window only appears in the side panel';
      host.appendChild(el);
      const cs = getComputedStyle(el);
      results.push({
        theme: theme || '(default dark)',
        kind,
        fg: cs.color,
        bg: cs.backgroundColor,
        ratio: +ratio(cs.color, cs.backgroundColor).toFixed(2),
      });
      el.remove();
    }
  }
  host.remove();
  return results;
}, themes);

const bad = rows.filter((r) => r.ratio < 4.5);
console.log(`${rows.length} toast/theme combinations measured (WCAG AA for this size = 4.5:1)\n`);
for (const r of rows) {
  const flag = r.ratio < 3 ? 'UNREADABLE' : r.ratio < 4.5 ? 'weak      ' : 'ok        ';
  console.log(`  ${flag} ${String(r.ratio).padStart(6)}:1  ${r.kind.padEnd(8)} ${r.theme.padEnd(16)} fg=${r.fg.padEnd(20)} bg=${r.bg}`);
}
console.log(`\n${bad.length} of ${rows.length} below AA; ${rows.filter((r) => r.ratio < 3).length} effectively unreadable.`);
await browser.close();
