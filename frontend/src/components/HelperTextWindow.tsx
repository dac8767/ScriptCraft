/**
 * HelperTextWindow (v6.22) — Derek: "Move the helper text section from the
 * design window into it's own window. add a button for this window under the
 * help > developer menu."
 *
 * v6.38, Derek: "give the helper text window the same format as all other
 * windows (header with full screen button and close button)". v6.42: that
 * chrome (drag, any-edge resize, fullscreen, close) moved into the shared
 * FloatingWindow shell — Settings wears it too now. Body, search and rows
 * are unchanged (HelperTextSection). Opens from Help ▸ Developer ▸ Helper
 * Text… (store flag helperTextWindowOpen — session state, like a dialog).
 */
import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useEditorStore } from '../stores/editorStore';
import { HelperTextSection, filterHelperCatalog } from './HelperTextSection';
import FloatingWindow from './FloatingWindow';

export default function HelperTextWindow() {
  const open = useEditorStore((s) => s.helperTextWindowOpen);
  const setOpen = useEditorStore((s) => s.setHelperTextWindowOpen);
  const editedCount = useEditorStore((s) => Object.keys(s.helperTextOverrides).length);
  const [query, setQuery] = useState('');

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const entries = filterHelperCatalog(q);

  return (
    <FloatingWindow
      className="htw-window"
      initial={{ w: 420, h: 620 }}
      min={{ w: 320, h: 280 }}
      onClose={() => setOpen(false)}
      title={(
        <>
          <span className="tool-window-title">Helper Text</span>
          {editedCount > 0 && <span className="dz-count">{editedCount} changed</span>}
        </>
      )}
    >
      <div className="dz-search">
        <LuSearch className="dz-search-icon" />
        <input
          className="dz-search-input"
          placeholder="Search helper text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="dz-body">
        <HelperTextSection entries={entries} />
      </div>
    </FloatingWindow>
  );
}
