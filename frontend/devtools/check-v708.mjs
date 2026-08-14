// check-v708.mjs — the four v7.06 bugs Derek filed at 6:45 PM.
//   1  FADE IN: left-aligned in the Pages tool, not just the editor
//   2  the cast dropdown offers real characters only — no ghost, no half-typed cue
//   3  inserting above a scene heading leaves the heading a scene heading
//   4  Transition is offered on an empty page
import { launch, boot, openTool, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);

// ── 1. FADE IN: in the Pages tool ────────────────────────────────────
console.log('\n1. FADE IN: alignment');
await page.evaluate(() => {
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: [
      { type: 'transition', content: [{ type: 'text', text: 'FADE IN:' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. ROOM - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'A person stands there quietly.' }] },
      { type: 'character', content: [{ type: 'text', text: 'SCRIPTCRAFT' }] },
      { type: 'dialogue', content: [{ type: 'text', text: 'Unlocked, but no release published yet.' }] },
      { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'EXT. STREET - NIGHT' }] },
      { type: 'action', content: [{ type: 'text', text: 'Rain falls on the empty pavement.' }] },
    ],
  });
});
await settle(page);

const ed = await page.evaluate(() => [...document.querySelectorAll('.ProseMirror .transition')]
  .map((e) => ({ t: e.textContent.trim(), a: getComputedStyle(e).textAlign })));
ok('editor: FADE IN: left', ed.find((x) => x.t === 'FADE IN:')?.a === 'left', JSON.stringify(ed));
ok('editor: CUT TO: right', ed.find((x) => x.t === 'CUT TO:')?.a === 'right', JSON.stringify(ed));

await openTool(page, 'Pages');
await settle(page);
await page.waitForSelector('.page-thumb-el', { timeout: 8000 });
const th = await page.evaluate(() => [...document.querySelectorAll('.page-thumb-el')]
  .filter((e) => /FADE IN|CUT TO/.test(e.textContent))
  .map((e) => ({ t: e.textContent.trim(), a: getComputedStyle(e).textAlign, pl: getComputedStyle(e).paddingLeft })));
ok('pages tool: FADE IN: left', th.find((x) => x.t === 'FADE IN:')?.a === 'left', JSON.stringify(th));
ok('pages tool: FADE IN: no transition indent', th.find((x) => x.t === 'FADE IN:')?.pl === '0px', JSON.stringify(th));
ok('pages tool: CUT TO: still right', th.find((x) => x.t === 'CUT TO:')?.a === 'right', JSON.stringify(th));

// Preview mode uses the editor's own DOM — prove it stayed correct there too.
await page.evaluate(() => window.__scStore.getState().setPreviewMode(true));
await settle(page);
const pv = await page.evaluate(() => [...document.querySelectorAll('.ProseMirror .transition')]
  .map((e) => ({ t: e.textContent.trim(), a: getComputedStyle(e).textAlign })));
ok('preview: FADE IN: left', pv.find((x) => x.t === 'FADE IN:')?.a === 'left', JSON.stringify(pv));
await page.evaluate(() => window.__scStore.getState().setPreviewMode(false));
await settle(page);

// ── 2. the cast dropdown ─────────────────────────────────────────────
console.log('\n2. character auto-suggest');
// The ghost: a cue typed, abandoned, then deleted. The old cache kept it.
await page.evaluate(() => {
  const e = window.__scEditor;
  const doc = e.state.doc;
  let pos = null;
  doc.descendants((n, p) => { if (n.type.name === 'character' && pos === null) pos = p; return true; });
  // type a half-name into the existing cue, leave it, then restore the name
  e.chain().focus().setTextSelection(pos + 1).run();
  e.commands.command(({ tr, state }) => {
    const n = state.doc.nodeAt(pos);
    tr.replaceWith(pos + 1, pos + 1 + n.content.size, state.schema.text('S'));
    return true;
  });
});
await settle(page);
// leave the cue so the old code would harvest "S"
await page.evaluate(() => {
  const e = window.__scEditor;
  let dpos = null;
  e.state.doc.descendants((n, p) => { if (n.type.name === 'dialogue' && dpos === null) dpos = p; return true; });
  e.chain().focus().setTextSelection(dpos + 1).run();
});
await settle(page);
// put the real name back
await page.evaluate(() => {
  const e = window.__scEditor;
  let pos = null;
  e.state.doc.descendants((n, p) => { if (n.type.name === 'character' && pos === null) pos = p; return true; });
  e.commands.command(({ tr, state }) => {
    const n = state.doc.nodeAt(pos);
    tr.replaceWith(pos + 1, pos + 1 + n.content.size, state.schema.text('SCRIPTCRAFT'));
    return true;
  });
});
await settle(page);
// now open a NEW, empty cue and read the dropdown
await page.evaluate(() => {
  const e = window.__scEditor;
  const end = e.state.doc.content.size;
  e.chain().focus().setTextSelection(end - 1).run();
  e.commands.insertContentAt(end, { type: 'character' });
  e.chain().focus().setTextSelection(e.state.doc.content.size - 1).run();
});
await settle(page);
await page.waitForTimeout(400);
const sug = await page.evaluate(() => [...document.querySelectorAll('.character-autocomplete-item')].map((e) => e.textContent.trim()));
ok('dropdown lists the real cast', sug.includes('SCRIPTCRAFT'), JSON.stringify(sug));
ok('dropdown has no ghost "S"', !sug.includes('S'), JSON.stringify(sug));
ok('dropdown has exactly one entry per name', new Set(sug).size === sug.length && sug.length === 1, JSON.stringify(sug));

// half-typed cue must not suggest itself
await page.keyboard.type('SC');
await settle(page);
await page.waitForTimeout(300);
const sug2 = await page.evaluate(() => [...document.querySelectorAll('.character-autocomplete-item')].map((e) => e.textContent.trim()));
ok('typing "SC" suggests SCRIPTCRAFT only', sug2.length === 1 && sug2[0] === 'SCRIPTCRAFT', JSON.stringify(sug2));

// ── 3. adding a line above a scene heading ───────────────────────────
console.log('\n3. insert above a scene heading');
await page.evaluate(() => {
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: [
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. DOWNLOAD SCRIPTCRAFT' }] },
      { type: 'action', content: [{ type: 'text', text: 'Invite code: UNLOCK' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. INVITE ONLY' }] },
      { type: 'action', content: [{ type: 'text', text: 'ScriptCraft is currently available by invite only.' }] },
    ],
  });
});
await settle(page);
const secondHeading = await page.evaluate(() => {
  let seen = 0, found = null;
  window.__scEditor.state.doc.descendants((n, p) => {
    if (n.type.name === 'sceneHeading') { if (seen === 1) found = p; seen++; }
    return true;
  });
  return found;
});
await page.evaluate((pos) => window.__scEditor.chain().focus().setTextSelection(pos + 1).run(), secondHeading);
await settle(page);
await page.keyboard.press('Enter');
await settle(page);
const caretIn = await page.evaluate(() => window.__scEditor.state.selection.$from.parent.type.name);
ok('caret lands on the new blank line', caretIn === 'action', caretIn);
await page.keyboard.type('Some new action.');
await settle(page);
const after = await page.evaluate(() => {
  const out = [];
  window.__scEditor.state.doc.forEach((n) => out.push(`${n.type.name}|${n.textContent}`));
  return out;
});
ok('typed text goes into the new line', after.includes('action|Some new action.'), JSON.stringify(after));
ok('the heading below keeps its type', after.includes('sceneHeading|INT. INVITE ONLY'), JSON.stringify(after));
const bold = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.ProseMirror .scene-heading')].find((e) => e.textContent.includes('INVITE ONLY'));
  return el ? getComputedStyle(el).fontWeight : 'missing';
});
ok('the heading below is still bold', bold === '700' || bold === 'bold', bold);
/* The split and the type fix-up share one transaction now, so the Enter is
   ONE undo step. (Typed characters are their own steps — the editor's own
   history grouping, untouched here — so this presses Enter and undoes that
   alone.) */
await page.evaluate(() => {
  window.__scEditor.commands.setContent({
    type: 'doc',
    content: [
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. ROOM - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'Rain.' }] },
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. INVITE ONLY' }] },
    ],
  });
});
await settle(page);
const h2 = await page.evaluate(() => {
  let seen = 0, found = null;
  window.__scEditor.state.doc.descendants((n, p) => {
    if (n.type.name === 'sceneHeading') { if (seen === 1) found = p; seen++; }
    return true;
  });
  return found;
});
await page.evaluate((pos) => window.__scEditor.chain().focus().setTextSelection(pos + 1).run(), h2);
await page.keyboard.press('Enter');
await settle(page);
await page.keyboard.press('Control+z');
await settle(page);
const undone = await page.evaluate(() => {
  const out = [];
  window.__scEditor.state.doc.forEach((n) => out.push(n.type.name));
  return out.join(',');
});
ok('Enter is a single undo step', undone === 'sceneHeading,action,sceneHeading', undone);

// ── 4. Transition on an empty page ───────────────────────────────────
console.log('\n4. Transition on an empty page');
await page.evaluate(() => {
  window.__scEditor.commands.setContent({ type: 'doc', content: [{ type: 'action' }] });
  window.__scEditor.chain().focus().setTextSelection(1).run();
});
await settle(page);
await page.keyboard.press('Enter');   // empty line ⇒ element picker
await settle(page);
await page.waitForSelector('.element-picker', { timeout: 8000 });
const items = await page.evaluate(() => [...document.querySelectorAll('.element-picker-label')].map((e) => e.textContent.trim()));
ok('picker offers Transition on an empty page', items.includes('Transition'), JSON.stringify(items));
ok('picker still hides Parenthetical there', !items.includes('Parenthetical'), JSON.stringify(items));
ok('picker still offers Scene Heading', items.includes('Scene Heading'), JSON.stringify(items));

console.log(`\ncheck-v708: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
