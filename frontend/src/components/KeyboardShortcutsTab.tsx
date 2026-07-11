/**
 * Customize → Keyboard Shortcuts (v0.77).
 *
 * Lists every command grouped by menu — those WITH a shortcut and those
 * without, so an unbound command can be given one. Click a binding to record:
 * the next key combo you press becomes the shortcut.
 *
 * Conflicts are detected and resolved explicitly: assigning a combo that's
 * already taken unbinds the other command (and says which), rather than
 * silently creating two commands on one key where only one would ever fire.
 */
import React from 'react';
import { useShortcutStore } from '../stores/shortcutStore';
import {
  SHORTCUT_COMMANDS, SHORTCUT_GROUPS, COMMAND_BY_ID,
  eventToCombo, formatCombo, findConflict,
} from './shortcuts';

export default function KeyboardShortcutsTab() {
  const bindings = useShortcutStore((s) => s.bindings);
  const overrides = useShortcutStore((s) => s.overrides);
  const setBinding = useShortcutStore((s) => s.setBinding);
  const resetBinding = useShortcutStore((s) => s.resetBinding);
  const resetAll = useShortcutStore((s) => s.resetAll);

  const [recording, setRecording] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string>('');

  // While recording, swallow every keystroke so the combo can't also trigger
  // the command it's being assigned to (or the browser's own handler).
  React.useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') { setRecording(null); setNote(''); return; }

      const combo = eventToCombo(e);
      if (!combo) return;   // modifier held on its own — keep listening

      const clash = findConflict(bindings, combo, recording);
      if (clash) {
        // One key can only run one command, so take it from the other and say so.
        setBinding(clash, null);
        setNote(`${formatCombo(combo)} was assigned to “${COMMAND_BY_ID[clash].label}” — that command is now unbound.`);
      } else {
        setNote('');
      }
      setBinding(recording, combo);
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, bindings, setBinding]);

  const rows = (group: string) => SHORTCUT_COMMANDS.filter((c) => c.group === group);

  return (
    <section>
      <h3>Keyboard Shortcuts</h3>
      <p className="fs-customize-hint">
        Click a shortcut to change it, then press the keys you want. Esc cancels.
        Commands with no shortcut can be given one. Cut, Copy, Paste, Undo, Redo
        and Select All are handled by your operating system and can’t be
        reassigned here.
      </p>

      {note && <p className="fs-shortcut-note">{note}</p>}

      {SHORTCUT_GROUPS.map((group) => {
        const items = rows(group);
        if (!items.length) return null;
        return (
          <div key={group} className="fs-shortcut-group">
            <div className="fs-shortcut-group-title">{group}</div>
            {items.map((c) => {
              const combo = bindings[c.id];
              const isRec = recording === c.id;
              const locked = c.owner === 'system';
              const customized = Object.prototype.hasOwnProperty.call(overrides, c.id);
              return (
                <div className="fs-customize-row fs-shortcut-row" key={c.id}>
                  <span className="fs-customize-tool">{c.label}</span>
                  <span className="fs-shortcut-controls">
                    <button
                      className={`fs-shortcut-key${isRec ? ' recording' : ''}${!combo ? ' unset' : ''}`}
                      disabled={locked}
                      title={locked
                        ? 'Handled by your operating system'
                        : isRec ? 'Press a key combination… (Esc to cancel)'
                        : 'Click, then press the keys you want'}
                      onClick={() => { if (!locked) { setNote(''); setRecording(isRec ? null : c.id); } }}
                    >
                      {isRec ? 'Press keys…' : combo ? formatCombo(combo) : 'Not set'}
                    </button>
                    <button
                      className="fs-shortcut-clear"
                      disabled={locked || !combo}
                      title="Remove this shortcut"
                      onClick={() => { setNote(''); setBinding(c.id, null); }}
                    >Clear</button>
                    <button
                      className="fs-shortcut-clear"
                      disabled={locked || !customized}
                      title="Restore the default shortcut"
                      onClick={() => { setNote(''); resetBinding(c.id); }}
                    >Reset</button>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="fs-tbzone-adders fs-adders-equal">
        <button
          className="swn-add-btn"
          title="Restore every shortcut to its default"
          onClick={() => { setRecording(null); setNote(''); resetAll(); }}
        >Reset All Shortcuts</button>
      </div>
    </section>
  );
}
