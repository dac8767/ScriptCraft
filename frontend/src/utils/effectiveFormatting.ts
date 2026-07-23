/**
 * Utilities for resolving effective formatting state.
 *
 * In override mode, the toolbar needs to show the correct active state
 * by combining the template's CSS-level formatting with inline marks.
 */

import type { Editor } from '@tiptap/core';
import type { FormattingTemplate, FormattingElementRule } from '../stores/formattingTypes';

export interface EffectiveFormatting {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  textAlign: string;
}

/** Which formatting attributes are locked (non-editable) for the current element. */
export interface LockedFormatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  textAlign: boolean;
  textColor: boolean;
  backgroundColor: boolean;
  textTransform: boolean;
  fontFamily: boolean;
  fontSize: boolean;
  subscript: boolean;
  superscript: boolean;
}

const NO_LOCK: LockedFormatting = {
  bold: false, italic: false, underline: false, strikethrough: false,
  textAlign: false, textColor: false, backgroundColor: false, textTransform: false,
  fontFamily: false, fontSize: false, subscript: false, superscript: false,
};

const ALL_LOCKED: LockedFormatting = {
  bold: true, italic: true, underline: true, strikethrough: true,
  textAlign: true, textColor: true, backgroundColor: true, textTransform: true,
  fontFamily: true, fontSize: true, subscript: true, superscript: true,
};

/**
 * Determine which formatting attributes are locked for the current element.
 *
 * - If template mode is not 'enforce', nothing is locked.
 * - If allowFormatOverride is false, everything is locked.
 * - If allowFormatOverride is true, only attributes that differ from defaults are locked.
 */
export function getLockedFormatting(
  rule: FormattingElementRule | null,
  isEnforce: boolean,
): LockedFormatting {
  if (!isEnforce || !rule) return NO_LOCK;

  // Element-level override: when allowed, nothing is locked for this element
  if (rule.allowFormatOverride) return NO_LOCK;

  // All formatting locked for this element
  return ALL_LOCKED;
}

/**
 * Get the formatting rule for the current element under the cursor.
 */
export function getCurrentElementRule(
  editor: Editor,
  template: FormattingTemplate,
): FormattingElementRule | null {
  const { $from } = editor.state.selection;
  const node = $from.parent;
  const nodeType = node.type.name;

  // For custom elements, look up by customTypeId attribute
  if (nodeType === 'customElement') {
    const customTypeId = node.attrs?.customTypeId;
    if (customTypeId && template.rules[customTypeId]) {
      return template.rules[customTypeId];
    }
    return null;
  }

  // For built-in elements
  if (template.rules[nodeType]) {
    return template.rules[nodeType];
  }

  return null;
}

/**
 * Toggle bold in override mode: if the template makes it bold, apply
 * FormatOverride to un-bold. If the template doesn't, use standard Bold mark.
 */
export function toggleBoldOverride(editor: Editor, rule: FormattingElementRule | null): void {
  if (rule?.bold) {
    // Template is bold — toggle override to remove it
    const attrs = editor.getAttributes('formatOverride');
    if (attrs?.fontWeight === 'normal') {
      editor.chain().focus(undefined, { scrollIntoView: false }).unsetMark('formatOverride').run();
    } else {
      editor.chain().focus(undefined, { scrollIntoView: false }).setMark('formatOverride', { fontWeight: 'normal' }).run();
    }
  } else {
    editor.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run();
  }
}

export function toggleItalicOverride(editor: Editor, rule: FormattingElementRule | null): void {
  if (rule?.italic) {
    const attrs = editor.getAttributes('formatOverride');
    if (attrs?.fontStyle === 'normal') {
      editor.chain().focus(undefined, { scrollIntoView: false }).unsetMark('formatOverride').run();
    } else {
      editor.chain().focus(undefined, { scrollIntoView: false }).setMark('formatOverride', { fontStyle: 'normal' }).run();
    }
  } else {
    editor.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run();
  }
}

export function toggleUnderlineOverride(editor: Editor, rule: FormattingElementRule | null): void {
  if (rule?.underline) {
    const attrs = editor.getAttributes('formatOverride');
    if (attrs?.textDecoration === 'none') {
      editor.chain().focus(undefined, { scrollIntoView: false }).unsetMark('formatOverride').run();
    } else {
      editor.chain().focus(undefined, { scrollIntoView: false }).setMark('formatOverride', { textDecoration: 'none' }).run();
    }
  } else {
    editor.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run();
  }
}
