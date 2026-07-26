/**
 * v4.71, Derek: tabbed windows reopen on their last-used tab — or always on
 * their first tab when Settings ▸ General ▸ "Reopen windows on their last
 * used tab" is off. ONE hook for every tabbed surface (Settings/Customize,
 * Characters, Tags) so the remember/restore rules can't drift per window:
 *   • on open (mount, or the `open` prop turning true): setting on → apply the
 *     remembered tab if it's still valid; setting off → reset to the first tab.
 *   • every tab change while open is recorded (recorded even when the setting
 *     is off, so switching the setting on later starts from real history).
 * A targeted open (e.g. "Save As" sending Settings to Save Options) wins by
 * ordering: callers apply their explicit tab AFTER this hook restores.
 */
import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useWindowTabMemory<T extends string>(
  win: string,
  current: T,
  apply: (t: T) => void,
  first: T,
  valid: readonly T[],
  open = true,
): void {
  // The open-edge effect must see fresh values without re-firing on them.
  const ref = useRef({ current, apply, first, valid });
  ref.current = { current, apply, first, valid };

  useEffect(() => {
    if (!open) return;
    const { current: cur, apply: app, first: fst, valid: ok } = ref.current;
    const { openToLastTab, lastWindowTabs } = useSettingsStore.getState();
    if (!openToLastTab) {
      if (cur !== fst) app(fst);
      return;
    }
    const saved = lastWindowTabs[win] as T | undefined;
    if (saved && saved !== cur && ok.includes(saved)) app(saved);
  }, [win, open]);

  useEffect(() => {
    if (!open) return;
    useSettingsStore.getState().rememberWindowTab(win, current);
  }, [win, current, open]);
}
