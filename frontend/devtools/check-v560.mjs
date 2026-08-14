// devtools/check-v560.mjs — Derek's report: "clicking the context field or
// opening the popped-out tool unselects my text." The PM selection must
// survive both, and the target must stay VISIBLY painted (the decoration)
// through panel focus and floating-window opens. Plus the new declutter eye:
// same button as the Scrapbook's, hides every other sidebar tool.
import { launch, boot, seedScript, openTool, SCENES_4, settle, installAddon } from './driver.mjs';
const SHOTS = '/tmp/claude-0/-home-user-ScriptCraft/e4449e3e-5198-5997-9e57-bd93d663743c/scratchpad';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);
await installAddon(page, 'action-rewrite');   // v7.05: Rewrite ships as an add-on

// select a range inside the first action paragraph
const sel = await page.evaluate(() => {
  const ed = window.__scEditor;
  let from = -1;
  ed.state.doc.forEach((node, offset) => {
    if (from === -1 && node.type.name === 'action') from = offset + 3;
  });
  const to = from + 18;
  ed.chain().focus().setTextSelection({ from, to }).run();
  return { from, to };
});

await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-tool', { timeout: 8000 });
await page.waitForTimeout(500);
const afterOpen = await page.evaluate(() => ({
  sel: { from: window.__scEditor.state.selection.from, to: window.__scEditor.state.selection.to },
  hl: document.querySelectorAll('.ProseMirror .rw-target-hl').length,
  target: (document.querySelector('.rw-target')?.textContent ?? ''),
}));
ok(afterOpen.sel.from === sel.from && afterOpen.sel.to === sel.to,
  'opening the tool leaves the editor selection untouched');
ok(afterOpen.hl > 0 && afterOpen.target.includes('Target: 1 action paragraph'),
  `the target is painted in the script (${afterOpen.hl} span[s]) and described`);

// ── the reported case: focus the note field — the highlight must stay ────
await page.click('.rw-note');
await settle(page);
const afterFocus = await page.evaluate(() => ({
  sel: { from: window.__scEditor.state.selection.from, to: window.__scEditor.state.selection.to },
  hl: document.querySelectorAll('.ProseMirror .rw-target-hl').length,
  editorFocused: document.activeElement?.closest('.ProseMirror') != null,
  noteFocused: document.activeElement?.classList.contains('rw-note'),
}));
ok(afterFocus.noteFocused && !afterFocus.editorFocused,
  'focus really moved into the note field (the blur case)');
ok(afterFocus.sel.from === sel.from && afterFocus.sel.to === sel.to && afterFocus.hl > 0,
  'selection state AND the painted target survive the blur');
await page.screenshot({ path: `${SHOTS}/v560-blur-highlight.png` });

// ── popped-out window: open floating, selection + highlight survive ──────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.closeTool('rewrite');
});
await settle(page);
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.setToolMode('rewrite', 'floating');
  s.openTool('rewrite');
});
await page.waitForTimeout(600);
const floating = await page.evaluate(() => ({
  sel: { from: window.__scEditor.state.selection.from, to: window.__scEditor.state.selection.to },
  hl: document.querySelectorAll('.ProseMirror .rw-target-hl').length,
  win: !!document.querySelector('.rw-tool'),
}));
ok(floating.win && floating.sel.from === sel.from && floating.sel.to === sel.to && floating.hl > 0,
  'popped-out open keeps the selection and the painted target');

// caret into the scene heading → target clears (live follow)
await page.evaluate(() => window.__scEditor.chain().focus().setTextSelection(2).run());
await page.waitForTimeout(500);
ok(await page.evaluate(() => document.querySelectorAll('.ProseMirror .rw-target-hl').length) === 0,
  'moving the caret off action clears the painted target');

// ── the declutter eye (Scrapbook parity) ─────────────────────────────────
await page.evaluate(() => {
  const s = window.__scStore.getState();
  s.closeTool('rewrite');
  s.setToolMode('rewrite', 'docked');
});
await settle(page);
await openTool(page, 'Action Rewrite');
await page.waitForSelector('.rw-tool', { timeout: 8000 });
const before = await page.evaluate(() => ({
  right: document.querySelectorAll('.tool-dock-right .tool-dock-item').length,
  left: !!document.querySelector('.tool-dock-left'),
  eye: !!document.querySelector('.fs-nb-declutter'),
}));
ok(before.eye && before.right > 1 && before.left,
  `declutter eye present; both sidebars populated (${before.right} right rows)`);
await page.click('.fs-nb-declutter');
await settle(page);
const decluttered = await page.evaluate(() => ({
  right: [...document.querySelectorAll('.tool-dock-right .tool-dock-item')].map((e) => e.textContent.trim()),
  left: !!document.querySelector('.tool-dock-left'),
}));
ok(decluttered.right.length === 1 && decluttered.right[0].includes('Action Rewrite') && !decluttered.left,
  'declutter: only Action Rewrite remains, the other sidebar hides');
await page.screenshot({ path: `${SHOTS}/v560-declutter.png` });
await page.click('.fs-nb-declutter');
await settle(page);
const restored = await page.evaluate(() => ({
  right: document.querySelectorAll('.tool-dock-right .tool-dock-item').length,
  left: !!document.querySelector('.tool-dock-left'),
}));
ok(restored.right === before.right && restored.left,
  'toggling back restores both sidebars exactly');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
