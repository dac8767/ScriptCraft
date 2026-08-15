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
import PageSetupDialog from './PageSetupDialog';
import { DndColumns, type DndColumnSpec } from './CustomizePanelsDialog';
import { confirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';

/* v7.10, Derek: "'page setup' used to have a full page of fields for the
   various measurement options. This is what you should seen when clicking view
   on an item in the current Page Setup tab. make equivalents for the other
   templates." — and, asked whether built-ins should be editable too: "Built
   ins".

   So View opens THE page of fields (PageSetupDialog, given a value + onSave)
   scoped to this template, not a seven-row read-only box. There is one such
   page in the app; this hands it a template's layout instead of the document's.

   The built-ins are why the layout is stored in the STORE and not on the
   template: the six system templates are immutable constants, so writing to
   one through updateTemplate() would be a silent no-op. */
function TemplatePageSetup({ t, onClose }: { t: FormattingTemplate; onClose: () => void }) {
  const getLayout = useFormattingTemplateStore((s) => s.getTemplatePageLayout);
  const getBase = useFormattingTemplateStore((s) => s.getTemplateBasePageLayout);
  const setLayout = useFormattingTemplateStore((s) => s.setTemplatePageLayout);
  // Subscribed so Reset Default in another surface re-renders this one.
  useFormattingTemplateStore((s) => s.templatePageLayouts[t.id]);
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="fmt-dialog page-setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">{t.name} — Page Setup</div>
        <div className="fmt-dialog-body">
          <PageSetupDialog
            embedded
            value={getLayout(t.id)}
            resetTo={getBase(t.id)}
            onSave={(next) => {
              setLayout(t.id, next);
              showToast(`Page setup saved for ${t.name}.`, 'success');
            }}
            onClose={onClose}
          />
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

  /* v7.11, Derek: "change the page setup tab so that it uses the Shown and
     Hidden windows like the screenshot." That is DndColumns — the same
     component the Context Menu, Toolbar, Side Panels and Quick Access tabs
     use — so a template drags between the columns exactly like everything
     else, and there is still one implementation of that interaction. The
     per-row buttons stay: nothing here REQUIRES a drag. */
  const rowContent = (t: FormattingTemplate, isShown: boolean) => {
    const isSystem = t.category === 'system';
    return (
      <div className="pst-dndrow">
        <div className="fmt-card-info">
          <div className="fmt-card-name">
            <span>{t.name}</span>
            {t.scriptTypeGroup && <span className="fmt-card-group">{t.scriptTypeGroup}</span>}
            {isSystem && <span className="fmt-card-group pst-default-badge">Default</span>}
          </div>
          <div className="fmt-card-tagline">{t.scriptTypeTagline || t.description}</div>
        </div>
        <div className="pst-row-actions">
          <button className="dialog-btn dialog-btn-sm" title="Open this template's page setup" onClick={() => setViewing(t)}>View</button>
          {!isSystem && (
            <button className="dialog-btn dialog-btn-sm" title="Edit this template" onClick={() => setEditing(t)}>Edit</button>
          )}
          {!isSystem && (
            <button className="dialog-btn dialog-btn-sm" title="Delete this template" onClick={() => { void remove(t); }}>Delete</button>
          )}
          <button
            className="fs-dnd-rowbtn"
            title={isShown ? 'Hide from the New Script picker' : 'Show in the New Script picker'}
            onClick={() => setShown(isShown ? shownIds.filter((x) => x !== t.id) : [...shownIds, t.id])}
          >{isShown ? '×' : '+'}</button>
        </div>
      </div>
    );
  };

  const columns: DndColumnSpec[] = [
    {
      id: 'shown',
      title: 'Shown',
      headerExtra: (
        <button
          className="fs-dnd-headbtn"
          title="Show every template in the New Script picker"
          onClick={() => setShown(all.map((t) => t.id))}
        >Show All</button>
      ),
      sections: [{ rows: shown.map((t) => ({ key: t.id, content: rowContent(t, true) })) }],
    },
    {
      id: 'hidden',
      title: 'Hidden',
      isHidden: true,
      headerExtra: (
        <button
          className="fs-dnd-headbtn"
          /* The ≥1 rule lives in setShown — New Script must always have
             something to offer, so Hide All leaves Industry Standard. */
          title="Hide every template except Industry Standard"
          onClick={() => setShown([])}
        >Hide All</button>
      ),
      sections: [{ rows: hidden.map((t) => ({ key: t.id, content: rowContent(t, false) })) }],
    },
  ];

  const onDrop = (src: { col: string; key: string }, dst: { col: string; idx: number }) => {
    if (src.col === dst.col) {
      if (dst.col !== 'shown') return;                     // Hidden has no order
      const rest = shownIds.filter((x) => x !== src.key);
      const at = Math.max(0, Math.min(dst.idx, rest.length));
      setShown([...rest.slice(0, at), src.key, ...rest.slice(at)]);
      return;
    }
    if (dst.col === 'hidden') setShown(shownIds.filter((x) => x !== src.key));
    else setShown([...shownIds.filter((x) => x !== src.key), src.key]);
  };

  return (
    <>
      <div className="prefs-general">
        <section>
          <h3>Page Templates</h3>
          <p className="prefs-hint">
            Drag a template between Shown and Hidden — what’s shown is what the
            New Script picker offers. View opens that template’s page setup.
          </p>
          <DndColumns columns={columns} onDrop={onDrop} />
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

      {viewing && <TemplatePageSetup t={viewing} onClose={() => setViewing(null)} />}

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
