/**
 * FeedbackTool (v4.23 as an Airtable iframe; v6.84 NATIVE) — Derek: a
 * feedback system without Airtable, and sign-in so a submission already
 * knows who sent it.
 *
 * The cross-origin iframe is gone, and with it every workaround it forced:
 * the preloaded FeedbackFrameHost, the rect-streaming placeholder, and the
 * v4.70/v5.00 screenshot chip (copy-or-download across the frame boundary —
 * the form owns a real attach button now). Submissions go to Derek's own
 * Supabase table through services/feedbackBackend; sign-in is an email +
 * 6-digit code (no passwords, no deep links — WKWebView-safe).
 *
 * Failure is never silent: a submit that can't reach the server lands in a
 * visible local queue with a Retry button, and sign-in problems say what to
 * do in words.
 */
import { useEffect, useState } from 'react';
import { FaCamera, FaCrop, FaTimes } from 'react-icons/fa';
import {
  type FeedbackSession, SignedOutError,
  loadFeedbackSession, signOutFeedback,
  requestFeedbackCode, verifyFeedbackCode, setFeedbackDisplayName,
  submitFeedback, enqueueFeedback, loadFeedbackQueue, drainFeedbackQueue,
} from '../services/feedbackBackend';
import { captureToCanvas } from '../utils/screenshot';
import { showToast } from './Toast';

const CATEGORIES = ['Bug', 'Idea', 'Praise', 'Other'] as const;

interface Shot { blob: Blob; url: string; dataUrl: string }

async function canvasToShot(canvas: HTMLCanvasElement): Promise<Shot> {
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not encode the image.');
  return { blob, url: URL.createObjectURL(blob), dataUrl: canvas.toDataURL('image/png') };
}

export default function FeedbackTool() {
  const [session, setSession] = useState<FeedbackSession | null>(() => loadFeedbackSession());
  /** signed-out steps: enter email → enter the emailed code → (name once) */
  const [step, setStep] = useState<'email' | 'code' | 'name'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Bug');
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState<Shot | null>(null);
  const [queued, setQueued] = useState(() => loadFeedbackQueue().length);
  const [sentNote, setSentNote] = useState<string | null>(null);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null);
    try { await fn(); } catch (e) {
      setNote(e instanceof Error ? e.message : 'Something went wrong — try again.');
    } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    await requestFeedbackCode(email.trim());
    setStep('code');
    setNote(`Code sent to ${email.trim()} — it arrives within a minute. Enter the 6-digit code from the email.`);
  });

  const verify = () => run(async () => {
    const s = await verifyFeedbackCode(email.trim(), code);
    setCode('');
    if (!s.name) { setStep('name'); setSession(s); return; }
    setSession(s);
  });

  const saveName = () => run(async () => {
    const s = await setFeedbackDisplayName(nameDraft.trim());
    setSession(s);
    setStep('email');
  });

  const capture = (mode: 'full' | 'area') => run(async () => {
    const canvas = await captureToCanvas(mode, 'fs-shot-veil-feedback');
    if (!canvas) return;                      // cancelled the area drag
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(await canvasToShot(canvas));
  });

  const submit = () => run(async () => {
    const payload = { category, message: message.trim() };
    try {
      await submitFeedback(payload, shot?.blob ?? null);
      setMessage('');
      if (shot) { URL.revokeObjectURL(shot.url); setShot(null); }
      setSentNote('Sent — thank you!');
      window.setTimeout(() => setSentNote(null), 4000);
    } catch (e) {
      if (e instanceof SignedOutError) { setSession(null); setStep('email'); throw e; }
      // Not silent, not lost: queue it where the writer can SEE it.
      const left = enqueueFeedback({ payload, shotDataUrl: shot?.dataUrl, queuedAt: new Date().toISOString() });
      setQueued(left);
      setMessage('');
      if (shot) { URL.revokeObjectURL(shot.url); setShot(null); }
      throw new Error(`Could not reach the feedback server — saved to the local queue instead (${left} waiting). ${e instanceof Error ? e.message : ''}`);
    }
  });

  const retryQueue = () => run(async () => {
    const { sent, left } = await drainFeedbackQueue();
    setQueued(left);
    if (sent > 0) showToast(`Sent ${sent} queued feedback item${sent === 1 ? '' : 's'}`, 'success');
    if (left > 0) throw new Error(`${left} still could not be sent — they stay in the queue.`);
  });

  /* ── signed-out: the three-step sign-in card ── */
  if (!session || step === 'name') {
    return (
      <div className="feedback-tool-wrap fb-signin">
        <h3 className="fb-title">Send Feedback</h3>
        {step !== 'name' && (
          <p className="fb-hint">
            Sign in once with your email — no password. Your feedback then
            carries your name automatically.
          </p>
        )}
        {note && <div className="fb-note">{note}</div>}
        {step === 'email' && (
          <div className="fb-row">
            <input
              className="fb-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) sendCode(); }}
            />
            <button className="dialog-btn dialog-btn-primary fb-go" disabled={busy || !email.trim()} onClick={sendCode}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </div>
        )}
        {step === 'code' && (
          <div className="fb-row">
            <input
              className="fb-input fb-code"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.trim().length >= 6) verify(); }}
            />
            <button className="dialog-btn dialog-btn-primary fb-go" disabled={busy || code.trim().length < 6} onClick={verify}>
              {busy ? 'Checking…' : 'Verify'}
            </button>
            <button className="dialog-btn fb-back" disabled={busy} onClick={() => { setStep('email'); setNote(null); }}>
              Different email
            </button>
          </div>
        )}
        {step === 'name' && (
          <div className="fb-row">
            <input
              className="fb-input"
              placeholder="Your name (shown with your feedback)"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim()) saveName(); }}
            />
            <button className="dialog-btn dialog-btn-primary fb-go" disabled={busy || !nameDraft.trim()} onClick={saveName}>
              {busy ? 'Saving…' : 'Save name'}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── signed-in: the form ── */
  return (
    <div className="feedback-tool-wrap fb-form">
      <div className="fb-who">
        Signing as <strong>{session.name ?? session.email}</strong>
        {session.name ? <span className="fb-who-mail"> ({session.email})</span> : null}
        <button
          className="fb-signout"
          title="Sign out — feedback will ask for your email again"
          onClick={() => { signOutFeedback(); setSession(null); setStep('email'); setNote(null); }}
        >Sign out</button>
      </div>

      {note && <div className="fb-note">{note}</div>}
      {sentNote && <div className="fb-sent">{sentNote}</div>}
      {queued > 0 && (
        <div className="fb-queued">
          {queued} feedback item{queued === 1 ? '' : 's'} waiting to send
          <button className="dialog-btn fb-retry" disabled={busy} onClick={retryQueue}>Retry now</button>
        </div>
      )}

      <label className="fb-label">
        Category
        <select className="fb-select" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="fb-label fb-label-grow">
        What happened, or what should change?
        <textarea
          className="fb-text"
          placeholder="Describe it — steps, what you expected, what you got."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      <div className="fb-shotrow">
        {!shot ? (
          <>
            <button className="dialog-btn" disabled={busy} title="Attach a screenshot of the whole window" onClick={() => capture('full')}>
              <FaCamera aria-hidden /> Screenshot
            </button>
            <button className="dialog-btn" disabled={busy} title="Attach a screenshot of a selected area" onClick={() => capture('area')}>
              <FaCrop aria-hidden /> Area
            </button>
          </>
        ) : (
          <span className="fb-shotchip">
            <img className="fb-shotthumb" src={shot.url} alt="Attached screenshot" />
            <span>Screenshot attached</span>
            <button
              className="fb-shot-x"
              title="Remove the screenshot"
              onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}
            ><FaTimes aria-hidden /></button>
          </span>
        )}
        <span className="fb-spacer" />
        <button
          className="dialog-btn dialog-btn-primary fb-send"
          disabled={busy || !message.trim()}
          title="Send this feedback"
          onClick={submit}
        >{busy ? 'Sending…' : 'Send Feedback'}</button>
      </div>
    </div>
  );
}
