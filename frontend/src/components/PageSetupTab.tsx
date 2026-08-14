/**
 * Settings ▸ Page Setup (v6.99) — Derek, via the feedback form: the old
 * Templates checkbox tab and the Page Setup tab are ONE tab now.
 *
 * Templates behave like the Themes tab: a SHOWN list and a HIDDEN list.
 * What's shown is exactly what the New Script picker offers — the same
 * `enabledScriptFormats` ids the old checkboxes wrote, so nothing
 * migrates. The six built-ins are undeletable "Default" templates; user
 * templates get Edit/Delete. "New Template…" asks which existing template
 * to base the copy on (any shown/hidden/custom one), then opens the full
 * template editor on it — the same editor the Format menu uses.
 */
import { useState } from 'react';
import { SYSTEM_TEMPLATE_LIST, useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import type { FormattingTemplate } from '../stores/formattingTypes';
import { INDUSTRY_STANDARD_ID } from '../stores/formattingTypes';
import { useSettingsStore } from '../stores/settingsStore';
import TemplateEditorDialog from './TemplateEditorDialog';
import { DEFAULT_PAGE_LAYOUT } from '../stores/editorStore';
import { confirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';

/* v7.00, Derek (via the feedback form): the page-size info left the bottom
   of the tab — each template row's View opens it for THAT template
   instead (template.pageLayout over the app defaults). */
function TemplatePageInfo({ t, onClose }: { t: FormattingTemplate; onClose: () => void }) {
  const p = { ...DEFAULT_PAGE_LAYOUT, ...(t.pageLayout ?? {}) };
  const inches = (v: number) => `${v}"`;
  const pts = (v: number) => `${v} pt`;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="fmt-dialog fmt-dialog-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">{t.name} — Page Size</div>
        <div className="fmt-dialog-body pst-info">
          <div className="pst-info-row"><span>Page size</span><strong>{inches(p.pageWidth)} × {inches(p.pageHeight)}</strong></div>
          <div className="pst-info-row"><span>Left margin</span><strong>{inches(p.leftMargin)}</strong></div>
          <div className="pst-info-row"><span>Right margin</span><strong>{inches(p.rightMargin)}</strong></div>
          <div className="pst-info-row"><span>Top margin</span><strong>{pts(p.topMargin)}</strong></div>
          <div className="pst-info-row"><span>Bottom margin</span><strong>{pts(p.bottomMargin)}</strong></div>
          <div className="pst-info-row"><span>Header margin</span><strong>{pts(p.headerMargin)}</strong></div>
          <div className="pst-info-row"><span>Footer margin</span><strong>{pts(p.footerMargin)}</strong></div>
        </div>
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function PageSetupTab() {
  const templates = useFormattingTemplateStore((s) => s.templates);
  const duplicateTemplate = useFormattingTemplateStore((s) => s.duplicateTemplate);
  const updateTemplate = useFormattingTemplateStore((s) => s.updateTemplate);
  const deleteTemplate = useFormattingTemplateStore((s) => s.deleteTemplate);
  const enabled = useSettingsStore((s) => s.enabledScriptFormats);
  const setEnabled = useSettingsStore((s) => s.setEnabledScriptFormats);
  const setInit = useSettingsStore((s) => s.setFormatPreferencesInitialized);

  const userTemplates = templates.filter((t) => t.category !== 'system');
  const all: FormattingTemplate[] = [...SYSTEM_TEMPLATE_LIST, ...userTemplates];
  // Never-configured = everything shown (the old checkbox default).
  const shownIds = enabled.length > 0 ? enabled : all.map((t) => t.id);
  const shown = all.filter((t) => shownIds.includes(t.id));
  const hidden = all.filter((t) => !shownIds.includes(t.id));

  const setShown = (ids: string[]) => {
    // The old ≥1 rule — New Script must always have something to offer.
    setEnabled(ids.length > 0 ? ids : [INDUSTRY_STANDARD_ID]);
    setInit(true);
  };

  const [editing, setEditing] = useState<FormattingTemplate | null>(null);
  const [viewing, setViewing] = useState<FormattingTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [baseId, setBaseId] = useState<string>(INDUSTRY_STANDARD_ID);

  const createFromBase = async () => {
    const copy = await duplicateTemplate(baseId);
    setShown([...shownIds, copy.id]);
    setCreating(false);
    setEditing(copy);
  };

  const remove = async (t: FormattingTemplate) => {
    const okGo = await confirmDialog(
      `Delete the template “${t.name}”? This cannot be undone.`,
      { title: 'Delete template?', confirmLabel: 'Delete', danger: true },
    );
    if (!okGo) return;
    await deleteTemplate(t.id);
    if (shownIds.includes(t.id)) setShown(shownIds.filter((x) => x !== t.id));
    showToast('Template deleted', 'success');
  };

  const row = (t: FormattingTemplate, isShown: boolean) => {
    const isSystem = t.category === 'system';
    return (
      <div key={t.id} className="fmt-card pst-row">
        <div className="fmt-card-info">
          <div className="fmt-card-name">
            <span>{t.name}</span>
            {t.scriptTypeGroup && <span className="fmt-card-group">{t.scriptTypeGroup}</span>}
            {isSystem && <span className="fmt-card-group pst-default-badge">Default</span>}
          </div>
          <div className="fmt-card-tagline">{t.scriptTypeTagline || t.description}</div>
        </div>
        <div className="pst-row-actions">
          <button className="dialog-btn dialog-btn-sm" title="View this template's page size" onClick={() => setViewing(t)}>View</button>
          {!isSystem && (
            <button className="dialog-btn dialog-btn-sm" title="Edit this template" onClick={() => setEditing(t)}>Edit</button>
          )}
          {!isSystem && (
            <button className="dialog-btn dialog-btn-sm" title="Delete this template" onClick={() => { void remove(t); }}>Delete</button>
          )}
          <button
            className="dialog-btn dialog-btn-sm"
            title={isShown ? 'Hide from the New Script picker' : 'Show in the New Script picker'}
            onClick={() => setShown(isShown ? shownIds.filter((x) => x !== t.id) : [...shownIds, t.id])}
          >{isShown ? 'Hide' : 'Show'}</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="prefs-general">
        <section>
          <h3>Page Templates</h3>
          <div className="pst-listhead">Shown in the New Script picker</div>
          <div className="fmt-card-list">{shown.map((t) => row(t, true))}</div>
          <div className="pst-listhead">Hidden</div>
          {hidden.length === 0
            ? <div className="pst-empty">Nothing hidden.</div>
            : <div className="fmt-card-list">{hidden.map((t) => row(t, false))}</div>}
          {creating ? (
            <div className="pst-newrow">
              Base it on
              <select className="fb-select pst-baseselect" value={baseId} onChange={(e) => setBaseId(e.target.value)}>
                {all.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="dialog-btn dialog-btn-primary" onClick={() => { void createFromBase(); }}>Create</button>
              <button className="dialog-btn" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          ) : (
            <div className="pst-newrow">
              <button className="dialog-btn" title="Create your own template, based on an existing one" onClick={() => setCreating(true)}>
                New Template…
              </button>
            </div>
          )}
        </section>
      </div>

      {viewing && <TemplatePageInfo t={viewing} onClose={() => setViewing(null)} />}

      {editing && (
        <TemplateEditorDialog
          template={editing}
          onSave={async (updated) => {
            await updateTemplate(updated.id, updated);
            setEditing(null);
            showToast('Template saved', 'success');
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
