// @vitest-environment jsdom
// (v7.10: the template store now resolves per-template PAGE SETUP, so its
//  import chain reaches editorStore, which reads localStorage at module
//  scope — the same reason titlePageLayout.test.ts asks for jsdom.)
import { describe, it, expect, vi } from 'vitest';

/*
 * v1.34 — why "Describe the action..." outlived its v1.32 removal.
 *
 * The string was renamed in the SYSTEM templates, but user templates saved to
 * the backend cloned the default rules at creation — so any script using a
 * saved template kept serving the old hint. loadTemplates now migrates stored
 * placeholders that equal an old default; user-authored text is untouched.
 */

vi.mock('../services/api', () => ({
  api: {
    listFormattingTemplates: vi.fn(async () => [
      {
        id: 'user-tpl-1',
        name: 'My Custom',
        mode: 'suggest',
        rules: {
          action: { id: 'action', label: 'Action', placeholder: 'Describe the action...' },
          dialogue: { id: 'dialogue', label: 'Dialogue', placeholder: 'What Derek typed himself' },
        },
      },
    ]),
  },
}));

import { useFormattingTemplateStore, migrateTemplatePlaceholders } from './formattingTemplateStore';
import type { FormattingTemplate } from './formattingTypes';

describe('stored templates shed stale default placeholders on load', () => {
  it('loadTemplates rewrites the old action default to "Action..."', async () => {
    await useFormattingTemplateStore.getState().loadTemplates();
    const tpl = useFormattingTemplateStore.getState().templates.find((t) => t.id === 'user-tpl-1')!;
    expect(tpl.rules.action.placeholder).toBe('Action...');
  });

  it('but never touches text the user actually wrote', async () => {
    await useFormattingTemplateStore.getState().loadTemplates();
    const tpl = useFormattingTemplateStore.getState().templates.find((t) => t.id === 'user-tpl-1')!;
    expect(tpl.rules.dialogue.placeholder).toBe('What Derek typed himself');
  });

  it('a template with nothing stale comes back identical (same reference)', () => {
    const clean = {
      id: 'x', name: 'x', mode: 'suggest',
      rules: { action: { id: 'action', label: 'Action', placeholder: 'Action...' } },
    } as unknown as FormattingTemplate;
    expect(migrateTemplatePlaceholders(clean)).toBe(clean);
  });
});
