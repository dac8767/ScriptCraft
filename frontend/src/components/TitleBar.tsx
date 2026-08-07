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
import {
  FaSave, FaRegSave, FaUndo, FaRedo, FaFolderOpen, FaFile, FaPrint, FaRegEye,
  FaFilePdf, FaSpellCheck,
} from 'react-icons/fa';
import { LuSearch } from 'react-icons/lu';
import type { Editor } from '@tiptap/react';
import { useEditorStore, smartUndo, smartRedo } from '../stores/editorStore';
import { isDesktopTauri } from '../services/platform';
import { GoalChip, useGoalWords } from './GoalsTool';

const emit = (id: string) =>
  window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: id }));

/** v3.21, Derek: the QAT is customizable (Customize > Quick Access). ONE
 *  registry — the titlebar renders from it and the dialog offers it.
 *  undo/redo run smartUndo/smartRedo (they need the editor); everything
 *  else rides the command bus, same as the menus. */
export const QAT_OPTIONS: Array<{ id: string; label: string; icon: React.ReactNode; cmd?: string }> = [
  { id: 'save', label: 'Save', icon: <FaSave />, cmd: 'save' },
  { id: 'saveAs', label: 'Save As', icon: <FaRegSave />, cmd: 'saveAs' },
  { id: 'open', label: 'Open Script', icon: <FaFolderOpen />, cmd: 'openFile' },
  { id: 'new', label: 'New Script', icon: <FaFile />, cmd: 'newScreenplay' },
  { id: 'undo', label: 'Undo', icon: <FaUndo /> },
  { id: 'redo', label: 'Redo', icon: <FaRedo /> },
  { id: 'print', label: 'Print', icon: <FaPrint />, cmd: 'print' },
  { id: 'preview', label: 'Preview', icon: <FaRegEye />, cmd: 'preview' },
  { id: 'exportPDF', label: 'Export PDF', icon: <FaFilePdf />, cmd: 'exportPDF' },
  { id: 'spellCheck', label: 'Spelling & Grammar', icon: <FaSpellCheck />, cmd: 'spellCheck' },
  { id: 'find', label: 'Find & Replace', icon: <LuSearch />, cmd: 'find' },
];
export const QAT_BY_ID = Object.fromEntries(QAT_OPTIONS.map((o) => [o.id, o]));

/** v3.39, Derek: the QAT can carry dividers and spacers between its buttons —
 *  stored as prefixed ids (unique so several can coexist) alongside the
 *  option ids. One place recognizes them, read by both the titlebar and
 *  Customize > Quick Access. */
export const isQatDivider = (id: string) => id.startsWith('qdiv:');
export const isQatSpacer = (id: string) => id.startsWith('qsp:');

const isMacLike = /mac/i.test(navigator.platform || navigator.userAgent);

/** One place decides whether the overlay titlebar row exists. The DEV-only
 *  localStorage flag lets the bar be previewed in a browser (there is no
 *  overlay titlebar to verify against outside the Mac app). */
export const showTitleBar = (): boolean =>
  (isDesktopTauri() && isMacLike)
  || (import.meta.env.DEV && localStorage.getItem('scriptcraft:devTitlebar') === '1');

const TitleBar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  const title = useEditorStore((s) => s.documentTitle);
  const qatItems = useEditorStore((s) => s.qatItems);
  /* v6.29, Derek: "the app header is the same line with the quick action
     toolbar and the script name" — Show in: Header parks the goal chip
     HERE, absolute at the bar's right edge so the title's centering
     counterweight is untouched. (The stored value keeps the name
     'toolbar' — persisted.) */
  const goalShowIn = useEditorStore((s) => s.goalShowIn);
  const goalWords = useGoalWords(editor);
  if (!showTitleBar()) return null;
  return (
    <div className="fs-titlebar">
      {/* v4.22, Derek: ONE full-bar drag layer behind everything, instead of the
          per-element drag attributes that left dead zones (buttons, gaps, the
          strip above/below the centered content) so only a sliver dragged. The
          QAT/title/balance are pointer-events:none and sit above it, so clicks
          fall through to this layer and drag anywhere; only the buttons
          re-enable pointer events and click. Left inset clears the traffic
          lights. */}
      <div className="fs-titlebar-drag" data-tauri-drag-region aria-hidden="true" />
      <div className="fs-titlebar-qat">
        {qatItems.map((id) => {
          if (isQatDivider(id)) return <span key={id} className="fs-titlebar-sep" />;
          if (isQatSpacer(id)) return <span key={id} className="fs-titlebar-spacer" />;
          const o = QAT_BY_ID[id];
          if (!o) return null;
          const run = id === 'undo' ? () => smartUndo(editor)
            : id === 'redo' ? () => smartRedo(editor)
              : () => emit(o.cmd!);
          return (
            /* data-qat: hook for the per-glyph optical size correction —
               see .fs-titlebar-btn[data-qat] in screenplay.css (task #140). */
            <button key={id} className="fs-titlebar-btn" data-qat={id} title={o.label} onClick={run}>
              {o.icon}
            </button>
          );
        })}
      </div>
      <div className="fs-titlebar-title">{title}</div>
      {/* right counterweight keeps the title centered against the QAT.
          (v3.15: the donate button moved into About ScriptCraft.) */}
      <div className="fs-titlebar-balance" />
      {goalShowIn === 'toolbar' && (
        <span className="fs-titlebar-goal"><GoalChip variant="toolbar" words={goalWords} /></span>
      )}
    </div>
  );
};

export default TitleBar;
