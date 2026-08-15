/**
 * saveFlash (v7.14) — Derek: "when saving, move the 'Saved' indicator into the
 * quick access bar instead of the bottom right corner of the app."
 *
 * It used to be a toast, which is the app's channel for things that happened
 * somewhere ELSE and might need reading. A save is neither: you pressed the
 * key, you know what you did, and the confirmation belongs where the Save
 * button is. So the flash lives in the Quick Access bar and fades on its own.
 *
 * Same shape as Toast's tiny pub/sub — one emitter, any number of listeners —
 * so nothing has to reach into a component to show it.
 */
const listeners = new Set<(text: string) => void>();

/** Show the flash. Called wherever a save reports success. */
export function flashSaved(text = 'Saved'): void {
  listeners.forEach((fn) => fn(text));
}

export function subscribeSaveFlash(fn: (text: string) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** How long it stays up. Exported so the check can wait exactly that long. */
export const SAVE_FLASH_MS = 1800;
