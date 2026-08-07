/**
 * Shared helpers for system script-type templates.
 */

import type { FormattingElementRule } from '../formattingTypes';

/** Build a rule from defaults + overrides — same shape as industryStandardTemplate.ts. */
export function rule(
  id: string,
  label: string,
  isBuiltIn: boolean,
  overrides: Partial<FormattingElementRule>,
): FormattingElementRule {
  return {
    id,
    label,
    isBuiltIn,
    enabled: true,
    fontFamily: null,
    fontSize: null,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    textTransform: 'none',
    textColor: null,
    backgroundColor: null,
    textAlign: 'left',
    marginTop: 0,
    leftIndent: 1.50,
    // v6.33: full-width columns run to the 7.8" content edge (63 chars of
    // 10-cpi Courier — utils/screenplayMetrics). Stage play keeps its own
    // explicit 7.50 overrides; this default feeds the screenplay-standard
    // templates.
    rightIndent: 7.80,
    nextOnEnter: id,
    nextOnTab: null,
    placeholder: '',
    allowFormatOverride: true,
    ...overrides,
  };
}

/** Mark a rule as disabled — used to remove an element from a script type. */
export function disabled(id: string, label: string): FormattingElementRule {
  return { ...rule(id, label, true, {}), enabled: false };
}
