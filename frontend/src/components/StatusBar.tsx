import React, { useMemo } from 'react';
import { useEditorStore, ELEMENT_LABELS, type BuiltInElementType } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { computeSceneTiming, formatRuntime } from '../utils/scriptTiming';
import { computeOverviewStats } from '../utils/scriptStatistics';
import { GoalChip } from './GoalsTool';
import { computeScriptStructure } from '../utils/scriptStructure';
import { useNotebookStore } from '../stores/notebookStore';
import { useProjectStore } from '../stores/projectStore';
import { formatSaveMoment } from '../utils/dateFormat';

const SAVE_STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  idle: { label: '', className: '' },
  unsaved: { label: 'Unsaved changes', className: 'status-save-unsaved' },
  saving: { label: 'Saving\u2026', className: 'status-save-saving' },
  saved: { label: 'Saved', className: 'status-save-saved' },
  error: { label: 'Save failed', className: 'status-save-error' },
};

interface StatusBarProps {
  editorDoc?: Record<string, unknown> | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ editorDoc = null }) => {
  const {
    activeElement,
    pageCount,
    currentPage,
    revisionMode,
    revisionColor,
    documentTitle,
    draftLabel,
    saveStatus,
    goal,
  } = useEditorStore();
  const mirrorStatuses = useEditorStore((s) => s.mirrorStatuses);
  /* v7.61, Derek: "in the footer of the entire app, add a new feature to the
     right of the script name that shows the date and time of the last save.
     this can be either auto save or manual save, but indicate which." */
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const lastSaveKind = useEditorStore((s) => s.lastSaveKind);
  const lastSavedScriptId = useEditorStore((s) => s.lastSavedScriptId);
  const currentScriptId = useProjectStore((s) => s.currentScriptId);
  const dateFormat = useSettingsStore((s) => s.dateFormat);
  const { saveToGDrive, saveToOneDrive } = useSettingsStore();
  const enabledMirrors = [saveToGDrive && 'Google Drive', saveToOneDrive && 'OneDrive'].filter(Boolean) as string[];
  const mirrorChips: Array<[string, 'saving' | 'saved' | 'error']> = enabledMirrors
    .filter((n) => mirrorStatuses[n])
    .map((n) => [n, mirrorStatuses[n]]);
  const getActiveTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate);

  const saveDisplay = SAVE_STATUS_DISPLAY[saveStatus] || SAVE_STATUS_DISPLAY.idle;

  /* The stamp belongs to ONE script. After switching, the previous script's
     save time would otherwise sit there looking like this one's — so it shows
     only while the id still matches. Nothing is shown before the first save of
     the session either: there is no last save to report, and a blank is
     honest where an invented time would not be. */
  const lastSave = useMemo(() => {
    if (!lastSavedAt || !lastSaveKind) return null;
    if (lastSavedScriptId !== currentScriptId) return null;
    const when = new Date(lastSavedAt);
    return {
      /* v7.64, Derek: "when it is a manual save, just have it say 'Saved'.
         drop the word 'manually'." v7.61 argued both kinds should name
         themselves in parallel; his answer is that "Saved" is what a save
         you performed yourself is called, and "Auto-saved" is still there to
         mark the other kind. The tooltip below still says which, in full. */
      label: `${lastSaveKind === 'manual' ? 'Saved' : 'Auto-saved'} ${formatSaveMoment(when, dateFormat)}`,
      title: `Last ${lastSaveKind === 'manual' ? 'manual' : 'automatic'} save — ${when.toLocaleString()}`,
    };
  }, [lastSavedAt, lastSaveKind, lastSavedScriptId, currentScriptId, dateFormat]);
  // With a takeover surface up (Scrapbook, Characters fullscreen) the editor
  // isn't what's on screen — the script-specific readouts (current element,
  // page count, acts, runtime, revision, goal) don't apply. File + account
  // info stays. (v4.30 batch-v7 #4: used to check only the Scrapbook.)
  const scrapbookActive = useNotebookStore((s) => s.notebookOpen);
  const fullscreenToolActive = useEditorStore((s) => s.fullscreenTool !== null);
  const takeoverActive = scrapbookActive || fullscreenToolActive;

  const elementLabel = useMemo(() => {
    const builtIn = (ELEMENT_LABELS as Record<string, string>)[activeElement as BuiltInElementType];
    if (builtIn) return builtIn;
    try {
      const rule = getActiveTemplate().rules[activeElement];
      return rule?.label || activeElement;
    } catch {
      return activeElement;
    }
  }, [activeElement, getActiveTemplate]);

  const estimatedRuntime = useMemo(() => {
    if (!editorDoc) return '';
    try {
      const result = computeSceneTiming(editorDoc as any);
      return result.totalSeconds > 0 ? formatRuntime(result.totalSeconds) : '';
    } catch {
      return '';
    }
  }, [editorDoc]);

  // Word count for the active writing goal (words-kind goals only)
  const goalWords = useMemo(() => {
    if (!editorDoc || !goal || goal.kind !== 'words') return 0;
    try { return computeOverviewStats(editorDoc as any, pageCount).totalWords; }
    catch { return 0; }
  }, [editorDoc, goal, pageCount]);
  const goalShowIn = useEditorStore((s) => s.goalShowIn);

  const currentAct = useMemo(() => {
    if (!editorDoc) return '';
    try {
      const structure = computeScriptStructure(editorDoc as any);
      const realActs = structure.acts.filter((a) => a.actNumber > 0);
      if (realActs.length === 0) return '';
      return `${realActs.length} act${realActs.length === 1 ? '' : 's'}`;
    } catch {
      return '';
    }
  }, [editorDoc]);

  return (
    <div className="status-bar">
      <div className="status-left">
        {/*
          * v1.15: show the script's name, and the draft if there is one.
          *
          * This used to render the CONTAINER's name followed by the script title —
          * which made sense when a project was the script and a script was one
          * draft of it. It isn't any more, and the container is invisible plumbing
          * now, so printing its name meant a brand-new script announced itself
          * as "Test" because that was the container it had been filed in.
          */}
        <span className="status-item status-project">
          {documentTitle || 'Untitled'}
          {draftLabel && <span className="status-draft"> - {draftLabel}</span>}
        </span>
        {/* v7.61: when the script last saved, and whether Derek asked for it.
            Right of the script name, in the same dot-separated run as the rest
            of this side. "Saved" vs "Auto-saved" carries the WHICH — a bare
            "Saved 11:04 PM" would leave the two indistinguishable, which is
            the half of the request that is easy to drop. */}
        {lastSave && (
          <>
            <span className="status-sep">&middot;</span>
            <span className="status-item status-lastsave" title={lastSave.title}>
              {lastSave.label}
            </span>
          </>
        )}
        {/* v4.30 batch-v7 #4, Derek: no "Local System - Saved" chatter — saving
            is the normal state. A FAILURE still shows (hiding that would be a
            silent no-op); mirror chips below are other locations and stay. */}
        {saveStatus === 'error' && saveDisplay.label && (
          <>
            <span className="status-sep">&middot;</span>
            <span className={`status-item ${saveDisplay.className}`} title="Home save location">
              {`Local System - ${saveDisplay.label}`}
            </span>
          </>
        )}
        {mirrorChips.map(([name, st]) => (
          <React.Fragment key={name}>
            <span className="status-sep">&middot;</span>
            <span
              className={`status-item ${st === 'saved' ? 'status-saved' : st === 'error' ? 'status-error' : 'status-saving'}`}
              title={`${name} save location`}
            >
              {`${name} - ${st === 'saved' ? 'Saved' : st === 'error' ? 'Error' : 'Saving…'}`}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div className="status-center">
        {!takeoverActive && (
        <span className="status-item status-element">
          {elementLabel}
        </span>
        )}
      </div>
      <div className="status-right">
        {!takeoverActive && <>
        {/* v6.15, Derek: the readout renders here only in Footer mode —
            Toolbar mode mounts the SAME GoalChip in the ribbon. */}
        {goalShowIn === 'footer' && <GoalChip variant="status" words={goalWords} />}
        {currentAct && (
          <span className="status-item status-acts" title="Act structure">
            {currentAct}
          </span>
        )}
        {estimatedRuntime && (
          <span className="status-item status-timing" title="Estimated runtime">
            Est. {estimatedRuntime}
          </span>
        )}
        {revisionMode && (
          <span className="status-item status-revision">
            Rev: {revisionColor}
          </span>
        )}
        <span className="status-item status-page">
          Page {currentPage} of {pageCount}
        </span>
        </>}
        {/* v2.32, Derek: the Local only / account chip lives down here now,
            not in the menu bar. */}
      </div>
    </div>
  );
};

export default StatusBar;
