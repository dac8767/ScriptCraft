/* check-v764 — four rows off the feedback queue.
 *
 *   "when it is a manual save, just have it say 'Saved'. drop the word
 *    'manually'"                                                    (v7.63)
 *   "the colors on the 'this tool only appears in the side panel' prompt
 *    makes it almost impossible to read"                            (v7.63)
 *   "the 'more formatting options' button is not needed at all. remove it"
 *                                                                   (v7.60)
 *   "move 'save current layout as' under the list of workspaces, above 'Save
 *    changes to this workspace'. It should be a button that says 'Save as New
 *    Workspace'. when clicked, a window will appear asking for the name"
 *                                                                   (v7.60)
 *
 * THE CONTRAST ONE IS NOT A ONE-MESSAGE FIX and that is the thing to keep.
 * Every toast in the app mixed its background from --fd-page-bg — the SCRIPT
 * PAGE colour, #ffffff in the base sheet and overridden by no theme, because
 * the paper stays white when the chrome goes dark — while taking its text from
 * theme-aware tokens. Measured across 12 themes × 3 kinds: 24 of 36 under
 * 3:1. Derek happened to be looking at one of them.
 *
 * So the assertion here is a MEASUREMENT, not a check that a particular
 * string is a particular colour: every toast kind, in every theme the app
 * ships, clears WCAG AA. devtools/probe-toast-contrast.mjs prints the same
 * numbers with the colours attached when this fails.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await settle(page);

/* ── the footer's save readout ───────────────────────────────────────────── */
console.log('\na save you asked for is just "Saved"');
const readSave = () => page.evaluate(() => {
  const el = document.querySelector('.status-lastsave');
  return el ? { text: el.textContent.trim(), title: el.getAttribute('title') || '' } : null;
});
const mark = (kind) => page.evaluate((k) => {
  const st = window.__scStore?.getState?.();
  st?.markSaved?.(k, st?.currentScriptId ?? null);
}, kind);

await mark('manual');
const manual = await readSave();
ok('the readout is there', manual !== null, JSON.stringify(manual));
ok('…and says "Saved", not "Manually saved"',
  /^Saved /.test(manual.text) && !/manual/i.test(manual.text), JSON.stringify(manual.text));
/* The word is gone from the LINE, not from the app: hovering still says which
   kind it was, which is where the detail belonged all along. */
ok('…while the tooltip still distinguishes the two kinds',
  /manual/i.test(manual.title), JSON.stringify(manual.title));

await mark('auto');
const auto = await readSave();
ok('an automatic save still names itself', /^Auto-saved /.test(auto.text), JSON.stringify(auto.text));
ok('…so the two are still tellable apart without reading the clock',
  auto.text.replace(/\d/g, '') !== manual.text.replace(/\d/g, ''),
  JSON.stringify([auto.text, manual.text]));

/* ── toast contrast, measured ────────────────────────────────────────────── */
console.log('\nevery toast is readable in every theme the app ships');
const contrast = await page.evaluate(() => {
  const lum = (c) => {
    const f = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  /* getComputedStyle returns rgb() in 0-255 but color-mix() resolves to
     color(srgb …) in 0-1. Reading the second as the first makes every mixed
     background come out near-black and inverts every verdict — it did, the
     first time this was measured. */
  const parse = (s) => {
    const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return /^color\(/.test(s) ? n.map((v) => v * 255) : n;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(parse(a)), lum(parse(b))].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const themes = new Set(['']);
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules || []) {
      const m = /\[data-theme="([^"]+)"\]/.exec(r.selectorText || '');
      if (m) themes.add(m[1]);
    }
  }
  const was = document.documentElement.getAttribute('data-theme');
  const host = document.createElement('div');
  host.className = 'fs-toast-stack';
  document.body.appendChild(host);
  const out = [];
  for (const theme of themes) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    for (const kind of ['info', 'success', 'error']) {
      const el = document.createElement('div');
      el.className = `fs-toast fs-toast--${kind}`;
      el.textContent = 'This window only appears in the side panel';
      host.appendChild(el);
      const cs = getComputedStyle(el);
      out.push({ theme: theme || 'default', kind, ratio: +ratio(cs.color, cs.backgroundColor).toFixed(2) });
      el.remove();
    }
  }
  host.remove();
  if (was) document.documentElement.setAttribute('data-theme', was);
  else document.documentElement.removeAttribute('data-theme');
  return out;
});

/* The probe has to have actually run — a measurement of nothing passes every
   threshold there is. */
ok('the measurement covered every theme × every toast kind',
  contrast.length >= 30 && new Set(contrast.map((c) => c.theme)).size >= 10,
  `${contrast.length} combinations, ${new Set(contrast.map((c) => c.theme)).size} themes`);
const under = contrast.filter((c) => c.ratio < 4.5);
ok('…and none of them is below WCAG AA (4.5:1 at this size)',
  under.length === 0,
  JSON.stringify(under.slice(0, 6)));
/* Named separately because this is the state Derek reported: not "a bit low"
   but text you cannot make out at all. */
ok('…and none is the near-invisible 1.2:1 he screenshotted',
  contrast.filter((c) => c.ratio < 3).length === 0,
  JSON.stringify(contrast.filter((c) => c.ratio < 3).slice(0, 6)));

/* The fix was to stop painting chrome on the page's surface. Pinned, because
   "put --fd-page-bg back" is the natural-looking edit that silently undoes
   all of the above. */
const toastCss = readFileSync(
  new URL('../src/styles/screenplay/25-confirm-outline-tabs.css', import.meta.url), 'utf8');
const toastRules = /\.fs-toast--success \{[\s\S]*?\.fs-toast--info \{[^}]*\}/.exec(toastCss)?.[0] ?? '';
ok('the toast paints on the chrome surface, not the script page',
  toastRules.includes('--fd-menu-bg') && !toastRules.includes('--fd-page-bg'),
  toastRules.slice(0, 120));

/* ── the overflow button is gone ─────────────────────────────────────────── */
console.log('\nthe ribbon\'s "More formatting options" button is gone');
const overflow = await page.evaluate(() => ({
  byTitle: document.querySelectorAll('[title="More formatting options"]').length,
  byClass: document.querySelectorAll('.toolbar-overflow-btn, .toolbar-overflow-wrap, .toolbar-overflow-menu').length,
}));
ok('no button carries its tooltip', overflow.byTitle === 0, JSON.stringify(overflow));
ok('…and none of its markup is rendered', overflow.byClass === 0, JSON.stringify(overflow));
/* It collapsed items into itself, so the machinery has to go with it or the
   bar keeps hiding controls that now have nowhere to reappear. Since v4.23
   the ribbon SCROLLS instead, which is the behaviour being relied on here. */
const toolbarSrc = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8');
ok('…along with the collapse machinery behind it',
  !/hiddenPriorities|overflowContent|setOverflowOpen/.test(toolbarSrc), '');
ok('…and the ribbon still scrolls instead of hiding things',
  await page.evaluate(() => {
    const bar = document.querySelector('.toolbar-ribbon');
    return !!bar && ['auto', 'scroll'].includes(getComputedStyle(bar).overflowX);
  }), '');
/* Non-negotiable: removing the escape hatch must not have removed the
   controls it used to hold. */
ok('…and the formatting controls themselves are all still on the bar',
  await page.evaluate(() => ['bold', 'italic', 'underline', 'fontFamily', 'fontSize']
    .every((k) => document.querySelector(`.toolbar-ribbon [data-key="${k}"]`))), '');

/* ── Workspaces: a button, in the right place, that asks ─────────────────── */
console.log('\nWorkspaces saves through a button under the list');
const ws = await page.evaluate(async () => {
  window.__scStore?.getState?.().openTool?.('workspaces');
  await new Promise((r) => setTimeout(r, 700));
  const btns = [...document.querySelectorAll('.ws-actions .ws-action-btn')].map((b) => b.textContent.trim());
  const tool = document.querySelector('.ws-tool');
  const list = tool?.querySelector('.ws-list');
  const saveAs = [...document.querySelectorAll('.ws-actions .ws-action-btn')]
    .find((b) => /Save as New Workspace/.test(b.textContent));
  return {
    btns,
    hasOldInput: !!document.querySelector('.ws-save-input, .ws-save-row'),
    belowList: !!(list && saveAs)
      && list.getBoundingClientRect().bottom <= saveAs.getBoundingClientRect().top + 1,
    enabled: saveAs ? !saveAs.disabled : null,
  };
});
ok('the tool opens', ws.btns.length > 0, JSON.stringify(ws));
ok('the old "Save current layout as…" field is gone', ws.hasOldInput === false, JSON.stringify(ws));
ok('a "Save as New Workspace" button is there', ws.btns.includes('Save as New Workspace'), JSON.stringify(ws.btns));
ok('…below the list of workspaces', ws.belowList === true, JSON.stringify(ws));
ok('…directly above "Save Changes to this Workspace"',
  ws.btns.indexOf('Save as New Workspace') === ws.btns.indexOf('Save Changes to this Workspace') - 1,
  JSON.stringify(ws.btns));
/* The one that needs a workspace already active is disabled; this one never
   is — it is how you get your first workspace. */
ok('…and is available with no workspace applied', ws.enabled === true, JSON.stringify(ws));

console.log('\nclicking it asks for a name, and saves under it');
const named = await page.evaluate(async () => {
  [...document.querySelectorAll('.ws-actions .ws-action-btn')]
    .find((b) => /Save as New Workspace/.test(b.textContent))?.click();
  await new Promise((r) => setTimeout(r, 500));
  const box = document.querySelector('.fs-confirm-box');
  const input = box?.querySelector('.fs-confirm-input');
  if (!input) return { asked: false };
  const title = box.querySelector('.fs-confirm-title')?.textContent?.trim() ?? '';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'Probe Layout');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  [...box.querySelectorAll('button')].find((b) => /^OK$/.test(b.textContent.trim()))?.click();
  await new Promise((r) => setTimeout(r, 500));
  return {
    asked: true,
    title,
    /* It is a real window with a text field, which is what the screenshot he
       attached was showing — not a rename-in-place row. */
    saved: Object.keys(window.__scStore?.getState?.().workspaces ?? {}).includes('Probe Layout'),
    listed: [...document.querySelectorAll('.ws-apply-name')].map((n) => n.textContent.trim()),
  };
});
ok('a window appears asking for the name', named.asked === true, JSON.stringify(named));
ok('…titled for what it is', /New Workspace/.test(named.title || ''), JSON.stringify(named.title));
ok('…and the workspace is saved under the name given', named.saved === true, JSON.stringify(named));
ok('…and appears in the list', (named.listed || []).includes('Probe Layout'), JSON.stringify(named.listed));

/* Never window.prompt: in Tauri it is an async IPC shim returning a Promise,
   and every Promise is truthy — so the "cancel" branch runs the save. */
const wsSrc = readFileSync(new URL('../src/components/WorkspacesTool.tsx', import.meta.url), 'utf8');
ok('it asks through promptDialog, never window.prompt',
  /promptDialog\(/.test(wsSrc) && !/\bwindow\.prompt\(|[^.]\bprompt\(/.test(wsSrc.replace(/promptDialog\(/g, '')), '');

await browser.close();
console.log(`\ncheck-v764: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
