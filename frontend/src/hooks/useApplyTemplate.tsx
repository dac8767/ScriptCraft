/**
 * useApplyTemplate — putting a formatting template on the open script.
 *
 * v7.51, Derek, of the template list now in Settings ▸ Page Setup: "the window
 * lacks the ability to select a template and apply it, like the other window
 * has." So both surfaces apply templates now — which is exactly the moment to
 * NOT write the applying twice.
 *
 * It reads like one line (`setActiveTemplateId`) and is four things, three of
 * them easy to leave out and impossible to notice missing:
 *
 *   · THE PAGE LAYOUT. A template's page setup is part of the template
 *     (v7.10). Choosing the template is what puts those measurements on the
 *     script — without this, the whole page of fields behind View looks like it
 *     works and changes nothing.
 *   · THE CONFLICT PASS. A template can disable an element the script is
 *     already using, or lock formatting the script has applied. Applying
 *     blindly silently mangles the draft, so conflicts are detected first and
 *     the writer is asked.
 *   · THE STARTER CONTENT, seeded only into a genuinely empty document — the
 *     new-script flow. Anything with content in it is left alone.
 *   · INDUSTRY STANDARD IS `null`, not its own id. It is the default rather
 *     than a stored choice, and writing the id instead would work until
 *     something compared against null.
 *
 * The conflict dialog comes back as JSX rather than as three handlers for each
 * caller to wire up, because it is not a separate feature — it is the middle of
 * this flow, and a caller that forgot to render it would apply templates that
 * quietly skipped the question.
 */
import React, { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { INDUSTRY_STANDARD_ID } from '../stores/formattingTypes';
import type { FormattingTemplate } from '../stores/formattingTypes';
import TemplateConflictDialog from '../components/TemplateConflictDialog';
import { confirmDialog } from '../components/ConfirmDialog';
import {
  detectTemplateConflicts,
  resolveTemplateConflicts,
  getEnabledElementOptions,
} from '../utils/templateConflicts';
import type { TemplateConflicts } from '../utils/templateConflicts';

export interface ApplyTemplateApi {
  /** Apply this template — confirming first if it would re-format a script
   *  that already has writing in it, then asking about conflicts if any. */
  requestApply: (t: FormattingTemplate) => void;
  /** Render this. It is null unless a question is pending. */
  conflictDialog: React.ReactNode;
}

export function useApplyTemplate(
  editor: Editor | null,
  /** Called once the template is really on the script — a dialog closes itself
   *  here, a settings tab says so and stays open. */
  onApplied?: (t: FormattingTemplate) => void,
): ApplyTemplateApi {
  const setActiveTemplateId = useFormattingTemplateStore((s) => s.setActiveTemplateId);
  // null means Industry Standard, which is the default rather than a stored id.
  const activeId = useFormattingTemplateStore((s) => s.activeTemplateId) || INDUSTRY_STANDARD_ID;
  const [pendingConflicts, setPendingConflicts] = useState<TemplateConflicts | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<FormattingTemplate | null>(null);

  /** No user-authored content — a single empty paragraph, or nothing. */
  const isEmptyDoc = useCallback((): boolean => {
    if (!editor || editor.isDestroyed) return false;
    const doc = editor.state.doc;
    if (doc.childCount === 0) return true;
    if (doc.childCount === 1 && doc.firstChild?.textContent === '') return true;
    return false;
  }, [editor]);

  const applyTemplate = useCallback((template: FormattingTemplate) => {
    // Industry Standard is the DEFAULT, stored as null rather than as an id.
    setActiveTemplateId(template.id === INDUSTRY_STANDARD_ID ? null : template.id);
    /* v7.10, Derek: a template's PAGE SETUP is part of the template. Settings ▸
       Page Setup ▸ View edits a full page of fields per template (built-ins
       included); choosing the template is what puts those measurements on the
       script. Without this the fields would look like they worked and change
       nothing — the failure mode this repo keeps finding. */
    useEditorStore.getState().setPageLayout(
      useFormattingTemplateStore.getState().getTemplatePageLayout(template.id),
    );
    // Starter content for EMPTY docs only; existing content is left untouched.
    if (template.starterDocument && template.starterDocument.length > 0
        && editor && !editor.isDestroyed && isEmptyDoc()) {
      try {
        editor.chain().focus().setContent({
          type: 'doc',
          content: template.starterDocument as unknown as Record<string, unknown>[],
        }).run();
      } catch (err) {
        console.warn('[useApplyTemplate] failed to seed starter document', err);
      }
    }
    onApplied?.(template);
  }, [editor, isEmptyDoc, onApplied, setActiveTemplateId]);

  const requestApply = useCallback(async (template: FormattingTemplate) => {
    /* v7.52, Derek: "make sure there is a warning window before allowing the
       user to change the template on an existing project."

       Two gates, in this order, because they answer different questions:

         1. THIS one — do you want this at all? Changing a template re-formats
            every element in the script and swaps the page setup underneath it.
            That is a large, immediate change to someone's draft and it should
            never happen from one click.
         2. The conflict pass below — and specifically WHAT will break. It only
            fires when there is something to say, so it cannot serve as gate 1;
            plenty of switches are conflict-free and still rewrite the page.

       Neither gate fires when nothing is at stake: re-applying the template the
       script already uses changes nothing, and an EMPTY document is the
       new-script and Guided Setup flow, where a confirmation on every choice
       would be noise rather than safety. */
    const changing = activeId !== template.id;
    if (changing && !isEmptyDoc()) {
      const go = await confirmDialog(
        `This script will be re-formatted to “${template.name}”. Every element takes that `
        + 'template\'s rules, and its page setup — page size, margins, headers and footers — '
        + 'replaces the current one.',
        { title: 'Change the script\'s format?', confirmLabel: 'Change Format' },
      );
      if (!go) return;
    }

    if (editor && !editor.isDestroyed) {
      const conflicts = detectTemplateConflicts(editor, template);
      if (conflicts.hasConflicts) {
        setPendingTemplate(template);
        setPendingConflicts(conflicts);
        return;                       // the dialog below drives the rest
      }
    }
    applyTemplate(template);
  }, [editor, applyTemplate, activeId, isEmptyDoc]);

  const clearPending = () => { setPendingConflicts(null); setPendingTemplate(null); };

  const conflictDialog = pendingConflicts && pendingTemplate ? (
    <TemplateConflictDialog
      conflicts={pendingConflicts}
      enabledElements={getEnabledElementOptions(pendingTemplate)}
      templateName={pendingTemplate.name}
      onResolve={(resolved) => {
        if (editor) resolveTemplateConflicts(editor, pendingTemplate, resolved);
        applyTemplate(pendingTemplate);
        clearPending();
      }}
      // Skip = apply anyway, leaving the conflicting content as it is.
      onSkip={() => { applyTemplate(pendingTemplate); clearPending(); }}
      onCancel={clearPending}
    />
  ) : null;

  return { requestApply, conflictDialog };
}
