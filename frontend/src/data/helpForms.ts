/**
 * v4.23, Derek: the embeddable help/feedback forms, in ONE place. The Help menu
 * opens the feedback form in a modal (MenuBar), and the dockable Feedback tool
 * (FeedbackTool) renders the same URL in a panel — both read this, so the form
 * address can never drift between the two entry points.
 */
export const HELP_FORMS = {
  feedback: { title: 'Feedback', url: 'https://airtable.com/embed/appEkGNRsf05IzdNq/pagnRKrWVIbujv2Wf/form' },
} as const;
