/**
 * Template selection and management dialog for per-document template assignment.
 * Opened from Format > Formatting Template... in the menu bar.
 *
 * Templates are categorized as:
 * - System Standard: read-only templates (e.g. Industry Standard) — cannot be edited or deleted
 * - User Defined: custom templates created by the user — fully editable
 *
 * When applying a template, detects conflicts (disabled elements, locked formatting
 * violations) and shows a resolution dialog before applying.
 */

import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useFormattingTemplateStore, SYSTEM_TEMPLATES, SYSTEM_TEMPLATE_LIST } from '../stores/formattingTemplateStore';
import { INDUSTRY_STANDARD_ID } from '../stores/formattingTypes';
import { INDUSTRY_STANDARD_TEMPLATE } from '../stores/industryStandardTemplate';
import type { FormattingTemplate } from '../stores/formattingTypes';
import TemplateEditorDialog from './TemplateEditorDialog';
import TemplateCard from './TemplateCard';
import { useApplyTemplate } from '../hooks/useApplyTemplate';
import { showToast } from './Toast';

interface TemplateSelectDialogProps {
  editor: Editor | null;
  onClose: () => void;
}

const TemplateSelectDialog: React.FC<TemplateSelectDialogProps> = ({ editor, onClose }) => {
  const {
    templates,
    activeTemplateId,
    loadTemplates,
    createTemplate,
    updateTemplate,
  } = useFormattingTemplateStore();

  const [selectedId, setSelectedId] = useState<string | null>(activeTemplateId);
  const [editingTemplate, setEditingTemplate] = useState<FormattingTemplate | null>(null);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Resolve which ID is currently the "active" one (null = Industry Standard)
  const resolvedActiveId = activeTemplateId || INDUSTRY_STANDARD_ID;

  // Resolve the selected template object — checks system templates first, then user-created.
  const getSelectedTemplate = (): FormattingTemplate => {
    if (!selectedId || selectedId === INDUSTRY_STANDARD_ID) {
      return INDUSTRY_STANDARD_TEMPLATE;
    }
    if (SYSTEM_TEMPLATES[selectedId]) return SYSTEM_TEMPLATES[selectedId];
    return templates.find((t) => t.id === selectedId) || INDUSTRY_STANDARD_TEMPLATE;
  };

  /* v7.51: applying lives in useApplyTemplate, shared with Settings ▸ Page
     Setup, which grew its own Apply at Derek's request. Applying is four
     things, not one — the active id, the template's page layout, the conflict
     question, and starter content for an empty doc — and three of them are the
     kind that go missing without anything looking wrong. */
  const { requestApply, conflictDialog } = useApplyTemplate(editor, onClose);

  // Split templates by category — SYSTEM_TEMPLATE_LIST owns the canonical order of script-type templates.
  const systemTemplates: FormattingTemplate[] = SYSTEM_TEMPLATE_LIST;
  const userTemplates: FormattingTemplate[] = templates.filter((t) => t.category !== 'system');

  /* v7.50: the row itself is TemplateCard, shared with Settings ▸ Page Setup.
     What this dialog adds is the only thing that differs — a row here is a
     CHOICE, so it takes onSelect and paints the selected one. */
  const renderTemplateItem = (t: FormattingTemplate) => (
    <TemplateCard
      key={t.id}
      template={t}
      isCurrent={t.id === resolvedActiveId}
      selected={(t.id === INDUSTRY_STANDARD_ID && (!selectedId || selectedId === INDUSTRY_STANDARD_ID))
        || t.id === selectedId}
      onSelect={() => setSelectedId(t.id)}
      onEdit={setEditingTemplate}
      onDeleted={(id) => { if (selectedId === id) setSelectedId(INDUSTRY_STANDARD_ID); }}
    />
  );

  return (
    <div className="template-select-overlay" onClick={onClose}>
      <div className="template-select-dialog template-select-dialog-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Script Format / Template</h3>
        <p className="template-select-hint">
          Choose a script format (script, sitcom, drama, stage play, radio) or a custom formatting template.
          The template controls element-level formatting rules; for an empty document, choosing a script type also seeds starter content.
        </p>

        {/* Template list */}
        <div className="template-select-list">
          {/* Script formats (system templates) */}
          <div className="template-select-category">Script Formats</div>
          {systemTemplates.map(renderTemplateItem)}

          {/* User Defined section */}
          <div className="template-select-category">User Defined</div>
          {userTemplates.length === 0 ? (
            <div className="template-select-empty">No custom templates yet.</div>
          ) : (
            userTemplates.map(renderTemplateItem)
          )}
        </div>

        {/* Template management buttons */}
        <div className="template-select-management">
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={async () => {
              const t = await createTemplate({ name: 'New Template' });
              setEditingTemplate(t);
            }}
          >
            + Create Template
          </button>
        </div>

        {/* Actions */}
        <div className="template-select-actions">
          <button className="dialog-btn" onClick={onClose}>Cancel</button>
          <button className="dialog-btn dialog-btn-primary" onClick={() => requestApply(getSelectedTemplate())}>Apply</button>
        </div>

        {/* Template Editor sub-dialog */}
        {editingTemplate && (
          <TemplateEditorDialog
            template={editingTemplate}
            onSave={async (updated) => {
              await updateTemplate(updated.id, updated);
              setEditingTemplate(null);
              showToast('Template saved', 'success');
            }}
            onCancel={() => setEditingTemplate(null)}
          />
        )}

        {conflictDialog}
      </div>
    </div>
  );
};

export default TemplateSelectDialog;
