/**
 * FeedbackTool (v4.23, Derek) — the dockable side-panel form of Feedback. It
 * renders the SAME embedded feedback form the Help → Feedback menu opens in a
 * modal, reading the URL from the shared helpForms module so the two entry
 * points can't drift. Docking it lets the writer keep the form open beside the
 * script instead of in a blocking dialog.
 */
import { HELP_FORMS } from '../data/helpForms';

export default function FeedbackTool() {
  return (
    <div className="feedback-tool">
      <iframe
        className="feedback-tool-frame"
        src={HELP_FORMS.feedback.url}
        title={HELP_FORMS.feedback.title}
      />
    </div>
  );
}
