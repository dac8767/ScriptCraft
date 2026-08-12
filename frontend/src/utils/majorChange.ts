/**
 * runMajorChange (v6.77) — Derek: "i accidentally hit the 'reset helper
 * text' button and all my hard work disappeared. for this any any button
 * that makes major changes, always include a warning window."
 *
 * THE wrapper for a button that wipes or bulk-replaces the writer's work:
 *   1. a warning window first (ConfirmDialog, danger-styled),
 *   2. capture the state it is about to destroy,
 *   3. run it,
 *   4. register the pair on the window-undo lane, so ⌘Z brings it back
 *      (stores/windowUndoStore + smartUndo routing).
 *
 * Every guarded button goes through here — the warning, the undo entry and
 * the toast can't drift apart per button. The confirm text ends by saying
 * the change is undoable, in the platform's own key label, because a
 * warning that doesn't mention the way back reads scarier than it is.
 */
import { confirmDialog } from '../components/ConfirmDialog';
import { showToast } from '../components/Toast';
import { useWindowUndoStore } from '../stores/windowUndoStore';
import { formatCombo } from '../components/shortcuts';

export interface MajorChange {
  /** Warning window title ("Reset Helper Text"). */
  title: string;
  /** The warning's body — what is lost, in plain words. The undo hint is
   *  appended here, not written per caller. */
  message: string;
  /** Confirm button label; defaults to the title's first word ("Reset"). */
  confirmLabel?: string;
  /** The undo entry's label — what a toast calls it ("Reset helper text"). */
  label: string;
  /** Snapshot the state about to change; returns the closure that puts it
   *  back. Runs only after the writer confirms. */
  capture: () => () => void;
  run: () => void;
  /** Success toast after running; omit for silent (the UI itself shows it). */
  toast?: string;
}

/** ⌘Z on the Mac, Ctrl+Z elsewhere — the same formatter the menus use. */
export const undoKeyLabel = (): string => formatCombo('Mod+Z');

export async function runMajorChange(c: MajorChange): Promise<boolean> {
  const ok = await confirmDialog(
    `${c.message}\n\nYou can undo this afterwards with ${undoKeyLabel()}.`,
    { title: c.title, confirmLabel: c.confirmLabel ?? c.title.split(' ')[0], danger: true },
  );
  if (!ok) return false;
  const restore = c.capture();
  c.run();
  useWindowUndoStore.getState().push(c.label, restore, c.run);
  if (c.toast) showToast(c.toast, 'success');
  return true;
}
