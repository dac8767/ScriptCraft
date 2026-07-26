/**
 * customizeResets — ONE registry of every "reset to default" the Customize
 * tabs offer (v4.65, Derek). Each tab renders its entries in a Reset section
 * at its bottom (ResetSection), and Settings ▸ Defaults compiles all of them
 * plus the Reset All button (moved there from the Customize globals). Add a
 * reset here and every surface picks it up — no drifting copies.
 */
import { useEditorStore, DEFAULT_TOOL_CONFIG, DEFAULT_TOOL_ORDER, DEFAULT_MORES_CONTDS } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { DEFAULT_TOOLBAR_LEFT } from './toolbarBuiltins';
import { saveViewState } from '../stores/viewState';
import { confirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';

export type CustomizeTabId = 'elements' | 'toolbar' | 'panels' | 'qat' | 'context' | 'themes';

export interface ResetAction {
  id: string;
  label: string;
  tab: CustomizeTabId;
  run: () => void;
}

export const CUSTOMIZE_RESETS: ResetAction[] = [
  // ── Editor ──
  {
    id: 'moresContds', label: 'Reset Mores & Continueds', tab: 'elements',
    run: () => {
      const st = useEditorStore.getState();
      st.setPageLayout({ ...st.pageLayout, moresContds: { ...DEFAULT_MORES_CONTDS } });
    },
  },
  {
    id: 'transitions', label: 'Reset Transitions', tab: 'elements',
    run: () => useFormattingTemplateStore.getState().resetTransitions(),
  },
  {
    id: 'elements', label: 'Reset Elements', tab: 'elements',
    run: () => useFormattingTemplateStore.getState().resetElementOverrides(),
  },
  {
    id: 'suggestions', label: 'Reset Element Suggestions', tab: 'elements',
    run: () => {
      const st = useEditorStore.getState();
      st.setSuggestionRules(null);
      st.setSuggestionMode('smart');
    },
  },
  // ── Toolbar ──
  {
    id: 'toolbarSize', label: 'Reset Size', tab: 'toolbar',
    run: () => {
      const st = useEditorStore.getState();
      st.setToolbarMode('compact');
      st.setChromeGap('toolbar', 2);
    },
  },
  {
    id: 'toolbarItems', label: 'Reset Items', tab: 'toolbar',
    run: () => {
      const st = useEditorStore.getState();
      st.setToolbarZones([...DEFAULT_TOOLBAR_LEFT], []);
      saveViewState({ toolbarDdWidths: {} });
      useEditorStore.setState({ toolbarDdWidths: {} });
    },
  },
  // ── Side Panels ──
  {
    id: 'panelsSize', label: 'Reset Size', tab: 'panels',
    run: () => {
      // v4.65, Derek's bug report: resetting the width MODE alone read as
      // "not working" whenever only the vertical tool scaling had been
      // dragged — the size reset covers BOTH width and the tool scale now.
      const st = useEditorStore.getState();
      st.setPanelSizeMode('left', 'comfortable');
      st.setPanelSizeMode('right', 'comfortable');
      st.setPanelItemScale('left', 1);
      st.setPanelItemScale('right', 1);
    },
  },
  {
    id: 'panelsItems', label: 'Reset Items', tab: 'panels',
    run: () => {
      // Mirrors the old in-tab reset: every tool back to its default side,
      // dividers cleared, default order.
      const st = useEditorStore.getState();
      st.setToolConfig({ ...DEFAULT_TOOL_CONFIG });
      st.setPanelDividers([]);
      st.setToolOrder([...DEFAULT_TOOL_ORDER]);
    },
  },
  // ── Quick Access ──
  {
    id: 'qatItems', label: 'Reset Items', tab: 'qat',
    run: () => useEditorStore.getState().setQatItems(['save', 'undo', 'redo']),
  },
  // ── Context Menu ──
  {
    id: 'contextItems', label: 'Reset Items', tab: 'context',
    run: () => {
      const st = useEditorStore.getState();
      st.setContextMenuHidden([]);
      st.setContextMenuOrder([]);
    },
  },
];

/** The bottom-of-tab Reset section — every tab's reset buttons in one place. */
export function ResetSection({ tab }: { tab: CustomizeTabId }) {
  const actions = CUSTOMIZE_RESETS.filter((a) => a.tab === tab);
  if (!actions.length) return null;
  return (
    <section className="fs-reset-section">
      <h3>Reset to Default</h3>
      <div className="fs-reset-row">
        {actions.map((a) => (
          <button
            key={a.id}
            className="swn-add-btn"
            onClick={() => { a.run(); showToast(`${a.label} — done`, 'success'); }}
          >{a.label}</button>
        ))}
      </div>
    </section>
  );
}

/** Reset All — one definition (moved from the Customize globals, v4.65). */
export function ResetAllButton() {
  return (
    <button
      className="fs-reset-all-btn"
      title="Reset every customization to the defaults — sizes, toolbar layout, Quick Access, menu bar, panels, outline bar"
      onClick={async () => {
        if (await confirmDialog(
          'Reset ALL customizations to their defaults? Sizes and spacing, the toolbar layout, dropdown widths, Quick Access Toolbar, menu bar order, side panels, and the Outline Bar all go back to factory. (Themes, Editor and Keyboard Shortcuts have their own resets and are not touched.)',
          { title: 'Reset All Customizations', confirmLabel: 'Reset Customizations', danger: true, requireText: 'Reset Customizations' },
        )) useEditorStore.getState().resetAllCustomizations();
      }}
    >Reset All</button>
  );
}
