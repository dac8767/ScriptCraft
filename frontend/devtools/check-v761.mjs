/* check-v761 — Derek: "in the footer of the entire app, add a new feature to
 * the right of the script name that shows the date and time of the last save.
 * this can be either auto save or manual save, but indicate which."
 *
 * WHAT IS DRIVEN HERE, AND WHAT ISN'T — said plainly, because the gap matters.
 *
 * The readout is driven for real: it appears, it says which kind, it scopes to
 * the script it belongs to, and it disappears when it should. Every one of
 * those goes through markSaved, which IS the function all five save paths call.
 *
 * What CANNOT be driven in this environment is a genuine end-to-end save —
 * there is no backend here, so no project or script is ever loaded, ⌘S opens
 * Save As instead of saving, and the two autosave effects never even arm
 * (`if (!editor || !currentProject || !currentScriptId) return`). A check that
 * pressed ⌘S and asserted a timestamp would pass against a completely
 * unwired feature.
 *
 * So the WIRING is guaranteed by the type system instead, which is stronger
 * than anything this file could assert: `setSaveStatus` no longer accepts
 * 'saved' at all. A save path that marks itself saved without stamping the
 * time and kind is a COMPILE ERROR, not a silent omission — verified by
 * making one, which yields TS2345 on 'saved'. That is why there is no
 * source-scanning assertion here: tsc already refuses the failure mode.
 *
 * The pure formatting (today shows the time alone; any other day leads with
 * the date, through the app-wide registry) is unit-tested in
 * utils/dateFormat.test.ts, including the midnight and year boundaries.
 */
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch({ width: 1500, height: 900 });
await boot(page);
await settle(page);

/** The readout, plus where it sits relative to the script name. */
const read = () => page.evaluate(() => {
  const el = document.querySelector('.status-lastsave');
  const name = document.querySelector('.status-project');
  const st = window.__scStore.getState();
  const box = (e) => e?.getBoundingClientRect();
  return {
    text: el?.textContent?.trim() ?? null,
    title: el?.getAttribute('title') ?? null,
    /* Derek said "to the right of the script name" — so measure that, rather
       than trusting that being later in the DOM means being to the right. */
    rightOfName: el && name ? Math.round(box(el).left) > Math.round(box(name).right) : null,
    sameRow: el && name ? Math.abs(Math.round(box(el).top) - Math.round(box(name).top)) <= 2 : null,
    inFooter: el ? Boolean(el.closest('.status-bar .status-left')) : null,
    muted: el ? getComputedStyle(el).color : null,
    nameColor: name ? getComputedStyle(name).color : null,
    kind: st.lastSaveKind,
  };
});

const mark = (kind, sid) => page.evaluate(([k, s]) => {
  window.__scStore.getState().markSaved(k, s);
  return new Promise((r) => setTimeout(r, 350));
}, [kind, sid]);

/* Before anything has been saved there IS no last save, and inventing one —
   the load time, say — would be a readout that lies about what happened. */
console.log('\nnothing is claimed before the first save');
const fresh = await read();
ok('the footer shows no save time yet', fresh.text === null, JSON.stringify(fresh));

console.log('\nan automatic save says so');
await mark('auto', null);
const auto = await read();
ok('the readout appears', typeof auto.text === 'string' && auto.text.length > 0, JSON.stringify(auto));
ok('…and names the kind as automatic', /^Auto-saved /.test(auto.text), JSON.stringify(auto.text));
ok('…with a time on it', /\d{1,2}[:.]\d{2}/.test(auto.text), JSON.stringify(auto.text));

console.log('\na save he asked for says THAT');
await mark('manual', null);
const manual = await read();
ok('the readout changes', manual.text !== auto.text, JSON.stringify([auto.text, manual.text]));
/* THE half of the request that is easy to drop. "Saved 11:04 PM" only reads as
   manual if you have also seen "Auto-saved" at some other moment — which is
   not indicating which, it is leaving it to be inferred from a state that is
   not on screen. Both kinds name themselves. */
ok('…and names the kind as manual', /^Manually saved /.test(manual.text), JSON.stringify(manual.text));
ok('the two kinds are distinguishable from the text alone',
  /Auto/.test(auto.text) && /Manual/i.test(manual.text)
  && auto.text.replace(/\d/g, '') !== manual.text.replace(/\d/g, ''),
  JSON.stringify([auto.text, manual.text]));
/* The tooltip carries the full date and time — the line itself stays short. */
ok('hovering gives the full date and time',
  /Last manual save — .+\d{4}/.test(manual.title || ''), JSON.stringify(manual.title));

console.log('\nit sits where he asked, and reads as a status item');
ok('inside the footer\'s left group', manual.inFooter === true, JSON.stringify(manual));
ok('…to the RIGHT of the script name', manual.rightOfName === true, JSON.stringify(manual));
ok('…on the same row', manual.sameRow === true, JSON.stringify(manual));
/* The script name is the emphasis on that line; this is secondary. If they
   painted the same, the footer would read as two titles. */
ok('…and muted rather than competing with the name',
  manual.muted !== manual.nameColor, JSON.stringify([manual.muted, manual.nameColor]));

/* A stamp belongs to ONE script. Without this, switching scripts leaves the
   previous file's save time sitting under the new file's name, which is not a
   stale readout so much as a wrong one. */
console.log('\na save time never outlives the script it belongs to');
await mark('manual', 'a-different-script');
const other = await read();
ok('a stamp from another script is not shown', other.text === null, JSON.stringify(other));
/* …but it is not DESTROYED either: switch back and it is still true. */
const backAgain = await page.evaluate(async () => {
  const st = window.__scStore.getState();
  return { kind: st.lastSaveKind, at: st.lastSavedAt, sid: st.lastSavedScriptId };
});
ok('…the stamp itself survives, it is only hidden',
  backAgain.kind === 'manual' && typeof backAgain.at === 'number',
  JSON.stringify(backAgain));

/* Today shows the time alone; another day leads with the date. Driven here as
   well as unit-tested, because the footer is where the length actually
   matters — a date on every save would double the width of this item. */
console.log('\ntoday shows a time; another day shows the date too');
await mark('auto', null);
const today = await read();
await page.evaluate(async () => {
  window.__scStore.setState({ lastSavedAt: Date.now() - 26 * 3600 * 1000 });
  await new Promise((r) => setTimeout(r, 350));
});
const yesterday = await read();
ok('today carries no date', !/\d{4}|\d{2}\/\d{2}/.test(today.text), JSON.stringify(today.text));
ok('…and yesterday does', /\d{2}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2}/.test(yesterday.text),
  JSON.stringify(yesterday.text));
ok('…and it is still the same kind, only longer',
  /^Auto-saved /.test(yesterday.text) && yesterday.text.length > today.text.length,
  JSON.stringify([today.text, yesterday.text]));

console.log(`\ncheck-v761: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
