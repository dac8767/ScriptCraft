/**
 * SpellCheckPanel (v0.64) — Spelling & Grammar as a dockable Project window.
 *
 * SpellCheckModal now has a real `embedded` mode (no floating shell, no
 * absolute positioning, no Close button), so the panel simply renders it.
 * Opening the panel also sets spellModalOpen so the checker actually runs;
 * ScreenplayEditor's global floating instance is suppressed while the panel
 * is mounted, so only ONE instance exists at a time (v0.63 rendered both,
 * producing the empty window + cut-off duplicate).
 */
import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import SpellCheckModal from './SpellCheckModal';

interface SpellCheckPanelProps {
  editor: Editor | null;
}

export default function SpellCheckPanel({ editor }: SpellCheckPanelProps) {
  const setSpellModalOpen = useEditorStore((s) => s.setSpellModalOpen);
  const setSpellPanelMounted = useEditorStore((s) => s.setSpellPanelMounted);

  useEffect(() => {
    setSpellPanelMounted(true);
    setSpellModalOpen(true);      // run the check while the panel is open
    return () => {
      setSpellPanelMounted(false);
      setSpellModalOpen(false);
    };
  }, [setSpellModalOpen, setSpellPanelMounted]);

  if (!editor) {
    return <div className="fs-panel-empty">Open a script to run spelling &amp; grammar.</div>;
  }
  return <SpellCheckModal editor={editor} embedded onClose={() => {}} />;
}
