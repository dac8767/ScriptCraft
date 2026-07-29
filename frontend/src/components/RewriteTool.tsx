/**
 * v5.54, Derek: the Action Rewrite tool — three craft-guided rewrites of the
 * selected action lines (cut / sharpen / restructure), from Derek's design
 * handoff. The craft prompt lives Rust-side (src-tauri/prompts/) along with
 * the API call and the BYO Anthropic key (OS keychain — never the webview);
 * this panel owns selection state, the request, and applying a variant.
 *
 * Behavior contract (from the handoff):
 * - The panel follows the selection live; a selection with no action lines
 *   shows WHY the button is disabled, never a dead control.
 * - A clamped range says so ("Trimmed to the action lines…").
 * - assessment === "already_strong" softens the presentation — the tool
 *   must not manufacture problems.
 * - Positions are remapped through every edit and the applied range is
 *   re-validated before writing — a stale range is refused, not applied.
 * - Applying a second variant replaces the first (the target retargets on
 *   apply); undo is the editor's own history.
 */
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import { FaMagic } from 'react-icons/fa';
import { confirmDialog } from './ConfirmDialog';
import {
  resolveEditorSelection, applyVariantToEditor, targetIsCurrent,
  rewriteActionLines, saveApiKey, hasApiKey, clearApiKey,
  STRATEGY_LABELS, STRATEGY_BLURBS, MAX_WRITER_NOTE,
  type Resolved, type RewriteResponse,
  type RewriteVariant, type PmTarget,
} from '../utils/actionRewrite';
import { isTauri } from '../services/platform';

type KeyState = 'checking' | 'none' | 'saved' | 'unavailable';

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; response: RewriteResponse };

export default function RewriteTool({ editor }: { editor: Editor | null }) {
  const [keyState, setKeyState] = useState<KeyState>('checking');
  const [keyEntry, setKeyEntry] = useState(false);   // the paste-a-key card
  const [keyInput, setKeyInput] = useState('');
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  // v5.58 (third handoff drop): free text replaced the preset-steer enum —
  // the one thing the model can't infer is what the beat is FOR and which
  // detail must SURVIVE, and that isn't enumerable.
  const [note, setNote] = useState('');
  const [req, setReq] = useState<RequestState>({ status: 'idle' });
  const [applied, setApplied] = useState<string | null>(null);   // strategy
  const [stale, setStale] = useState(false);
  // The PM range a Use click writes into — remapped through every doc edit,
  // re-validated before any write.
  const targetRef = useRef<PmTarget | null>(null);

  useEffect(() => {
    if (!isTauri()) { setKeyState('unavailable'); return; }
    hasApiKey().then((has) => setKeyState(has ? 'saved' : 'none'))
      .catch(() => setKeyState('none'));
  }, []);

  // Follow the selection (enable/disable + target description). Synchronous
  // and network-free per the handoff — safe on every debounced change.
  useEffect(() => {
    if (!editor) return;
    let t = 0;
    const sync = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setResolved(resolveEditorSelection(editor)), 250);
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

  // Remap the in-flight/held target through every transaction, and reflect
  // staleness in the UI the moment the held text no longer matches.
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

  const suggest = async () => {
    if (!editor || req.status === 'loading') return;
    // Re-resolve at request time WITH the note — the live resolve is for
    // enablement only.
    const fresh = resolveEditorSelection(editor, note);
    setResolved(fresh);
    if (!fresh.ok) return;
    targetRef.current = { ...fresh.pmTarget };
    setStale(false);
    setApplied(null);
    setReq({ status: 'loading' });
    try {
      const response = await rewriteActionLines(fresh.request);
      setReq({ status: 'done', response });
    } catch (e) {
      setReq({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const useVariant = (variant: RewriteVariant) => {
    const target = targetRef.current;
    if (!editor || !target) return;
    const next = applyVariantToEditor(editor, target, variant.text);
    if (!next) {
      setStale(true);
      return;
    }
    targetRef.current = next;
    setStale(false);
    setApplied(variant.strategy);
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

  const variantCard = (variant: RewriteVariant) => {
    const isApplied = applied === variant.strategy;
    return (
      <div key={variant.strategy} className={`rw-card${isApplied ? ' applied' : ''}`}>
        <div className="rw-card-head">
          <span className="rw-card-label">{STRATEGY_LABELS[variant.strategy] ?? variant.strategy}</span>
          <span className="rw-card-blurb">{STRATEGY_BLURBS[variant.strategy] ?? ''}</span>
        </div>
        <div className="rw-card-text">{variant.text}</div>
        <div className="rw-card-foot">
          <span className="rw-card-note">{variant.note}</span>
          <button
            className="dialog-btn dialog-btn-primary rw-use"
            disabled={stale && !isApplied}
            onClick={() => useVariant(variant)}
          >
            {isApplied ? 'Applied ✓' : 'Use'}
          </button>
        </div>
      </div>
    );
  };

  const results = req.status === 'done' ? req.response : null;

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
            Select action lines and get three craft-guided rewrites — cut,
            sharpen, restructure — each with a note on what changed and why.
            Bring your own Anthropic API key to start.
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
          disabled={keyState !== 'saved' || !resolved?.ok || req.status === 'loading'}
          onClick={() => void suggest()}
        >
          {req.status === 'loading' ? 'Thinking…' : 'Suggest Rewrites'}
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
        {req.status === 'error' && (
          <div className="rw-error">
            {req.message}
            <button className="dialog-btn rw-retry" onClick={() => void suggest()}>
              Try Again
            </button>
          </div>
        )}
        {req.status === 'loading' && (
          <div className="rw-status">Reading the scene and drafting three takes…</div>
        )}
        {results && (
          <>
            {results.assessment === 'already_strong' && (
              <div className="rw-strong">
                This passage already reads strong. These are optional takes,
                not corrections.
              </div>
            )}
            {stale && (
              <div className="rw-stale">
                The script changed under this rewrite — reselect the passage
                and run it again to apply.
              </div>
            )}
            {results.variants.map(variantCard)}
          </>
        )}
        {req.status === 'idle' && keyState === 'saved' && (
          <div className="rw-status">
            Select action lines in the script, then hit Suggest Rewrites.
          </div>
        )}
      </div>

      {keyState === 'saved' && (
        <div className="rw-foot">
          API key: saved in keychain
          <button className="rw-link" onClick={() => setKeyEntry(true)}>
            Change
          </button>
          <button className="rw-link" onClick={() => void removeKey()}>Remove</button>
        </div>
      )}
    </div>
  );
}
