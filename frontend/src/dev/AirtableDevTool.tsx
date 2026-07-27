/**
 * Airtable dev panel (v4.95, Derek) — TEMPORARY, DEV ONLY.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  REMOVE BEFORE RELEASE. Derek: "this is just for the development process
 *  and will be removed before release."
 *
 *  What comes out together — the list is in docs/AUDIT-2026-07-26.md under
 *  "Airtable dev panel":
 *    1. this file
 *    2. the 'devairtable' entry in ToolDock's ALL_TOOLS + ToolContent, the
 *       ToolId member in editorStore, and the .fs-devairtable* rules at the
 *       end of 22-tools-extra.css
 *
 *  NOT the `https://airtable.com` in tauri.conf.json's frame-src — the
 *  SHIPPING Feedback tool frames an Airtable form and needs it. (That entry
 *  was missing until v4.95, so Feedback's form was CSP-blocked in release
 *  builds; found while checking this panel stays out of them. See the audit.)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * It cannot reach a release build on its own: ALL_TOOLS only carries the entry
 * when `import.meta.env.DEV`, so `tauri build` drops the tool from the
 * registry — and with it the dock row, the Customize entry and the Workspaces
 * entry, since all three read that one list. Verified against a production
 * bundle: this component is tree-shaken out, only the dead `case` label
 * survives.
 */
import { openInBrowser } from '../services/external';

/** Derek's interface (v4.96: repointed at the pagM2rZ… page).
 *
 *  The /embed/ form is the only one Airtable serves framed — the app's own
 *  URLs send frame-ancestors and render blank.
 *
 *  NOTE the id shape: `pag…` is an interface PAGE, which Airtable normally
 *  serves behind a login, and this webview has its own cookie jar (no session
 *  from Safari or Chrome). If the panel comes up blank or shows a sign-in
 *  wall, that's why — Share ▸ create a share link gives a `shr…` URL, which
 *  embeds with no login at all. "Open in browser" below always works. */
const SHARE_URL = 'https://airtable.com/appEkGNRsf05IzdNq/pagM2rZlfgWaox1mR';
const EMBED_URL = 'https://airtable.com/embed/appEkGNRsf05IzdNq/pagM2rZlfgWaox1mR';

export default function AirtableDevTool() {
  return (
    <div className="fs-devairtable">
      <iframe
        className="fs-devairtable-frame"
        src={EMBED_URL}
        title="Airtable (dev)"
        // The panel shows someone else's page; give it nothing of ours.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
      />
      {/* A blocked or offline embed renders an empty white box and looks
          broken, so the way out is always on screen rather than only when we
          can detect the failure (we can't — a cross-origin frame won't say). */}
      <button
        type="button"
        className="fs-devairtable-open"
        onClick={() => openInBrowser(SHARE_URL)}
      >Open in browser</button>
    </div>
  );
}
