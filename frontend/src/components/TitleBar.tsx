/**
 * v3.09, Derek: the Quick Access Toolbar — Word-style, in the macOS titlebar
 * row. The native titlebar becomes an OVERLAY (tauri.conf: titleBarStyle
 * "Overlay" + hiddenTitle), so the traffic lights float over this bar; we
 * pad past them, draw the QAT buttons (Save / Undo / Redo, Word's default
 * set) and the document title where macOS used to draw it.
 *
 * The whole strip is a Tauri drag region — grab anywhere to move the
 * window, double-click to zoom, exactly like a real titlebar. Buttons stop
 * propagation implicitly: drag regions ignore interactive children.
 *
 * macOS desktop only: overlay titlebars don't exist on Windows/Linux
 * (decorations stay native there), and the web build has no titlebar at all.
 */
import React from 'react';
import { FaSave, FaUndo, FaRedo } from 'react-icons/fa';
import type { Editor } from '@tiptap/react';
import { useEditorStore, smartUndo, smartRedo } from '../stores/editorStore';
import { isDesktopTauri } from '../services/platform';
import { openInBrowser, DONATE_URL } from '../services/external';

const isMacLike = /mac/i.test(navigator.platform || navigator.userAgent);

/** One place decides whether the overlay titlebar row exists. The DEV-only
 *  localStorage flag lets the bar be previewed in a browser (there is no
 *  overlay titlebar to verify against outside the Mac app). */
export const showTitleBar = (): boolean =>
  (isDesktopTauri() && isMacLike)
  || (import.meta.env.DEV && localStorage.getItem('scriptcraft:devTitlebar') === '1');

const TitleBar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  const title = useEditorStore((s) => s.documentTitle);
  if (!showTitleBar()) return null;
  return (
    <div className="fs-titlebar" data-tauri-drag-region>
      {/* left inset clears the traffic lights */}
      <div className="fs-titlebar-qat">
        <button
          className="fs-titlebar-btn"
          title="Save"
          onClick={() => window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'save' }))}
        ><FaSave /></button>
        <button
          className="fs-titlebar-btn"
          title="Undo"
          onClick={() => smartUndo(editor)}
        ><FaUndo /></button>
        <button
          className="fs-titlebar-btn"
          title="Redo"
          onClick={() => smartRedo(editor)}
        ><FaRedo /></button>
      </div>
      <div className="fs-titlebar-title" data-tauri-drag-region>{title}</div>
      {/* right counterweight keeps the title centered against the QAT.
          v3.12, Derek: it carries the Buy Me a Coffee button at the far
          right — the widget's look (yellow #FFDD00 pill, white cup, black
          script text) drawn locally, since the real embed is a remote CDN
          script the app must not load. */}
      <div className="fs-titlebar-right" data-tauri-drag-region>
        <button
          className="fs-bmc-btn"
          title="Buy me a coffee"
          onClick={() => openInBrowser(DONATE_URL)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {/* to-go cup: lid + tapered body, BMC-style. Cup color follows
                Derek's data-coffee-color (v3.13: #FFDD00). */}
            <path d="M3 4.5 h10 l-0.4 2 h-9.2 Z" fill="#000" />
            <path d="M3.9 7 h8.2 l-1 6.2 a1 1 0 0 1 -1 0.8 h-4.2 a1 1 0 0 1 -1 -0.8 Z" fill="#FFDD00" stroke="#000" strokeWidth="0.8" />
            <path d="M4.6 3 c0 -0.8 6.8 -0.8 6.8 0 l0.2 1.5 h-7.2 Z" fill="#FFDD00" stroke="#000" strokeWidth="0.8" />
          </svg>
          <span>Buy me a coffee</span>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
