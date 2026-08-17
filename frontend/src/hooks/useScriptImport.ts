/**
 * useScriptImport — bringing a script in from another tool.
 *
 * v7.44: lifted out of MenuBar verbatim. Four doors (this app's own files,
 * Fountain/FDX/text, Word, PDF) that all end in the same place: replace the
 * open document and reset the per-script session state around it. Keeping them
 * together is the point — they share the reset, and a fifth importer added
 * next to only three of them is how one door forgets to clear something.
 *
 * WHAT IT NEEDS FROM THE CALLER, and why each is a parameter rather than a
 * store read:
 *   · `editor` — the store does not own it.
 *   · `confirmOrRun` — the unsaved-changes guard (useSaveGuard). Import
 *     REPLACES the document, so every door goes through it. Passing it in
 *     rather than calling the guard here keeps one guard per screen instead
 *     of a second copy with its own pending action.
 *   · `clearTrackChanges` — shared with the Track Changes toggle, so it stays
 *     owned by the caller rather than duplicated here.
 *
 * The Word door is deliberately two-step: `handleImportDocx` only raises the
 * best-effort warning, and `handleConfirmDocxImport` is what actually runs —
 * through the guard, then the importer. Word's format is close enough to
 * mislead and far enough to lose things, and saying so before the file picker
 * is cheaper than explaining it after.
 */
import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore, DEFAULT_TAG_CATEGORIES } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { showToast } from '../components/Toast';
import { openTextFile, openBinaryFile } from '../utils/fileOps';
import { SCRIPT_EXTS, isScriptExt, SCRIPT_FORMAT_LABEL } from '../utils/scriptFileExt';
import { parseFountain } from '../utils/fountainParser';
import { parseFDXFull } from '../utils/fdxParser';
import { parseDocx } from '../utils/docxImporter';
import { parseOdraft } from '../utils/odraftFormat';
import { clearEditorHistory } from '../editor/clearHistory';

export function useScriptImport(
  editor: Editor | null,
  confirmOrRun: (action: () => void) => void,
  clearTrackChanges: () => void,
) {
  const { setCurrentProject, setCurrentScriptId, setScripts } = useProjectStore();

  /** The best-effort warning shown before Word's file picker. */
  const [docxImportWarningOpen, setDocxImportWarningOpen] = useState(false);

  const handleImport = useCallback(async () => {
    if (!editor) return;
    try {
      /* v7.21: SCRIPT_EXTS is .script plus everything the app used to write —
         `odraft` (through v7.20) and `json` (the v1.16–v7.17 folder copies,
         whose last extension is what a dialog matches on). A file this app
         wrote is a file this app opens; none of these ever expire. */
      const result = await openTextFile([
        { name: 'Script', extensions: ['fountain', 'fdx', 'txt', ...SCRIPT_EXTS] },
      ]);
      if (!result) return;

      const { name, content: text } = result;
      const ext = name.split('.').pop()?.toLowerCase();

      // Clear previous document state before importing
      clearTrackChanges();
      const store = useEditorStore.getState();
      store.setBeats([]);
      store.setBeatColumns([]);
      store.resetOutlineTabs();   // v2.30: start over on a single tab
      store.setBeatArrangeMode('auto');
      store.setNotes([]);
      store.setTags([]);
      store.setTagCategories([...DEFAULT_TAG_CATEGORIES]);
      store.setCharacterProfiles([]);
      store.setCharacterRelationships([]);
      store.setReferredTags({});
      store.setScanResults(null);
      store.setScenes([]);

      let doc;
      if (ext === 'fdx') {
        const parsed = parseFDXFull(text);
        doc = parsed.doc;
        if (parsed.pageLayout) {
          store.setPageLayout({
            ...store.pageLayout,
            ...parsed.pageLayout,
          });
        }
        // Import beats from Outline elements
        if (parsed.beats.length > 0) {
          store.setBeats(parsed.beats);
          if (parsed.beatColumns.length > 0) {
            store.setBeatColumns(parsed.beatColumns);
          }
        }
        // Import character profiles from CastList + CharacterHighlighting
        if (parsed.castList.length > 0 || parsed.characterHighlighting.length > 0) {
          const highlightMap = new Map(parsed.characterHighlighting.map((h) => [h.name.toUpperCase(), h]));
          for (const member of parsed.castList) {
            const hl = highlightMap.get(member.name.toUpperCase());
            store.upsertCharacterProfile(member.name, {
              description: member.description,
              color: hl?.color || '',
              highlighted: hl?.highlighted || false,
            });
            highlightMap.delete(member.name.toUpperCase());
          }
          // Remaining highlights without cast entries
          for (const [, hl] of highlightMap) {
            store.upsertCharacterProfile(hl.name, { color: hl.color, highlighted: hl.highlighted });
          }
        }
      } else if (isScriptExt(ext)) {
        try {
          const parsed = parseOdraft(text);
          doc = parsed.content;
          if (parsed.meta.title) {
            store.setDocumentTitle(parsed.meta.title);
          }
        } catch (parseErr) {
          showToast(`Invalid ScriptCraft file: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`, 'error');
          return;
        }
      } else {
        doc = parseFountain(text);
      }
      editor.commands.setContent(doc, true);
      clearEditorHistory(editor);

      // Open as unsaved document — user can save later via Cmd+S
      const scriptTitle = isScriptExt(ext) ? (store.documentTitle || name.replace(/\.\w+$/, '') || 'Untitled') : (name.replace(/\.\w+$/, '') || 'Untitled');
      store.setDocumentTitle(scriptTitle);
      setCurrentProject(null);
      setCurrentScriptId(null);
      setScripts([]);
      // Track that this is an imported document so Save As can warn the user
      // that the save goes to ScriptCraft's library, not back to the source file.
      const fmtLabel = ext === 'fdx' ? 'Final Draft (.fdx)'
        : ext === 'fountain' ? 'Fountain (.fountain)'
        : isScriptExt(ext) ? SCRIPT_FORMAT_LABEL
        : ext ? `.${ext}` : 'imported file';
      store.setImportedSource({ name, format: fmtLabel });
    } catch (err) {
      console.error('Import failed:', err);
      showToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  // Core Word import: open binary file → parse → apply.  The pre-import
  // warning dialog and the unsaved-changes guard wrap this.
  const handleImportDocxCore = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openBinaryFile([
        { name: 'Word Document', extensions: ['docx'] },
      ]);
      if (!result) return;

      const { name, content } = result;
      const parsed = await parseDocx(content);

      // Clear previous document state
      clearTrackChanges();
      const store = useEditorStore.getState();
      store.setBeats([]);
      store.setBeatColumns([]);
      store.resetOutlineTabs();   // v2.30: start over on a single tab
      store.setBeatArrangeMode('auto');
      store.setNotes([]);
      store.setTags([]);
      store.setTagCategories([...DEFAULT_TAG_CATEGORIES]);
      store.setCharacterProfiles([]);
      store.setCharacterRelationships([]);
      store.setReferredTags({});
      store.setScanResults(null);
      store.setScenes([]);

      editor.commands.setContent(parsed.doc, true);
      clearEditorHistory(editor);

      const scriptTitle = parsed.scriptTitle || name.replace(/\.\w+$/, '') || 'Untitled';
      store.setDocumentTitle(scriptTitle);
      setCurrentProject(null);
      setCurrentScriptId(null);
      setScripts([]);
      store.setImportedSource({ name, format: 'Microsoft Word (.docx)' });

      if (parsed.warnings.length > 0) {
        const summary = parsed.ambiguousCount > 0
          ? `Imported with ${parsed.ambiguousCount} paragraph(s) auto-classified as Action — review the script.`
          : `Imported with ${parsed.warnings.length} note(s). See console for details.`;
        showToast(summary, 'info');
        for (const w of parsed.warnings) console.warn('[Word Import]', w);
      } else {
        showToast('Word document imported.', 'info');
      }
    } catch (err) {
      console.error('Word import failed:', err);
      showToast(`Word import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  // Wraps handleImportDocxCore with the best-effort warning dialog.
  const handleImportDocx = useCallback(() => {
    setDocxImportWarningOpen(true);
  }, []);

  const handleConfirmDocxImport = useCallback(() => {
    setDocxImportWarningOpen(false);
    // Run through unsaved-changes guard, then through the core importer.
    confirmOrRun(() => { handleImportDocxCore(); });
  }, [confirmOrRun, handleImportDocxCore]);

  // v2.79: PDF import — reconstructs elements from the PDF's text layer by
  // indentation. pdf.js is heavy, so the parser loads lazily on first use.
  const handleImportPdfCore = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openBinaryFile([
        { name: 'PDF', extensions: ['pdf'] },
      ]);
      if (!result) return;

      const { name, content } = result;
      const { parsePdfScreenplay } = await import('../utils/pdfImporter');
      const parsed = await parsePdfScreenplay(content);

      // Clear previous document state
      clearTrackChanges();
      const store = useEditorStore.getState();
      store.setBeats([]);
      store.setBeatColumns([]);
      store.resetOutlineTabs();
      store.setBeatArrangeMode('auto');
      store.setNotes([]);
      store.setTags([]);
      store.setTagCategories([...DEFAULT_TAG_CATEGORIES]);
      store.setCharacterProfiles([]);
      store.setCharacterRelationships([]);
      store.setReferredTags({});
      store.setScanResults(null);
      store.setScenes([]);

      editor.commands.setContent(parsed.doc, true);
      clearEditorHistory(editor);

      const scriptTitle = name.replace(/\.\w+$/, '') || 'Untitled';
      store.setDocumentTitle(scriptTitle);
      setCurrentProject(null);
      setCurrentScriptId(null);
      setScripts([]);
      store.setImportedSource({ name, format: 'PDF (.pdf)' });

      if (parsed.warnings.length > 0) {
        for (const w of parsed.warnings) showToast(w, 'info');
      } else {
        showToast(`PDF imported (${parsed.pages} page${parsed.pages === 1 ? '' : 's'}). A PDF stores print layout, not elements — worth a review pass.`, 'info');
      }
    } catch (err) {
      console.error('PDF import failed:', err);
      showToast(`PDF import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [editor, clearTrackChanges, setCurrentProject, setCurrentScriptId, setScripts]);

  const handleImportPdf = useCallback(() => {
    confirmOrRun(() => { void handleImportPdfCore(); });
  }, [confirmOrRun, handleImportPdfCore]);

  return {
    handleImport,
    handleImportDocx,
    handleImportPdf,
    /** The Word warning dialog's own state — it is part of that door. */
    docxImportWarningOpen,
    setDocxImportWarningOpen,
    handleConfirmDocxImport,
  };
}
