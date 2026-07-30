/**
 * v5.54, Derek: the Action Rewrite tool — craft-guided rewrites of the
 * selected action lines, from Derek's design handoff (docs/ACTION-REWRITE.md
 * carries the rationale). The craft prompt, the API call, and the BYO
 * Anthropic key live Rust-side (key in the OS keychain, never the webview).
 *
 * v5.58: the free-text writer's note replaced the preset steers.
 * v5.59 (fourth handoff drop): suggestions are EDITABLE drafts with an
 * advisory craft linter; a fourth "Yours" slot composes from sentence-level
 * beats of the other three; every suggestion gets an outcome (accepted with
 * edit classification, or dismissed) recorded to the local rewrite log —
 * that log is the calibration loop, not telemetry, and it never leaves the
 * machine. Accepting applies + records + closes the results in one step so
 * the log can never drift from the script.
 */
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import { FaMagic, FaRegEye, FaRegEyeSlash } from 'react-icons/fa';
import { confirmDialog } from './ConfirmDialog';
import { setRewriteTargetHighlight } from '../editor/extensions/RewriteTarget';
import { useSettingsStore } from '../stores/settingsStore';
import {
  resolveEditorSelection, targetIsCurrent, acceptDraftInEditor,
  rewriteActionLines, recordRewriteOutcome, saveApiKey, hasApiKey, clearApiKey,
  rewriteLogStats, clearRewriteLog,
  prepareDrafts, updateDraft, revertDraft, isDirty, allBeats,
  appendBeatToCustom, appendParagraphBreak, seedCustom, lintActionText,
  SLOT_ORDER, SLOT_LABELS, SLOT_BLURBS, CUSTOM_SLOT, MAX_WRITER_NOTE,
  type Resolved, type PmTarget, type VariantDraft, type DraftSlot,
  type RewriteLogStats,
} from '../utils/actionRewrite';
import { isTauri } from '../services/platform';

type KeyState = 'checking' | 'none' | 'saved' | 'unavailable';

/** v5.60, Derek: the Scrapbook's declutter, on this window's header — hide
 *  every other sidebar tool (and the outline bar) while Action Rewrite is
 *  open, so it's the script and the rewrites and nothing else. Same eye,
 *  same classes, same render-time-only mechanics (ToolDock's solo path). */
export function RewriteHeaderControls() {
  const declutter = useSettingsStore((s) => s.rewriteExclusive);
  const setDeclutter = useSettingsStore((s) => s.setRewriteExclusive);
  return (
    <button
      className={`fs-nb-declutter${declutter ? ' active' : ''}`}
      title={declutter
        ? 'Decluttered — click to show the other tools again'
        : 'Declutter — hide every other tool while this window is open'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); setDeclutter(!declutter); }}
    >{declutter ? <FaRegEyeSlash /> : <FaRegEye />}</button>
  );
}

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'results'; eventId: string; assessment: string; original: string }
  | { status: 'applied'; slot: DraftSlot };

export default function RewriteTool({ editor }: { editor: Editor | null }) {
  const [keyState, setKeyState] = useState<KeyState>('checking');
  const [keyEntry, setKeyEntry] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });
  const [drafts, setDrafts] = useState<VariantDraft[] | null>(null);
  const [beatsOpen, setBeatsOpen] = useState(false);
  const [stale, setStale] = useState(false);
  const [logStats, setLogStats] = useState<RewriteLogStats | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const targetRef = useRef<PmTarget | null>(null);
  // Every suggestion needs exactly one outcome — this guards double-reports
  // and lets unmount/new-request report a pending event as dismissed.
  const pendingEventRef = useRef<string | null>(null);
  // v5.62, Derek: the note belongs to the passage it was written for. When
  // the live target moves to a DISJOINT range (a new set of text), the note
  // clears; caret moves within the same paragraphs keep it.
  const lastOkTargetRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!isTauri()) { setKeyState('unavailable'); return; }
    hasApiKey().then((has) => setKeyState(has ? 'saved' : 'none'))
      .catch(() => setKeyState('none'));
  }, []);

  // A suggestion whose panel closes without a decision is a dismissal —
  // reported on unmount so the log never holds outcome-less suggestions.
  useEffect(() => () => {
    if (pendingEventRef.current) {
      void recordRewriteOutcome({ eventId: pendingEventRef.current, outcome: 'dismissed' });
      pendingEventRef.current = null;
    }
  }, []);

  // Follow the selection (enable/disable + target description).
  useEffect(() => {
    if (!editor) return;
    let t = 0;
    const sync = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const r = resolveEditorSelection(editor);
        setResolved(r);
        if (r.ok) {
          // v5.62: a target disjoint from the last one is NEW text — the
          // old note was written for the old passage, so it clears.
          const prev = lastOkTargetRef.current;
          if (prev && (r.pmTarget.to <= prev.from || prev.to <= r.pmTarget.from)) {
            setNote('');
          }
          lastOkTargetRef.current = { from: r.pmTarget.from, to: r.pmTarget.to };
        }
      }, 250);
    };
    sync();
    editor.on('selectionUpdate', sync);
    editor.on('update', sync);
    return () => {
      window.clearTimeout(t);
      editor.off('selectionUpdate', sync);
      editor.off('update', sync);
    };
  }, [editor]);

  // v5.60, Derek: "my selected text on screen gets unselected" — WebKit
  // stops painting the native selection the moment focus moves into this
  // panel (the note field, a popped-out window's frame). The PM selection
  // itself survives; what was missing is a visible target. Paint the
  // resolved target as an editor decoration: pre-request it follows the
  // caret; from request time it freezes on the captured range (the plugin
  // maps it through edits itself); clear when nothing is targeted or the
  // panel goes away.
  useEffect(() => {
    if (!editor) return;
    if (phase.status === 'loading' || phase.status === 'results') return;
    setRewriteTargetHighlight(editor, resolved?.ok ? {
      from: resolved.pmTarget.from,
      to: resolved.pmTarget.to,
    } : null);
  }, [editor, resolved, phase.status]);
  useEffect(() => () => { setRewriteTargetHighlight(editor, null); }, [editor]);

  // Remap the held target through every transaction; reflect staleness live.
  useEffect(() => {
    if (!editor) return;
    const onTr = ({ transaction }: { transaction: Transaction }) => {
      const target = targetRef.current;
      if (!target || !transaction.docChanged) return;
      target.from = transaction.mapping.map(target.from, 1);
      target.to = transaction.mapping.map(target.to, -1);
      setStale(!targetIsCurrent(editor.state.doc, target));
    };
    editor.on('transaction', onTr);
    return () => { editor.off('transaction', onTr); };
  }, [editor]);

  const refreshLogStats = () => {
    if (!isTauri()) return;
    rewriteLogStats().then(setLogStats).catch(() => setLogStats(null));
  };

  const saveKey = async () => {
    setKeyErr(null);
    try {
      await saveApiKey(keyInput);
      setKeyInput('');
      setKeyEntry(false);
      setKeyState('saved');
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : String(e));
    }
  };

  const removeKey = async () => {
    const sure = await confirmDialog(
      'Remove the saved API key from the keychain? Action Rewrite stops working until a new one is added.',
      { title: 'Remove API Key', confirmLabel: 'Remove', danger: true },
    );
    if (!sure) return;
    try { await clearApiKey(); } catch { /* no entry — same outcome */ }
    setKeyState('none');
  };

  const reportPendingDismissed = () => {
    if (pendingEventRef.current) {
      void recordRewriteOutcome({ eventId: pendingEventRef.current, outcome: 'dismissed' });
      pendingEventRef.current = null;
    }
  };

  const suggest = async () => {
    if (!editor || phase.status === 'loading') return;
    const fresh = resolveEditorSelection(editor, note);
    setResolved(fresh);
    if (!fresh.ok) return;
    reportPendingDismissed();   // a superseded suggestion is a dismissal
    targetRef.current = { ...fresh.pmTarget };
    // freeze the highlight on the captured range for the whole request
    setRewriteTargetHighlight(editor, { from: fresh.pmTarget.from, to: fresh.pmTarget.to });
    setStale(false);
    setDrafts(null);
    setBeatsOpen(false);
    setPhase({ status: 'loading' });
    try {
      const response = await rewriteActionLines(fresh.request);
      pendingEventRef.current = response.eventId;
      setDrafts(prepareDrafts(response));
      setPhase({
        status: 'results',
        eventId: response.eventId,
        assessment: response.assessment,
        original: fresh.request.selection,
      });
    } catch (e) {
      setPhase({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const accept = (draft: VariantDraft) => {
    const target = targetRef.current;
    if (!editor || !target || phase.status !== 'results') return;
    const next = acceptDraftInEditor(editor, target, phase.eventId, draft);
    if (!next) {
      setStale(true);
      return;
    }
    pendingEventRef.current = null;   // outcome recorded by acceptDraftInEditor
    targetRef.current = null;
    setRewriteTargetHighlight(editor, null);
    setDrafts(null);
    setPhase({ status: 'applied', slot: draft.slot });
    refreshLogStats();
  };

  const dismiss = () => {
    reportPendingDismissed();
    setDrafts(null);
    setPhase({ status: 'idle' });
    refreshLogStats();
  };

  const clearLog = async () => {
    const sure = await confirmDialog(
      'Delete the rewrite activity log? It only exists on this machine and feeds the calibration loop.',
      { title: 'Clear Rewrite Log', confirmLabel: 'Delete', danger: true },
    );
    if (!sure) return;
    try { await clearRewriteLog(); } catch { /* gone either way */ }
    refreshLogStats();
  };

  const keyCard = (
    <div className="rw-key-card">
      <div className="rw-key-title">Set up Action Rewrite</div>
      <div className="rw-key-text">
        Rewrites run through your own Anthropic API key. It's stored in the
        system keychain by the desktop app — it never lives in the app's
        files or your scripts.
      </div>
      <input
        className="rw-key-input"
        type="password"
        placeholder="sk-ant-…"
        value={keyInput}
        onChange={(e) => setKeyInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && keyInput.trim()) void saveKey(); }}
      />
      {keyErr && <div className="rw-error">{keyErr}</div>}
      <div className="rw-key-actions">
        <button className="dialog-btn" onClick={() => { setKeyEntry(false); setKeyErr(null); }}>
          Cancel
        </button>
        <button
          className="dialog-btn dialog-btn-primary"
          disabled={!keyInput.trim()}
          onClick={() => void saveKey()}
        >
          Save Key
        </button>
      </div>
    </div>
  );

  const draftCard = (d: VariantDraft) => {
    if (!drafts || phase.status !== 'results') return null;
    const dirty = isDirty(d);
    const warnings = lintActionText(d.draft);
    const isCustom = d.slot === CUSTOM_SLOT;
    return (
      <div key={d.slot} className={`rw-card${isCustom ? ' rw-card-custom' : ''}`}>
        <div className="rw-card-head">
          <span className="rw-card-label">{SLOT_LABELS[d.slot]}</span>
          <span className="rw-card-blurb">{SLOT_BLURBS[d.slot]}</span>
          {dirty && (
            <button
              className="rw-link rw-revert"
              title={isCustom ? 'Clear this slot' : 'Back to what the model offered'}
              onClick={() => setDrafts(revertDraft(drafts, d.slot))}
            >
              {isCustom ? 'Clear' : 'Revert'}
            </button>
          )}
        </div>
        {isCustom && (
          <div className="rw-seed-row">
            <span className="rw-seed-label">Start from:</span>
            <button className="rw-link" onClick={() => setDrafts(seedCustom(drafts, 'original', phase.original))}>Original</button>
            {SLOT_ORDER.filter((s) => s !== CUSTOM_SLOT).map((s) => (
              <button key={s} className="rw-link" onClick={() => setDrafts(seedCustom(drafts, s, phase.original))}>
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
        )}
        {/* v5.61, Derek: full-length suggestions, ONE scroll for the whole
            tool. The wrapper's ::after mirrors the text and sets the height,
            so the textarea grows with its content and never scrolls itself
            (the grid replicated-content trick — pure CSS, re-wraps with the
            panel width). */}
        <div className="rw-grow" data-value={`${d.draft}\n`}>
          <textarea
            className="rw-card-edit"
            rows={2}
            placeholder={isCustom ? 'Write it your way, or borrow beats below…' : undefined}
            value={d.draft}
            onChange={(e) => setDrafts(updateDraft(drafts, d.slot, e.target.value))}
          />
        </div>
        {isCustom && (
          <div className="rw-beats">
            <div className="rw-beats-bar">
              <button className="rw-link" onClick={() => setBeatsOpen((v) => !v)}>
                {beatsOpen ? 'Hide beats' : 'Borrow beats…'}
              </button>
              <button
                className="rw-link"
                title="Start a new paragraph"
                disabled={!d.draft.trim()}
                onClick={() => setDrafts(appendParagraphBreak(drafts))}
              >
                ¶ Break
              </button>
            </div>
            {beatsOpen && (
              <div className="rw-beat-list">
                {allBeats(drafts).map((b) => (
                  <button
                    key={b.id}
                    className="rw-beat"
                    title={`From ${SLOT_LABELS[b.slot]} — click to add`}
                    onClick={() => setDrafts(appendBeatToCustom(drafts, b))}
                  >
                    <span className="rw-beat-src">{SLOT_LABELS[b.slot].slice(0, 1)}</span>
                    {b.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rw-lint">
            {warnings.map((w) => (
              <div key={w.rule + w.message} className="rw-lint-item">{w.message}</div>
            ))}
          </div>
        )}
        <div className="rw-card-foot">
          <span className="rw-card-note">{d.note}</span>
          <button
            className="dialog-btn dialog-btn-primary rw-use"
            disabled={stale || (isCustom && !d.draft.trim())}
            onClick={() => accept(d)}
          >
            Use
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rw-tool">
      {keyState === 'unavailable' && (
        <div className="rw-status">
          <FaMagic className="rw-status-icon" />
          AI rewrites run in the desktop app — this browser build has no
          rewrite engine. Selection targeting below still works.
        </div>
      )}
      {keyState === 'none' && !keyEntry && (
        <div className="rw-key-card">
          <div className="rw-key-title">Set up Action Rewrite</div>
          <div className="rw-key-text">
            Select action lines and get three craft-guided rewrites — faithful,
            compressed, reimagined — plus a slot to compose your own from their
            best lines. Bring your own Anthropic API key to start.
          </div>
          <div className="rw-key-actions">
            <button className="dialog-btn dialog-btn-primary" onClick={() => setKeyEntry(true)}>
              Add API Key…
            </button>
          </div>
        </div>
      )}
      {keyEntry && keyCard}

      <div className="rw-note-row">
        <input
          className="rw-note"
          type="text"
          placeholder="What’s this beat for? Anything that must stay?"
          title="Optional note to the rewriter — it guides interpretation, never overrides the craft rules"
          maxLength={MAX_WRITER_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void suggest(); }}
        />
        {note.length > 0 && (
          <span className={`rw-note-count${note.length >= MAX_WRITER_NOTE ? ' full' : ''}`}>
            {note.length}/{MAX_WRITER_NOTE}
          </span>
        )}
      </div>
      <div className="rw-ctl-row">
        <button
          className="dialog-btn dialog-btn-primary rw-go"
          disabled={keyState !== 'saved' || !resolved?.ok || phase.status === 'loading'}
          onClick={() => void suggest()}
        >
          {phase.status === 'loading' ? 'Thinking…' : 'Suggest Rewrites'}
        </button>
      </div>

      {resolved && !resolved.ok && (
        <div className="rw-target rw-target-off">{resolved.reason}</div>
      )}
      {resolved?.ok && (
        <div className="rw-target">
          Target: {resolved.paragraphs} action paragraph{resolved.paragraphs === 1 ? '' : 's'}
          {resolved.adjusted && resolved.adjustedReason && (
            <span className="rw-adjusted"> — {resolved.adjustedReason}</span>
          )}
        </div>
      )}

      <div className="rw-body">
        {phase.status === 'error' && (
          <div className="rw-error">
            {phase.message}
            <button className="dialog-btn rw-retry" onClick={() => void suggest()}>
              Try Again
            </button>
          </div>
        )}
        {phase.status === 'loading' && (
          <div className="rw-status">Reading the scene and drafting three takes…</div>
        )}
        {phase.status === 'applied' && (
          <div className="rw-status">
            Applied the {SLOT_LABELS[phase.slot]} version — ⌘Z brings the
            original back.
          </div>
        )}
        {phase.status === 'results' && drafts && (
          <>
            <div className="rw-results-bar">
              {phase.assessment === 'already_strong'
                ? <span className="rw-strong-inline">Already reads strong — optional takes.</span>
                : <span className="rw-results-title">Three takes + yours</span>}
              <button className="rw-link" onClick={dismiss}>Dismiss</button>
            </div>
            {stale && (
              <div className="rw-stale">
                The script changed under this rewrite — reselect the passage
                and run it again to apply.
              </div>
            )}
            {SLOT_ORDER.map((slot) => {
              const d = drafts.find((x) => x.slot === slot);
              return d ? draftCard(d) : null;
            })}
          </>
        )}
        {phase.status === 'idle' && keyState === 'saved' && (
          <div className="rw-status">
            Select action lines in the script, then hit Suggest Rewrites. Every
            suggestion is editable before you apply it.
          </div>
        )}
      </div>

      {keyState === 'saved' && (
        <div className="rw-foot">
          <span>API key: saved</span>
          <button className="rw-link" onClick={() => setKeyEntry(true)}>Change</button>
          <button className="rw-link" onClick={() => void removeKey()}>Remove</button>
          <span className="rw-foot-gap" />
          <button
            className="rw-link"
            onClick={() => { setLogOpen((v) => !v); if (!logOpen) refreshLogStats(); }}
          >
            Activity log
          </button>
        </div>
      )}
      {logOpen && keyState === 'saved' && (
        <div className="rw-log">
          {logStats ? (
            <>
              <div className="rw-log-line">
                {logStats.suggestions} suggestion{logStats.suggestions === 1 ? '' : 's'} ·{' '}
                {logStats.accepted} accepted · {logStats.dismissed} dismissed
                {logStats.composed > 0 && <> · {logStats.composed} composed</>}
              </div>
              <div className="rw-log-line rw-log-path" title={logStats.path}>
                {logStats.path}
              </div>
              <div className="rw-log-line rw-log-hint">
                Local only — this file feeds the calibration harvest
                (scripts/harvest-calibration.mjs).
                <button className="rw-link" onClick={() => void clearLog()}>Clear log</button>
              </div>
            </>
          ) : (
            <div className="rw-log-line">No log yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
