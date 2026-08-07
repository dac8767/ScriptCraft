/**
 * AnalyticsTool — script analytics under one roof, organized into tabs:
 *   Overview | Scenes | Dialogue | Gender
 * Overview: totals cards. Scenes: scene breakdown + pacing chart.
 * Dialogue: dialogue distribution. Scenes also hosts the character
 * presence-by-scene map and the timing report. Gender: OpenDraft's gender breakdown
 * plus the ScriptCraft assignment table (parity bars, two-plus-female-speakers
 * count; assignments write to Character Profiles).
 *
 * v6.19, Derek: the tabs render in the WINDOW HEADER (the shared chrome
 * slot, like Goals/Characters), so the active tab lives in the store
 * (analyticsTab) and useAnalyticsTabs feeds TOOL_CHROME — the body only
 * filters its sections. Tab filtering works via the data-sec attribute each
 * statistics section carries — the active tab shows only its sections (CSS
 * attribute match).
 */
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { useHt } from '../utils/helperText';
import type { ToolChromeTab } from './ToolControls';
import ScriptStatistics from './ScriptStatistics';
import GenderAnalysisTool from './GenderAnalysisTool';

const TABS = [
  ['overview', 'Overview'],
  ['scenes', 'Scenes'],
  ['dialogue', 'Dialogue'],
  ['gender', 'Gender'],
] as const;

/** Header tabs for the Analytics window (TOOL_CHROME.useTabs). */
export function useAnalyticsTabs(): ToolChromeTab[] {
  const tab = useEditorStore((s) => s.analyticsTab);
  const setTab = useEditorStore((s) => s.setAnalyticsTab);
  return TABS.map(([key, label]) => ({
    label,
    active: tab === key,
    onSelect: () => setTab(key),
  }));
}

interface AnalyticsToolProps {
  editor: Editor | null;
}

export default function AnalyticsTool({ editor }: AnalyticsToolProps) {
  const tab = useEditorStore((s) => s.analyticsTab);
  const ht = useHt();

  return (
    <div className="fs-analytics">
      {editor ? (
        <div className="fs-analytics-stats" data-show={tab}>
          <ScriptStatistics editor={editor} embedded />
          {tab === 'gender' && (
            <div className="fs-analytics-gender-assign">
              <GenderAnalysisTool editor={editor} />
            </div>
          )}
        </div>
      ) : (
        <div className="fs-nav-empty">{ht('Open a script to see analytics.')}</div>
      )}
    </div>
  );
}
