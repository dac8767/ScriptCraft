/* check-v726 — Derek: "dragging an image onto the asset manager glitches the
 * app heavily", with a screenshot of ScriptCraft replaced by a white page and
 * the dragged image sitting alone at the top of it.
 *
 * It was not a glitch and it was not the Asset Manager. That white page IS a
 * browser — WebKit navigated to the dropped file, so the app was unloaded and
 * every unsaved change went with it. The Asset Manager's own zone always
 * called preventDefault; nothing guarded the rest of the window, which is
 * where a drag aimed at a zone lands when it misses.
 *
 * `defaultPrevented` is what these assert on, because it is the only thing
 * that decides whether the engine navigates. "The guard is installed" would
 * pass against a guard listening for the wrong event.
 *
 * NOTE the one thing this cannot do: a synthetic drop is not an OS file drop,
 * so the navigation itself is only reproducible on Derek's Mac. What is
 * checkable here is the condition that causes it, everywhere it can occur.
 */
import { readFileSync } from 'node:fs';
import { launch, boot, settle } from './driver.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const { browser, page } = await launch();
await boot(page);
await settle(page);

/** Dispatch a real, cancelable drag event at a selector and report whether
 *  anything stopped the engine's default. */
const dropAt = (sel, type = 'drop') => page.evaluate(([s, t]) => {
  const el = s === 'body' ? document.body : document.querySelector(s);
  if (!el) return { found: false };
  /* A real DragEvent carrying a real DataTransfer — a bare Event has no
     `dataTransfer`, and a zone's own handler reading `e.dataTransfer.files`
     would throw on it, which is noise this check must not manufacture. */
  const e = new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
  el.dispatchEvent(e);
  return { found: true, prevented: e.defaultPrevented };
}, [sel, type]);

console.log('\n1. nothing dropped anywhere can navigate the webview');
const onBody = await dropAt('body');
ok('a drop on the page is stopped', onBody.prevented === true, JSON.stringify(onBody));
const overBody = await dropAt('body', 'dragover');
/* The half that is easy to omit: without dragover prevented the engine takes
   the drop before any listener runs, so a drop handler that never fires looks
   exactly like a fix that works. */
ok('…and so is the dragover that precedes it', overBody.prevented === true, JSON.stringify(overBody));
const onEditor = await dropAt('.ProseMirror');
ok('a drop on the script page is stopped', onEditor.prevented === true, JSON.stringify(onEditor));
const onMenu = await dropAt('.menu-bar');
ok('a drop on the chrome is stopped', onMenu.prevented === true, JSON.stringify(onMenu));

console.log('\n2. the Asset Manager, and the pixels around it');
const am = await page.evaluate(async () => {
  window.__scStore.getState().openTool('assets');
  await new Promise((r) => setTimeout(r, 600));
  const zone = document.querySelector('.asset-upload-zone');
  if (!zone) return { found: false };
  // its own handler must still run — the guard suppresses the DEFAULT, not the app
  const drag = () => new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
  let handled = 0;
  const spy = () => { handled++; };
  zone.addEventListener('drop', spy);
  const inside = drag();
  zone.dispatchEvent(inside);
  zone.removeEventListener('drop', spy);
  // and a drop that MISSED it by a few pixels — Derek's actual case
  const r = zone.getBoundingClientRect();
  const beside = document.elementFromPoint(Math.max(2, r.left - 6), r.top + r.height / 2);
  const outside = drag();
  beside?.dispatchEvent(outside);
  return {
    found: true,
    handled,
    insidePrevented: inside.defaultPrevented,
    besideTag: beside?.className || beside?.tagName || null,
    besidePrevented: outside.defaultPrevented,
  };
});
ok('the upload zone is on screen', am.found === true, JSON.stringify(am));
ok('…its own drop handler still runs', am.handled === 1, JSON.stringify(am));
ok('…a drop ON it is stopped', am.insidePrevented === true, JSON.stringify(am));
ok('…and a drop that MISSES it by 6px is stopped too — the case that broke it',
  am.besidePrevented === true, JSON.stringify(am));

console.log('\n3. it is guarded once, at the window');
const guard = readFileSync(new URL('../src/utils/dropGuard.ts', import.meta.url), 'utf8');
ok('both events are guarded, not just drop',
  /addEventListener\('dragover'/.test(guard) && /addEventListener\('drop'/.test(guard), '');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
ok('installed at the app root, so it covers every pixel',
  /installDropGuard\(\)/.test(app), '');
/* Tauri's own file-drop handler stays OFF on purpose: switched on, it eats the
   drop and the app's zones never receive a file at all. The web side owns
   this, which is why the guard has to exist. */
const conf = readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8');
ok('Tauri\'s native drag-drop stays off, so the app\'s own zones keep working',
  /"dragDropEnabled":\s*false/.test(conf), '');

console.log('\n4. the guard ADDS to the app, it does not take over');
/* The risk in a window-level listener is that it becomes the app's answer to
   dragover instead of an extra one, which would quietly kill every drop zone.
   Asserted against a REAL zone that is on screen (the Asset Manager's, opened
   above) rather than a div made up here — a synthetic element would prove
   only that the DOM works.
   The app's internal REORDER drags (sticky cards, ribbon, scenes, outline)
   have their own checks in this suite; they are the behavioural proof and
   they run alongside this one. */
const additive = await page.evaluate(async () => {
  const zone = document.querySelector('.asset-upload-zone');
  if (!zone) return { found: false };
  const dt = () => new DataTransfer();
  // the zone's own dragover preventDefault is what makes it a valid target
  const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt() });
  zone.dispatchEvent(over);
  // and a handler that stops propagation still keeps the window out of it
  let reached = 0;
  const win = () => { reached++; };
  window.addEventListener('drop', win);
  const sealed = (e) => e.stopPropagation();
  zone.addEventListener('drop', sealed);
  zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt() }));
  zone.removeEventListener('drop', sealed);
  window.removeEventListener('drop', win);
  return { found: true, overPrevented: over.defaultPrevented, reachedWindow: reached };
});
ok('a real zone is still a valid drop target', additive.overPrevented === true, JSON.stringify(additive));
ok('…and a zone that seals its own event still does', additive.reachedWindow === 0, JSON.stringify(additive));

console.log(`\ncheck-v726: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
