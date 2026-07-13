/**
 * AnalyticsTool — script analytics under one roof, organized into tabs:
 *   Overview | Scenes | Dialogue | Gender
 * Overview: totals cards. Scenes: scene breakdown + pacing chart.
 * Dialogue: dialogue distribution. Scenes also hosts the character
 * presence-by-scene map and the timing report. Gender: OpenDraft's gender breakdown
 * plus the ScriptCraft assignment table (parity bars, two-plus-female-speakers
 * count; assignments write to Character Profiles).
 *
 * Tab filtering works via the data-sec attribute each statistics section
 * carries — the active tab shows only its sections (CSS attribute match).
 */
import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import ScriptStatistics from './ScriptStatistics';
import GenderAnalysisTool from './GenderAnalysisTool';

const TABS = [
  ['overview', 'Overview'],
  ['scenes', 'Scenes'],
  ['dialogue', 'Dialogue'],
  ['gender', 'Gender'],
] as const;

type AnalyticsTab = typeof TABS[number][0];

interface AnalyticsToolProps {
  editor: Editor | null;
}

export default function AnalyticsTool({ editor }: AnalyticsToolProps) {
  const [tab, setTab] = useState<AnalyticsTab>('overview');

  return (
    <div className="fs-analytics">
      <div className="fs-analytics-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
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
        <div className="fs-nav-empty">Open a script to see analytics.</div>
      )}
    </div>
  );
}
