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
          (v3.15: the donate button moved into About ScriptCraft.) */}
      <div className="fs-titlebar-balance" data-tauri-drag-region />
    </div>
  );
};

export default TitleBar;
