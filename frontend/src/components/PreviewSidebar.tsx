/**
 * PreviewSidebar — the Preview mode option rail, replicating the old app:
 *   TEMPLATE OPTIONS — scene-header presentation (live in the preview, and
 *                      carried into Print since printing uses this same view)
 *   INCLUDE…         — which working annotations show in the preview
 *   EXPORT           — Save As PDF / .fountain / Final Draft / Plain text
 */
import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { MarkupIcon } from './markupIcons';
import { downloadFDX } from '../utils/fdxExporter';
import { downloadFountain, exportFountain } from '../utils/fountainExporter';
import { exportPDF } from '../utils/pdfExporter';
import { showToast } from './Toast';

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pv-check">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function PreviewSidebar({ editor }: { editor: Editor | null }) {
  const { previewOpts, setPreviewOpt, documentTitle, pageLayout } = useEditorStore();
  const toggleAnnotIcon = useEditorStore((s) => s.togglePreviewAnnotationIcon);
  const presets = useEditorStore((s) => s.markupPresets);
  /* The CURRENT annotation types — the preset list, one row per distinct
     icon (a color variant of the same icon is the same TYPE here). */
  const annotationTypes = useMemo(() => {
    const seen = new Set<string>();
    const out: { icon: string; color: string; label: string }[] = [];
    for (const p of presets) {
      if (seen.has(p.icon)) continue;
      seen.add(p.icon);
      const label = p.icon.startsWith('emoji:')
        ? p.icon.slice(6)
        : p.icon.charAt(0).toUpperCase() + p.icon.slice(1);
      out.push({ icon: p.icon, color: p.color, label });
    }
    return out;
  }, [presets]);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: string, fn: () => Promise<void>) => {
    if (!editor || busy) return;
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      console.error(`${kind} export failed:`, err);
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = () => run('pdf', async () => {
    const s = useEditorStore.getState();
    await exportPDF(editor!.getJSON(), documentTitle, pageLayout, {
      // v6.09: the Include list is annotations-only now — scene numbers in
      // the PDF follow the editor's own scene-number toggle.
      sceneNumbersVisible: s.sceneNumbersVisible,
      documentTitle: s.documentTitle,
      revisionColor: s.revisionMode ? s.revisionColor : '',
    });
  });

  const exportFdx = () => run('fdx', async () => {
    const s = useEditorStore.getState();
    await downloadFDX(editor!.getJSON(), documentTitle, s.characterProfiles, s.tagCategories, s.tags, s.beats, s.beatColumns, s.pageLayout);
  });

  const exportFtn = () => run('fountain', async () => {
    await downloadFountain(editor!.getJSON(), documentTitle);
  });

  const exportTxt = () => run('txt', async () => {
    const text = exportFountain(editor!.getJSON());
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle || 'Untitled'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  return (
    <div className="preview-sidebar">
      <div className="pv-section-title">Script Options</div>
      <Check label="Double-space scene headers" value={previewOpts.doubleSpaceHeaders} onChange={(v) => setPreviewOpt('doubleSpaceHeaders', v)} />
      <Check label="Bold scene headers" value={previewOpts.boldHeaders} onChange={(v) => setPreviewOpt('boldHeaders', v)} />
      <Check label="Underline scene headers" value={previewOpts.underlineHeaders} onChange={(v) => setPreviewOpt('underlineHeaders', v)} />
      <p className="pv-hint">Spec convention: plain headers, no scene numbers, right edge ragged.</p>

      {/* v6.09, Derek: the old include toggles (sections, notes, scene
          numbers, to-dos) are gone — working notes never show in Preview,
          and scene numbers follow the editor's own toggle. What CAN be
          included is annotations, by type: the CURRENT types from
          Customize ▸ Annotations (one row per distinct icon). */}
      <div className="pv-section-title">Include Annotations…</div>
      {annotationTypes.map((t) => (
        <label key={t.icon} className="pv-check pv-annot-check">
          <span className="pv-annot-name">
            <span className="pv-annot-icon"><MarkupIcon icon={t.icon} color={t.color} /></span>
            {t.label}
          </span>
          <input
            type="checkbox"
            checked={previewOpts.annotationIcons.includes(t.icon)}
            onChange={() => toggleAnnotIcon(t.icon)}
          />
        </label>
      ))}
      {annotationTypes.length === 0 && (
        <p className="pv-hint">No annotation types yet — add them in Customize&nbsp;▸&nbsp;Annotations.</p>
      )}

      <div className="pv-section-title">Export</div>
      <button className="pv-export-primary" onClick={exportPdf} disabled={!!busy}>
        {busy === 'pdf' ? 'Exporting…' : 'Save As PDF'}
      </button>
      <button className="pv-export-btn" onClick={exportFtn} disabled={!!busy}>
        {busy === 'fountain' ? 'Exporting…' : '.fountain'}
      </button>
      <button className="pv-export-btn" onClick={exportFdx} disabled={!!busy}>
        {busy === 'fdx' ? 'Exporting…' : 'Final Draft (.fdx)'}
      </button>
      <button className="pv-export-btn" onClick={exportTxt} disabled={!!busy}>
        {busy === 'txt' ? 'Exporting…' : 'Plain text (.txt)'}
      </button>
      <p className="pv-hint">
        Template options above also carry into Print (⌘P) while Preview is open.
        Some .fdx apps reject unusual characters; re-type any smart quotes if an
        import fails.
      </p>

      <button
        className="pv-exit-btn pv-exit-bottom"
        onClick={() => useEditorStore.getState().setPreviewMode(false)}
      >Exit Preview</button>
    </div>
  );
}
