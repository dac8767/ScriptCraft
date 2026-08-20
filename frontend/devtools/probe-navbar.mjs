/* What the outline bar's navigator actually paints, per theme.
   Derek: "the section between the adjustment knobs is supposed to be the light
   part, and the rest of the bar is supposed to be the dark part" (Premiere).
   Prints the luminance of track vs thumb vs knob so the relationship is a
   number rather than an impression. */
import { launch, boot, settle } from './driver.mjs';

const { browser, page } = await launch({ width: 1500, height: 900 });
await boot(page);
await settle(page);

const rows = await page.evaluate(() => {
  /* rgba() with an ALPHA is the whole point here: the track is
     rgba(255,255,255,.04), which is a 4% white veil over the chrome — not
     white. Reading the first three numbers and stopping makes it luminance 1
     and inverts every verdict this probe exists to give. Composite first. */
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
  const themes = new Set(['']);
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules || []) {
      const m = /\[data-theme="([^"]+)"\]/.exec(r.selectorText || '');
      if (m) themes.add(m[1]);
    }
  }
  const host = document.createElement('div');
  host.innerHTML = '<div class="fs-ob-beat"></div><div class="fs-ob-nav"><div class="fs-ob-nav-thumb">'
    + '<div class="fs-ob-nav-handle fs-ob-nav-handle-l"></div>'
    + '<div class="fs-ob-nav-handle fs-ob-nav-handle-r"></div></div></div>';
  host.style.cssText = 'position:fixed;top:0;left:0;width:400px;background:var(--fd-toolbar-bg)';
  document.body.appendChild(host);
  const out = [];
  for (const theme of themes) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    const chromeBg = getComputedStyle(host).backgroundColor;
    const trackRgb = over(getComputedStyle(host.querySelector('.fs-ob-nav')).backgroundColor, chromeBg);
    const thumbRgb = over(getComputedStyle(host.querySelector('.fs-ob-nav-thumb')).backgroundColor,
      `rgb(${trackRgb.join(',')})`);
    const knobEl = host.querySelector('.fs-ob-nav-handle');
    const knobRgb = over(getComputedStyle(knobEl).backgroundColor, `rgb(${thumbRgb.join(',')})`);
    const ringRaw = /(rgba?\([^)]*\)|color\([^)]*\))/.exec(getComputedStyle(knobEl).boxShadow)?.[1];
    const ringRgb = ringRaw ? over(ringRaw, `rgb(${thumbRgb.join(',')})`) : thumbRgb;
    /* The groove's lip — the track's own inset ring, composited over the track
       it sits on. It is what separates thumb from track where the palette is
       too flat for a tonal step. */
    const lipRaw = /(rgba?\([^)]*\)|color\([^)]*\))/.exec(
      getComputedStyle(host.querySelector('.fs-ob-nav')).boxShadow)?.[1];
    const lipRgb = lipRaw ? over(lipRaw, `rgb(${trackRgb.join(',')})`) : trackRgb;
    const inkRgb = rgba(getComputedStyle(document.documentElement).color).c;
    const probe = document.createElement('span');
    probe.style.cssText = 'color: var(--fd-text); position:absolute';
    host.appendChild(probe);
    const textRgb = rgba(getComputedStyle(probe).color).c;
    const accProbe = document.createElement('span');
    accProbe.style.cssText = 'color: var(--fd-accent); position:absolute';
    host.appendChild(accProbe);
    const accentRgb = rgba(getComputedStyle(accProbe).color).c;
    probe.remove(); accProbe.remove();
    void inkRgb;
    const hue = (c) => {
      const [r, g, b] = c.map((v) => v / 255);
      const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
      if (mx - mn < 0.02) return null;              // effectively neutral
      let h;
      if (mx === r) h = ((g - b) / (mx - mn)) % 6;
      else if (mx === g) h = (b - r) / (mx - mn) + 2;
      else h = (r - g) / (mx - mn) + 4;
      return ((h * 60) + 360) % 360;
    };
    const hueGap = (a, b) => {
      const ha = hue(a); const hb = hue(b);
      if (ha === null || hb === null) return ha === hb ? 0 : 999;
      const d = Math.abs(ha - hb);
      return Math.round(Math.min(d, 360 - d));
    };
    const beatRgb = over(getComputedStyle(host.querySelector('.fs-ob-beat')).backgroundColor, chromeBg);
    const chrome = lumOf(rgba(chromeBg).c);
    const track = lumOf(trackRgb);
    const thumb = lumOf(thumbRgb);
    const knob = lumOf(knobRgb);
    out.push({
      theme: theme || 'default', chrome, track, thumb, knob, ring: lumOf(ringRgb),
      text: lumOf(textRgb),
      beat: lumOf(beatRgb),
      thumbHueGap: hueGap(thumbRgb, accentRgb),
      lip: lumOf(lipRgb),
    });
  }
  host.remove();
  document.documentElement.removeAttribute('data-theme');
  return out;
});

console.log('luminance (0 = black, 1 = white) — the thumb must stand OUT from the track,');
console.log('and the knobs must stand out from the thumb.\n');
let wrong = 0;
for (const r of rows) {
  const dark = r.chrome < 0.2;
  /* In a dark theme the thumb should be LIGHTER than the track (Premiere);
     in a light theme the same relationship inverts — what has to hold either
     way is that the thumb reads as the foreground. */
  const step = (a, b) => {
    const [hi, lo] = [a, b].sort((x, y) => y - x);
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };
  const thumbStandsOut = (dark ? r.thumb > r.track : r.thumb < r.track)
    /* A SIGN is not enough — the old bar had the right sign in nine themes and
       was still invisible (thumb 0.072 against track 0.067). The step has to
       be one you can see. */
    /* …by TONE, or by the groove's lip where the palette is too flat for one
       (Solarized). An edge is a real separation; pretending 1.5x is visible
       would not be. */
    && (step(r.thumb, r.track) >= 2 || step(r.lip, r.track) >= 1.5);
  /* The knob separates from the thumb by tone OR by its ring, whichever the
     palette affords — see the box-shadow note in 21-outline-bar.css. */
  const knobStandsOut = step(r.knob, r.thumb) >= 1.5 || step(r.ring, r.thumb) >= 2;
  /* v7.65 follow-up, Derek: "Make sure the outline toolbar adjustment bar
     color fits the color theme." The first fix reached for --fd-text-muted,
     which is a READING colour — at near-full width the thumb became the
     brightest band in the outline bar. A chrome control must stay inside the
     chrome's tonal range (below the theme's ink) and wear the theme's hue
     rather than a neutral grey. */
  /* LOUDNESS, stated in context instead of as a ratio to the chrome.
     "Below the ink" was tried first and passes #999999 (below #e0e0e0) while
     that thumb still measured 4.29x the toolbar — body-text loudness for a
     piece of chrome. A fixed ratio to the chrome was tried next and is
     unstable: midnight's toolbar is near-black, so every possible thumb scores
     "loud" against it.
     The stable statement is about this bar's own contents. The Beats lane is
     --fd-accent at full strength and is the loudest thing in the outline bar
     BY DESIGN — it is the content. A scrollbar must not out-shout what it
     scrolls. */
  const chromeStep = step(r.thumb, r.chrome);
  /* A margin: "not louder than the content" is true of a thumb that IS the
     content, which a full-strength accent thumb passed. */
  const readsAsChrome = (dark ? r.thumb < r.beat : r.thumb > r.beat)
    && step(r.beat, r.thumb) >= 1.2;
  const wearsTheTheme = r.thumbHueGap <= 30;
  if (!thumbStandsOut || !knobStandsOut || !readsAsChrome || !wearsTheTheme) wrong++;
  console.log(`  ${thumbStandsOut ? 'ok  ' : 'BACK'} ${knobStandsOut ? 'knob ok' : 'knob LOST'}`
    + ` ${readsAsChrome ? 'chrome ' : 'TOO LOUD'} ${wearsTheTheme ? 'hue ok ' : 'hue OFF(' + r.thumbHueGap + ')'}`
    + `  ${(dark ? 'dark ' : 'light')}  ${r.theme.padEnd(16)}`
    + ` chrome=${r.chrome} thumb=${r.thumb} (${chromeStep}x chrome, ${step(r.thumb, r.track)}x track)`
    + ` knob=${step(r.knob, r.thumb)}x`);
}
console.log(`\n${wrong} of ${rows.length} themes wrong.`);
await browser.close();
