/**
 * GuidedSetupDialog (v4.80, Derek) — New Script ▸ Guided Setup. A short
 * walkthrough: name the script, choose where it saves, pick a format, then one
 * friendly page per Customize tab. Every step offers Next or "Skip for now",
 * and nothing is applied by skipping — the defaults stand.
 *
 * SINGLE SOURCE, deliberately: the customize steps EMBED the real Customize
 * tab (CustomizePanelsDialog with soloCategory) under a plain-language
 * heading. So a change to any Customize tab shows up here automatically —
 * the wizard can never drift from the window it walks you through, which is
 * exactly what Derek asked for. The friendly part is the framing, not a
 * second copy of the controls.
 *
 * The customize steps are derived from GUIDED_CUSTOMIZE_STEPS below; adding a
 * Customize tab means adding one entry (title + explanation), not a new page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { SYSTEM_TEMPLATE_LIST } from '../stores/formattingTemplateStore';
import { formatAppDate } from '../utils/dateFormat';
import CustomizePanelsDialog from './CustomizePanelsDialog';
import { SaveLocationsField, CustomizeFromFileField } from './setupFields';
import type { NewScriptMeta } from './NewScriptDialog';

type CustomizeCat = 'elements' | 'toolbar' | 'panels' | 'qat' | 'context' | 'themes';

/** One page per Customize tab, in the order they're met in the window. The
 *  copy explains WHAT the tab is for; the controls themselves are the live
 *  Customize ones. */
const GUIDED_CUSTOMIZE_STEPS: { cat: CustomizeCat; title: string; blurb: string }[] = [
  {
    cat: 'themes',
    title: 'Pick a look',
    blurb: 'Themes set the colors of the app — the editor page stays white for writing either way. Try one; you can switch any time from the View menu.',
  },
  {
    cat: 'elements',
    title: 'The writing elements',
    blurb: 'Scene headings, action, dialogue, transitions — the building blocks of a script. Hide the ones your project never uses so they stay out of the element list, and set what follows what as you write.',
  },
  {
    cat: 'toolbar',
    title: 'The toolbar',
    blurb: 'The row of buttons above your script. Drag in the ones you reach for and drop the ones you do not — sections, dividers and titles are all yours to arrange.',
  },
  {
    cat: 'panels',
    title: 'The side panels',
    blurb: 'Tools like Scenes, Characters and Notes live in the panels beside your script. Choose which appear on the left, which on the right, and how big they are.',
  },
  {
    cat: 'qat',
    title: 'Quick access',
    blurb: 'The small buttons in the title bar at the very top — the handful of actions you want reachable from anywhere.',
  },
  {
    cat: 'context',
    title: 'The right-click menu',
    blurb: 'What appears when you right-click inside your script. Trim it to the actions you actually use.',
  },
];

function formatOptions() {
  const s = useSettingsStore.getState();
  const enabled = s.formatPreferencesInitialized
    ? SYSTEM_TEMPLATE_LIST.filter((t) => s.enabledScriptFormats.includes(t.id))
    : SYSTEM_TEMPLATE_LIST;
  return enabled.length > 0 ? enabled : SYSTEM_TEMPLATE_LIST;
}

export default function GuidedSetupDialog({ open, onClose, onCreate, onBack }: {
  open: boolean;
  onClose: () => void;
  onCreate: (meta: NewScriptMeta) => void;
  onBack?: () => void;
}) {
  const todayVersion = formatAppDate(new Date(), useSettingsStore.getState().dateFormat);
  const defaultDraft = useSettingsStore.getState().defaultDraftLabel || '1st Draft';

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState(defaultDraft);
  const [version, setVersion] = useState(todayVersion);
  const options = useMemo(() => formatOptions(), []);
  const [templateId, setTemplateId] = useState(options[0].id);
  const nameRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setName('');
    setDraft(useSettingsStore.getState().defaultDraftLabel || '1st Draft');
    setVersion(formatAppDate(new Date(), useSettingsStore.getState().dateFormat));
    setTemplateId(formatOptions()[0].id);
    setTimeout(() => nameRef.current?.focus(), 0);
  }, [open]);

  // Each step starts at the top — a long Customize tab otherwise leaves the
  // next page scrolled halfway down.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  if (!open) return null;

  const create = () => onCreate({
    name: name.trim() || 'Untitled Script',
    draft: draft.trim() || defaultDraft,
    version: version.trim(),
    templateId,
  });

  const STEP_COUNT = 3 + GUIDED_CUSTOMIZE_STEPS.length;
  const last = step === STEP_COUNT - 1;
  const next = () => (last ? create() : setStep((s) => s + 1));

  const headings: { title: string; blurb: string }[] = [
    {
      title: 'Name your script',
      blurb: 'Just the essentials. The draft and version show up on the title page and in saved file names.',
    },
    {
      title: 'Where it saves',
      blurb: 'Your script is always kept on this device. These are the extra copies kept in step with it.',
    },
    {
      title: 'What kind of script',
      blurb: 'The format sets the page layout and the elements you write with — a screenplay indents dialogue, a stage play does not.',
    },
    ...GUIDED_CUSTOMIZE_STEPS.map((s) => ({ title: s.title, blurb: s.blurb })),
  ];
  const head = headings[step];

  return (
    <div
      className="dialog-overlay fs-overlay-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="dialog-box fs-guided-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          Guided Setup
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>

        <div className="fs-guided-progress" aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={`fs-guided-pip${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} />
          ))}
          <span className="fs-guided-count">Step {step + 1} of {STEP_COUNT}</span>
        </div>

        <div className="dialog-body fs-guided-body" ref={bodyRef}>
          <h3 className="fs-guided-title">{head.title}</h3>
          <p className="fs-guided-blurb">{head.blurb}</p>

          {step === 0 && (
            <div className="fs-saveas-grid fs-guided-grid">
              <label htmlFor="guided-name">Script Name:</label>
              <input id="guided-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled Script" />
              <label htmlFor="guided-draft">Draft:</label>
              <input id="guided-draft" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={defaultDraft} />
              <label htmlFor="guided-version">Version:</label>
              <input id="guided-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder={todayVersion} />
            </div>
          )}

          {step === 1 && <SaveLocationsField />}

          {step === 2 && (
            <div className="fs-guided-formats">
              {options.map((t) => (
                <label key={t.id} className={`fs-guided-format${templateId === t.id ? ' active' : ''}`}>
                  <input
                    type="radio"
                    name="guided-format"
                    checked={templateId === t.id}
                    onChange={() => setTemplateId(t.id)}
                  />
                  <span className="fs-guided-format-name">{t.name}</span>
                </label>
              ))}
            </div>
          )}

          {step >= 3 && (
            <div className="fs-guided-customize">
              <CustomizePanelsDialog
                open
                embedded
                soloCategory={GUIDED_CUSTOMIZE_STEPS[step - 3].cat}
                onClose={() => {}}
              />
            </div>
          )}

          {step === 0 && (
            <div className="fs-guided-fromfile"><CustomizeFromFileField /></div>
          )}
        </div>

        <div className="fs-guided-foot">
          <span className="fs-guided-note">All of these options can be changed at a later time.</span>
          <div className="fs-guided-actions">
            {step === 0
              ? (onBack && <button onClick={onBack}>← Back</button>)
              : <button onClick={() => setStep((s) => s - 1)}>← Back</button>}
            <button onClick={next} title="Leave this step at its default">Skip for now</button>
            <button className="dialog-primary" onClick={next}>
              {last ? 'Create Script' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
