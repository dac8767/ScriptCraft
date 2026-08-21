/* check-v766 — the outline bar's scale bar, and Derek's correction to v7.65.
 *
 *   v7.65: "the coloring of the scale bar for the outline toolbar is
 *           backwards… the section between the adjustment knobs is supposed to
 *           be the light part, and the rest of the bar is supposed to be the
 *           dark part"                            (Premiere, attached)
 *   v7.66: "Make sure the outline toolbar adjustment bar color fits the color
 *           theme."
 *   v7.69: "the scroll bar in the outline toolbar (which is currently blue)
 *           should be a light gray (exact shade should come from the theme)"
 *
 * THREE passes, and each one corrected the last. v7.65 got the order right and
 * reached for --fd-text-muted, a READING colour, so the thumb became the
 * brightest band in the bar. "Fits the color theme" I then read as "wear the
 * accent", and made it blue. It is a GREY — mixed from the theme's own ink and
 * chrome, so the shade is the theme's without the bar being coloured.
 *
 * This file holds all three asks at once, which is the only way they stay
 * held: satisfying any one alone is what produced each of the other two.
 *
 * EVERY ASSERTION HERE COMPOSITES ALPHA FIRST. The track was
 * rgba(255,255,255,.04) — a 4% white veil over the chrome, not white. Read as
 * an opaque colour it measures luminance 1, and the first version of this
 * measurement reported nine healthy themes when the truth was twelve broken
 * ones. devtools/probe-navbar.mjs prints the same numbers with the colours
 * attached when this fails.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1400, height: 900 });
await boot(page);
await settle(page);

const rows = await page.evaluate(() => {
  const rgba = (s) => {
    const n = (s.match(/[\d.]+/g) || []).map(Number);
    const c = /^color\(/.test(s) ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3);
    return { c, a: n.length > 3 ? n[3] : 1 };
  };
  const over = (fg, bg) => {
    const f = rgba(fg); const b = rgba(bg);
    return f.c.map((v, i) => v * f.a + b.c[i] * (1 - f.a));
  };
  const lumOf = (c) => {
    const f = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return +(0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]).toFixed(3);
  };
  const hue = (c) => {
    const [r, g, b] = c.map((v) => v / 255);
    const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
    if (mx - mn < 0.02) return null;                 // effectively neutral
    let h;
    if (mx === r) h = ((g - b) / (mx - mn)) % 6;
    else if (mx === g) h = (b - r) / (mx - mn) + 2;
    else h = (r - g) / (mx - mn) + 4;
    return ((h * 60) + 360) % 360;
  };
  /* Saturation, 0 = grey. v7.69 measures this instead of hue distance: Derek's
     ask is "a light gray (exact shade should come from the theme)", and a grey
     HAS no meaningful hue to compare. Some themes' ink and accent share a hue
     anyway (gruvbox is warm in both), so a hue gap could not tell a grey bar
     from a coloured one there. */
  const sat = (c) => {
    const mx = Math.max(...c); const mn = Math.min(...c);
    return mx === 0 ? 0 : +((mx - mn) / mx).toFixed(3);
  };
  const hueGap = (a, b) => {
    const ha = hue(a); const hb = hue(b);
    if (ha === null || hb === null) return ha === hb ? 0 : 999;
    const d = Math.abs(ha - hb);
    return Math.round(Math.min(d, 360 - d));
  };
  const shadowColor = (el) =>
    /(rgba?\([^)]*\)|color\([^)]*\))/.exec(getComputedStyle(el).boxShadow)?.[1] ?? null;

  const themes = new Set(['']);
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules || []) {
      const m = /\[data-theme="([^"]+)"\]/.exec(r.selectorText || '');
      if (m) themes.add(m[1]);
    }
  }

  const host = document.createElement('div');
  host.innerHTML = '<div class="fs-ob-beat"></div>'
    + '<div class="fs-ob-nav"><div class="fs-ob-nav-thumb">'
    + '<div class="fs-ob-nav-handle fs-ob-nav-handle-l"></div></div></div>';
  host.style.cssText = 'position:fixed;top:-999px;left:0;width:400px;background:var(--fd-toolbar-bg)';
  document.body.appendChild(host);
  const was = document.documentElement.getAttribute('data-theme');
  const out = [];
  for (const theme of themes) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');

    const chromeBg = getComputedStyle(host).backgroundColor;
    const navEl = host.querySelector('.fs-ob-nav');
    const thumbEl = host.querySelector('.fs-ob-nav-thumb');
    const knobEl = host.querySelector('.fs-ob-nav-handle');

    const trackRgb = over(getComputedStyle(navEl).backgroundColor, chromeBg);
    const thumbRgb = over(getComputedStyle(thumbEl).backgroundColor, `rgb(${trackRgb.join(',')})`);
    const knobRgb = over(getComputedStyle(knobEl).backgroundColor, `rgb(${thumbRgb.join(',')})`);
    const ring = shadowColor(knobEl);
    const lip = shadowColor(navEl);
    const beatRgb = over(getComputedStyle(host.querySelector('.fs-ob-beat')).backgroundColor, chromeBg);

    const probe = document.createElement('span');
    probe.style.cssText = 'color: var(--fd-accent); position:absolute';
    host.appendChild(probe);
    const accentRgb = rgba(getComputedStyle(probe).color).c;
    probe.remove();

    out.push({
      theme: theme || 'default',
      chrome: lumOf(rgba(chromeBg).c),
      track: lumOf(trackRgb),
      thumb: lumOf(thumbRgb),
      knob: lumOf(knobRgb),
      ring: ring ? lumOf(over(ring, `rgb(${thumbRgb.join(',')})`)) : lumOf(thumbRgb),
      lip: lip ? lumOf(over(lip, `rgb(${trackRgb.join(',')})`)) : lumOf(trackRgb),
      beat: lumOf(beatRgb),
      thumbHueGap: hueGap(thumbRgb, accentRgb),
      thumbSat: sat(thumbRgb),
      accentSat: sat(accentRgb),
    });
  }
  host.remove();
  if (was) document.documentElement.setAttribute('data-theme', was);
  else document.documentElement.removeAttribute('data-theme');
  return out;
});

const step = (a, b) => {
  const [hi, lo] = [a, b].sort((x, y) => y - x);
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
};

console.log('\nthe scale bar, measured on every theme the app ships');
ok('every theme was measured', rows.length >= 10, `${rows.length} themes`);
/* A measurement of nothing satisfies every threshold there is. */
ok('…and each reading is a real colour, not a default',
  rows.every((r) => r.thumb > 0 && r.track >= 0 && r.beat > 0),
  JSON.stringify(rows.slice(0, 2)));

console.log('\nv7.65: the part between the knobs is the light part');
/* Derek's sentence as a test. On a dark theme the middle is light and the rest
   of the bar is dark; on a light theme the relationship inverts, which is what
   every light-mode scrollbar does. What holds either way: the thumb reads as
   the foreground. */
const backwards = rows.filter((r) => {
  const dark = r.chrome < 0.2;
  return dark ? r.thumb <= r.track : r.thumb >= r.track;
});
ok('the thumb is the foreground on every theme', backwards.length === 0, JSON.stringify(backwards));
/* A SIGN is not enough: before v7.65 nine themes already had the right sign
   and the thumb was still invisible — 0.072 against 0.067. Separated by tone,
   or by the groove's lip where the palette is too flat for tone (Solarized
   sits at 1.5x against 2.1-3.2x elsewhere). */
const flat = rows.filter((r) => step(r.thumb, r.track) < 2 && step(r.lip, r.track) < 1.5);
ok('…and separated by a step you can see, or by the groove\'s lip',
  flat.length === 0, JSON.stringify(flat.map((r) => ({
    theme: r.theme, tone: step(r.thumb, r.track), lip: step(r.lip, r.track),
  }))));
const lostKnobs = rows.filter((r) => step(r.knob, r.thumb) < 1.5 && step(r.ring, r.thumb) < 2);
ok('…with the knobs still distinct from the thumb', lostKnobs.length === 0,
  JSON.stringify(lostKnobs.map((r) => r.theme)));

console.log('\nv7.69: it is a grey, and the grey comes from the theme');
/* THE THIRD PASS, and the one that sticks. v7.65 made it a neutral grey and he
   asked for it to fit the theme; I read that as "wear the accent" and made it
   blue; v7.69: "the scroll bar … (which is currently blue) should be a light
   gray (exact shade should come from the theme)."
   So: grey, but mixed from the THEME'S OWN ink and chrome rather than picked —
   which is why gruvbox's runs warm, nord's cool, and catppuccin's carries that
   palette's lavender. Both halves of his sentence, in one rule. */
const coloured = rows.filter((r) => r.thumbSat >= r.accentSat * 0.75);
ok('the thumb reads as a grey, not as the accent', coloured.length === 0,
  JSON.stringify(coloured.map((r) => ({ theme: r.theme, thumb: r.thumbSat, accent: r.accentSat }))));
/* Measured RELATIVE to the accent, never against a fixed floor. catppuccin's
   ink is lavender-tinted, so a grey mixed from it is lavender-tinted too —
   that is the "shade comes from the theme" half, and an absolute threshold
   called that theme broken. */
ok('…and it is mixed from the theme\'s ink, not chosen',
  /--fd-nav-thumb-mix|var\(--fd-text\) \d+%, var\(--fd-toolbar-bg\)/.test(
    readFileSync(new URL('../src/styles/screenplay/21-outline-bar.css', import.meta.url), 'utf8')), '');

/* LOUDNESS, in context. "Below the ink" passes #999999 (below #e0e0e0) while
   that thumb still measured 4.3x the toolbar — body-text loudness for chrome.
   A fixed ratio to the chrome is unstable: midnight's toolbar is near-black,
   so every possible thumb scores loud against it. The Beats lane is
   --fd-accent at full strength and is the loudest thing in this bar by design,
   because it is the content. A scrollbar must not out-shout what it scrolls. */
const shouting = rows.filter((r) => {
  const dark = r.chrome < 0.2;
  const quieter = dark ? r.thumb < r.beat : r.thumb > r.beat;
  /* A MARGIN, not merely "not louder". This was written as a bare
     not-greater-than first, and a thumb of --fd-accent at FULL strength then
     passed it: the thumb WAS the Beats lane, exactly, and "not greater than"
     is true of equals. The break-test that caught it is the one where the bar
     is the right way round and the right hue and still shouts. */
  return !quieter || step(r.beat, r.thumb) < 1.2;
});
ok('…and stays a clear step quieter than the Beats lane it scrolls', shouting.length === 0,
  JSON.stringify(shouting.map((r) => ({
    theme: r.theme, thumb: r.thumb, beat: r.beat, step: step(r.beat, r.thumb),
  }))));

/* Pinned in source, because "put --fd-text-muted back" is the natural-looking
   edit that undoes v7.66 while leaving v7.65 apparently intact. */
const css = readFileSync(new URL('../src/styles/screenplay/21-outline-bar.css', import.meta.url), 'utf8');
const navRules = /\.fs-ob-nav \{[\s\S]*?\.fs-ob-nav-handle-l/.exec(css)?.[0] ?? '';
const navCode = navRules.replace(/\/\*[\s\S]*?\*\//g, '');
ok('the thumb is not built from the accent',
  !/\.fs-ob-nav-thumb \{[^}]*--fd-accent/.test(navCode), navCode.slice(0, 200));
ok('…and the groove keeps its lip', /inset 0 0 0 1px/.test(navCode), '');

await browser.close();
console.log(`\ncheck-v766: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
