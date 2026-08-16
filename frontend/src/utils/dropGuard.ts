/**
 * installDropGuard — the webview must never navigate to a dropped file.
 *
 * v7.26, Derek: "dragging an image onto the asset manager glitches the app
 * heavily", with a screenshot of ScriptCraft replaced by a white page and the
 * image he dragged sitting alone at the top of it.
 *
 * That is not a glitch, and it is not the Asset Manager. It is WebKit doing
 * what a browser does with a file dropped on a document: NAVIGATE TO IT. The
 * app was not misdrawn — it was gone, unloaded, and every unsaved change with
 * it. (`dragDropEnabled: false` in tauri.conf is correct and stays: Tauri's
 * native handler would swallow the drop and the app's own drop zones would
 * never see a file. It does mean the web side owns this.)
 *
 * The Asset Manager's zone always did preventDefault. What did not exist was a
 * guard for everywhere ELSE — and "everywhere else" includes the few pixels
 * around that zone, which is exactly where a drag aimed at a target lands when
 * it misses. So the fix belongs at the window, once, not in a list of zones
 * that would have to stay complete forever.
 *
 * Both events are required. Without `dragover` prevented the drop is never
 * dispatched to the document at all — the engine takes it and navigates, and a
 * `drop` listener that never runs looks exactly like a fix that works.
 *
 * Real drop zones are unaffected: their handlers run on the target first, and
 * this only stops the default that would have followed.
 */

/** Install once, at app start. Returns the uninstaller. */
export function installDropGuard(target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const stop = (e: Event) => { e.preventDefault(); };
  target.addEventListener('dragover', stop);
  target.addEventListener('drop', stop);
  return () => {
    target.removeEventListener('dragover', stop);
    target.removeEventListener('drop', stop);
  };
}
