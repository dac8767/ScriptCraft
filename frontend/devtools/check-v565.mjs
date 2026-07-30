// devtools/check-v565.mjs — Derek's exact repro, driven through the real
// view with real keystrokes: type lowercase mid-heading, the letters land
// uppercased IN PLACE and the caret advances one step per letter instead of
// jumping to the heading's end.
import { launch, boot, seedScript, openTool, SCENES_4 } from './driver.mjs';
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
const { browser, page } = await launch();
await boot(page);
await seedScript(page, SCENES_4);

// Build Derek's heading and park the caret mid-word (after "SPACE C")
await page.evaluate(() => {
  const ed = window.__scEditor;
  ed.commands.setContent({
    type: 'doc',
    content: [
      { type: 'sceneHeading', content: [{ type: 'text', text: 'EXT. SPACE C - BELKADIN' }] },
      { type: 'action', content: [{ type: 'text', text: 'He waits.' }] },
    ],
  });
  ed.chain().focus().setTextSelection(1 + 'EXT. SPACE C'.length).run();
});
await page.keyboard.type('ruiser', { delay: 40 });
await page.waitForTimeout(300);
const after = await page.evaluate(() => ({
  heading: window.__scEditor.state.doc.firstChild.textContent,
  head: window.__scEditor.state.selection.head,
}));
ok(after.heading === 'EXT. SPACE CRUISER - BELKADIN',
  `lowercase typing lands uppercased in place (${after.heading})`);
ok(after.head === 1 + 'EXT. SPACE CRUISER'.length,
  `the caret advanced letter by letter, no jump to the end (head ${after.head})`);

// and the word can be finished/continued mid-heading repeatedly
await page.keyboard.type('s', { delay: 40 });
await page.waitForTimeout(200);
const again = await page.evaluate(() => ({
  heading: window.__scEditor.state.doc.firstChild.textContent,
  head: window.__scEditor.state.selection.head,
}));
ok(again.heading === 'EXT. SPACE CRUISERS - BELKADIN' && again.head === 1 + 'EXT. SPACE CRUISERS'.length,
  'continued typing stays anchored');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
