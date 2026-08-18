/**
 * customizeResets — ONE registry of every "reset to default" the Customize
 * tabs offer (v4.65, Derek). Each tab renders its entries in a Reset section
 * at its bottom (ResetSection), and Settings ▸ Defaults compiles all of them
 * plus the Reset All button (moved there from the Customize globals). Add a
 * reset here and every surface picks it up — no drifting copies.
 */
import { useEditorStore, DEFAULT_TOOL_CONFIG, DEFAULT_TOOL_ORDER, DEFAULT_MORES_CONTDS } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { useWindowUndoStore } from '../stores/windowUndoStore';
import { useShortcutStore } from '../stores/shortcutStore';
import { runMajorChange } from '../utils/majorChange';
import { DEFAULT_TOOLBAR_LEFT } from './toolbarBuiltins';
import { saveViewState } from '../stores/viewState';
import { confirmDialog } from './ConfirmDialog';

/* v7.00: 'design' / 'helper' / 'keys' are WINDOW groups — they render only
   in Settings ▸ Defaults (no Customize tab carries them). */
export type CustomizeTabId = 'elements' | 'toolbar' | 'panels' | 'qat' | 'context' | 'themes' | 'design' | 'helper' | 'keys';

export interface ResetAction {
  id: string;
  label: string;
  tab: CustomizeTabId;
  /** What goes back to default, in the warning's words ("the ribbon
   *  toolbar's layout"). v6.77: every reset warns first. */
  what: string;
  run: () => void;
  /** Snapshot for the window-undo lane; returns the restore closure.
   *  Omitted = the state lives in CUSTOMIZATION_FIELDS, so the shared
   *  captureCustomizations/restoreCustomizations pair covers it. */
  capture?: () => () => void;
}

/** The default capture: the same full-customize snapshot Customize's own
 *  Save/Cancel rests on (v3.49) — one list, nothing quietly left behind. */
const captureCustomizeState = (): (() => void) => {
  const snap = useEditorStore.getState().captureCustomizations();
  return () => useEditorStore.getState().restoreCustomizations(snap);
};

export const CUSTOMIZE_RESETS: ResetAction[] = [
  // ── Editor ──
  {
    id: 'moresContds', label: 'Reset Mores & Continueds', tab: 'elements',
    what: 'the MORE and CONT’D settings',
    run: () => {
      const st = useEditorStore.getState();
      st.setPageLayout({ ...st.pageLayout, moresContds: { ...DEFAULT_MORES_CONTDS } });
    },
    // pageLayout is script formatting, not a CUSTOMIZATION_FIELDS entry.
    capture: () => {
      const prev = JSON.parse(JSON.stringify(useEditorStore.getState().pageLayout));
      return () => useEditorStore.getState().setPageLayout(prev);
    },
  },
  {
    id: 'transitions', label: 'Reset Transitions', tab: 'elements',
    what: 'your transition list — custom entries, hidden ones and their order',
    run: () => useFormattingTemplateStore.getState().resetTransitions(),
    capture: () => {
      const st = useFormattingTemplateStore.getState();
      const prev = {
        custom: [...st.customTransitions],
        hidden: [...st.hiddenTransitions],
        order: [...st.transitionOrder],
      };
      return () => useFormattingTemplateStore.getState().restoreTransitions(prev);
    },
  },
  {
    id: 'elements', label: 'Reset Elements', tab: 'elements',
    what: 'the element list’s hidden items and order',
    run: () => useFormattingTemplateStore.getState().resetElementOverrides(),
    capture: () => {
      const st = useFormattingTemplateStore.getState();
      const hidden = [...st.elementHidden];
      const order = [...st.elementOrder];
      return () => {
        const cur = useFormattingTemplateStore.getState();
        cur.setElementHidden(hidden);
        cur.setElementOrder(order);
      };
    },
  },
  {
    id: 'suggestions', label: 'Reset Element Suggestions', tab: 'elements',
    what: 'the element suggestion rules',
    run: () => {
      const st = useEditorStore.getState();
      st.setSuggestionRules(null);
      st.setSuggestionMode('smart');
    },
  },
  // ── Toolbar ──
  {
    id: 'toolbarSize', label: 'Reset Size', tab: 'toolbar',
    what: 'the toolbar’s size and spacing',
    run: () => {
      const st = useEditorStore.getState();
      st.setToolbarMode('compact');
      st.setChromeGap('toolbar', 2);
    },
  },
  {
    id: 'toolbarItems', label: 'Reset Items', tab: 'toolbar',
    what: 'the ribbon toolbar’s layout',
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
    what: 'the side panels’ width and tool scale',
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
    what: 'the side panels’ tools, sides and order',
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
    what: 'the Quick Access Toolbar’s buttons',
    run: () => useEditorStore.getState().setQatItems(['save', 'undo', 'redo']),
  },
  // ── Context Menu ──
  {
    id: 'contextItems', label: 'Reset Items', tab: 'context',
    what: 'the right-click menu’s items and order',
    run: () => {
      const st = useEditorStore.getState();
      st.setContextMenuHidden([]);
      st.setContextMenuOrder([]);
    },
  },
  /* v7.00, Derek (via the feedback form): the WINDOW resets join the
     registry so Settings ▸ Defaults truly compiles every reset. Same
     bulk-restore store functions the windows' own buttons use. */
  {
    id: 'designTokens', label: 'Reset Design Tokens', tab: 'design',
    what: 'every Design-window slider override',
    capture: () => {
      const prev = { ...useEditorStore.getState().designVars };
      return () => useEditorStore.getState().setDesignVars(prev);
    },
    run: () => useEditorStore.getState().setDesignVars({}),
  },
  {
    id: 'helperText', label: 'Reset Helper Text', tab: 'helper',
    what: 'every helper-text edit and hidden entry',
    capture: () => {
      const st = useEditorStore.getState();
      const o = { ...st.helperTextOverrides };
      const h = [...st.helperTextHidden];
      return () => {
        const s = useEditorStore.getState();
        s.setHelperTextOverrides(o);
        s.setHelperTextHidden(h);
      };
    },
    run: () => {
      const s = useEditorStore.getState();
      s.setHelperTextOverrides({});
      s.setHelperTextHidden([]);
    },
  },
  {
    id: 'shortcuts', label: 'Reset Keyboard Shortcuts', tab: 'keys',
    what: 'every rebound keyboard shortcut',
    capture: () => {
      const prev = JSON.parse(JSON.stringify(useShortcutStore.getState().overrides));
      return () => useShortcutStore.getState().restoreOverrides(prev);
    },
    run: () => useShortcutStore.getState().restoreOverrides({}),
  },
];

/** THE way a registry reset runs — warn, capture, run, land on the
 *  window-undo lane (v6.77's rule). v6.85: extracted so Settings ▸ Defaults
 *  runs the SAME wrapper as the per-tab Reset sections — it was still
 *  calling a.run() bare, the drift the one-registry design exists to
 *  prevent. Every surface that renders CUSTOMIZE_RESETS calls this. */
export function runCustomizeReset(a: ResetAction): void {
  void runMajorChange({
    title: a.label,
    message: `Put ${a.what} back to the app defaults?`,
    confirmLabel: 'Reset',
    // three tabs share the bare "Reset Items" label — the undo
    // toast names WHAT came back, not which button was pressed
    label: `Reset — ${a.what}`,
    capture: a.capture ?? captureCustomizeState,
    run: a.run,
    toast: `${a.label} — done`,
  });
}

/** The bottom-of-tab Reset section — every tab's reset buttons in one place.
 *  v6.77, Derek: "any button that makes major changes, always include a
 *  warning window" — every entry warns first and lands on the window-undo
 *  lane, through the ONE wrapper (runMajorChange), so no button can drift
 *  back to resetting silently. */
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
            className="dialog-btn dialog-btn-sm"
            onClick={() => runCustomizeReset(a)}
          >{a.label}</button>
        ))}
      </div>
    </section>
  );
}

/** Reset All — one definition (moved from the Customize globals, v4.65).
 *  Keeps its own STRONGER confirm (type-to-confirm), and since v6.77 the
 *  reset lands on the window-undo lane like the per-tab ones. */
export function ResetAllButton() {
  return (
    <button
      className="fs-reset-all-btn"
      title="Reset every customization to the defaults — sizes, toolbar layout, Quick Access, menu bar, panels, outline bar"
      onClick={async () => {
        if (await confirmDialog(
          'Reset ALL customizations to their defaults? Sizes and spacing, the toolbar layout, dropdown widths, Quick Access Toolbar, menu bar order, side panels, and the Outline Bar all go back to factory. (Themes, Editor and Keyboard Shortcuts have their own resets and are not touched.) You can undo this afterwards with the usual Undo key.',
          { title: 'Reset All Customizations', confirmLabel: 'Reset Customizations', danger: true, requireText: 'Reset Customizations' },
        )) {
          const restore = captureCustomizeState();
          useEditorStore.getState().resetAllCustomizations();
          useWindowUndoStore.getState().push(
            'Reset all customizations',
            restore,
            () => useEditorStore.getState().resetAllCustomizations(),
          );
        }
      }}
    >Reset All</button>
  );
}
