/* check-v768 — three rows off the feedback queue.
 *
 *   "the grayed options are not showing the helper text like I asked"
 *   "move the restore and backup button to the same row as the lock button"
 *   "readd the ai writer tool"
 *
 * THE FIRST ONE IS A REPORT I ALREADY CLOSED ONCE. v7.58 found a real bug —
 * `.menu-dropdown-item.disabled { pointer-events: none }` meant the browser
 * never delivered the hover a native tooltip needs — fixed it, verified it in
 * a browser, and called it done. Derek was looking at the NATIVE macOS menu,
 * which nativeMenuSync builds through Tauri, and Tauri's menu API has no
 * tooltip field at all. The in-app menu I fixed was never the menu he uses.
 *
 * So the reason rides in the LABEL now, through one shared builder both menus
 * call. The assertions below check the in-app menu in a browser AND the text
 * nativeMenuSync would hand Tauri — the second is the half that was missing,
 * and the half that was actually broken.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

/* ── the reason reaches BOTH menus ───────────────────────────────────────── */
console.log('\na greyed item says why, in a menu that cannot show hover text');
const sync = src('menu/nativeMenuSync.ts');
/* The native builder must run every label through the shared builder. Missing
   it on ONE of the four paths is how the plain MenuItem — the path every
   disabled Production item takes — stayed silent while the others worked. */
const nativeLabelUses = (sync.match(/text: nativeLabel\(it\)/g) || []).length;
ok('every native item path builds its label the shared way', nativeLabelUses >= 3,
  `${nativeLabelUses} of the submenu/check/plain paths`);
ok('…and none of them still bypasses it with a bare label',
  !/text: nativeText\(it\.label\)[\s\S]{0,80}enabled: !it\.disabled/.test(sync), '');
/* Tauri rebuilds the native menu only when the signature changes. A note that
   is not in the signature is a note that never appears until something else
   happens to change. */
ok('a note change rebuilds the native menu', /labelWithNote\(it\.label, it\.note\)/.test(sync), '');

/* The builder lives outside both menus. Putting it in MenuBar and importing it
   from the sync pulled the whole component graph — and the zustand store it
   creates — into nativeMenuSync's node test, which stopped collecting. */
const shared = src('menu/menuLabel.ts');
ok('the shared builder holds no React', !/from 'react'|<[A-Z]/.test(shared), '');
ok('…and both menus import it', /from '\.\/menuLabel'/.test(sync)
  && /from '\.\.\/menu\/menuLabel'/.test(src('components/MenuBar.tsx')), '');

/* Every disabled item that explains itself on hover must also explain itself
   in the label, or the native menu is silent for that one. */
const menubar = src('components/MenuBar.tsx');
const withTooltip = [...menubar.matchAll(/tooltip: (?!undefined)[^,\n]+/g)].length;
const withNote = [...menubar.matchAll(/note: (?!undefined)[^,\n]+/g)].length;
ok('every hover reason has a label reason beside it', withNote >= withTooltip,
  `${withTooltip} tooltips, ${withNote} notes`);

const { browser, page } = await launch({ width: 1500, height: 950 });
await boot(page);
await settle(page);

const production = await page.evaluate(async () => {
  /* v7.69 hid the Production menu ("hide the entire production menu for now"),
     and the in-development items this section is about live in it. The toggle
     that hides it is the same Developer one that already gated Lock Pages, so
     the mechanism is tested where the items actually are rather than moved to
     a menu that happens to have a greyed item today. */
  window.__scStore.getState().setShowUnreleasedTools(true);
  await new Promise((r) => setTimeout(r, 400));
  [...document.querySelectorAll('.menu-item')].find((m) => m.textContent.trim() === 'Production')?.click();
  await new Promise((r) => setTimeout(r, 500));
  return [...document.querySelectorAll('.menu-dropdown-item')].map((el) => ({
    text: el.textContent.trim(),
    disabled: el.classList.contains('disabled'),
    title: el.getAttribute('title'),
  }));
});
const greyed = production.filter((i) => i.disabled);
ok('the Production menu has greyed items to explain', greyed.length >= 2,
  JSON.stringify(production.map((i) => i.text)));
/* The label, read off the screen. This is the assertion that would have caught
   the original report: it does not care whether a tooltip exists. */
ok('…and each one says its reason in the label',
  greyed.every((i) => /\(.+\)/.test(i.text)), JSON.stringify(greyed.map((i) => i.text)));
ok('…including the two still being built',
  greyed.filter((i) => /in development/.test(i.text)).length >= 2,
  JSON.stringify(greyed.map((i) => i.text)));
/* The hover text stays: it says more than the label has room for. */
ok('…while the fuller hover text is still there',
  greyed.every((i) => i.title && i.title.length > 0), JSON.stringify(greyed.map((i) => i.title)));
/* An ENABLED item must not grow a parenthetical — the note is a reason for
   being dead, not decoration. */
ok('and a live item is left alone',
  production.filter((i) => !i.disabled).every((i) => !/\(in development\)|\(format locked\)/.test(i.text)),
  JSON.stringify(production.filter((i) => !i.disabled).map((i) => i.text).slice(0, 6)));

/* ── the two window-wide buttons share a row ─────────────────────────────── */
console.log('\nBackup & Restore sits on the lock\'s row');
const row = await page.evaluate(async () => {
  window.__scStore.getState().setCustomizeOpen?.(true);
  document.querySelector('.toolbar-customize-btn, [title*="Customize"]')?.click();
  await new Promise((r) => setTimeout(r, 900));
  const find = (re) => [...document.querySelectorAll('.fs-customize-footer button, .dialog-footer button')]
    .find((b) => re.test(b.textContent));
  const lock = find(/Lock All|Locked/);
  const backup = find(/Backup/);
  if (!lock || !backup) return { lock: !!lock, backup: !!backup };
  const a = lock.getBoundingClientRect(); const b = backup.getBoundingClientRect();
  return {
    lock: true, backup: true,
    sameRow: Math.abs(a.top - b.top) < 4,
    inFooter: !!backup.closest('.fs-customize-footer'),
  };
});
ok('the Customize window opens with both buttons', row.lock && row.backup, JSON.stringify(row));
ok('…on the same row', row.sameRow === true, JSON.stringify(row));
ok('…which is the footer, not the tab rail', row.inFooter === true, JSON.stringify(row));
/* It used to live under the tabs, and that rule went with it. */
ok('the tab-rail placement is gone',
  !/fs-customize-globals-row/.test(src('components/CustomizePanelsDialog.tsx')), '');

/* ── AI Writer is back, and stays back ──────────────────────────────────── */
console.log('\nAI Writer is back');
const ai = await page.evaluate(async () => {
  const st = window.__scStore.getState();
  const mod = await import('/src/components/ToolDock.tsx');
  const inRegistry = mod.ALL_TOOLS.some((t) => t.id === 'aiwriter');
  st.openTool('aiwriter');
  await new Promise((r) => setTimeout(r, 700));
  const body = document.querySelector('.fs-aiwriter');
  return {
    inRegistry,
    rendered: !!body,
    says: body?.textContent?.trim().slice(0, 40) ?? null,
    /* The styles came back with it — the component alone would render an
       unstyled paragraph. */
    centred: body ? getComputedStyle(body).justifyContent : null,
  };
});
ok('it is in the tool registry', ai.inRegistry === true, JSON.stringify(ai));
ok('…it opens and renders', ai.rendered === true, JSON.stringify(ai));
ok('…saying what it always said', /Write your own damn script/.test(ai.says || ''), JSON.stringify(ai.says));
ok('…with its stylesheet restored too', ai.centred === 'center', JSON.stringify(ai.centred));

/* THE one that makes it stick. The panel list is rebuilt from PERSISTED state,
   so a leftover `aiwriter: null` heir would strip it out again on every load —
   addable from Customize, gone next launch. */
const store = src('stores/editorStore.ts');
ok('and no retirement entry is still dropping it',
  !/aiwriter:\s*null/.test(store), '');

await browser.close();
console.log(`\ncheck-v768: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
