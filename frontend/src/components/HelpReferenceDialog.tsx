import React from 'react';
import { useShortcutStore } from '../stores/shortcutStore';
import { SHORTCUT_COMMANDS, formatCombo } from './shortcuts';

/**
 * HelpReferenceDialog — Help menu content, ported from ScriptCraft v5.5's
 * HelpModal and KnowledgeBaseModal and updated for this app:
 *   - kind="shortcuts": the keyboard shortcut grid
 *   - kind="knowledge": the in-app Knowledge Base document
 */

/**
 * v0.97 — this list used to be a hardcoded array, so a shortcut you rebound in
 * Customize was still shown here with its OLD key. It now reads the LIVE bindings
 * from the shortcut store, which is the same source the menus and the key handler
 * use — so rebinding, clearing or resetting a shortcut shows up here immediately,
 * and this window can't drift out of date again.
 */
const EXTRA_SHORTCUTS: [string, string][] = [
  // Gestures and behaviours, not rebindable commands — so they have no entry in
  // the registry and are listed alongside it.
  ['Tab / Enter', 'Cycle to the next logical element while writing'],
  ['⌥-click a note highlight', 'Open Notes focused on that note'],
  ['Right-click selection', 'Add Note, Production Tag, and more'],
];

function Shortcuts() {
  const bindings = useShortcutStore((s) => s.bindings);
  const overrides = useShortcutStore((s) => s.overrides);

  // Group in registry order; only commands that actually have a key.
  const groups: { group: string; rows: { label: string; combo: string; custom: boolean }[] }[] = [];
  for (const cmd of SHORTCUT_COMMANDS) {
    const combo = bindings[cmd.id];
    if (!combo) continue;                       // unbound — nothing to show
    let g = groups.find((x) => x.group === cmd.group);
    if (!g) { g = { group: cmd.group, rows: [] }; groups.push(g); }
    g.rows.push({
      label: cmd.label,
      combo: formatCombo(combo),
      custom: Object.prototype.hasOwnProperty.call(overrides, cmd.id)
        && overrides[cmd.id] !== cmd.defaultCombo,
    });
  }

  return (
    <div className="fs-help-shortcuts">
      {groups.map((g) => (
        <div key={g.group} className="fs-help-group">
          <h4 className="fs-help-group-head">{g.group}</h4>
          <div className="fs-help-grid">
            {g.rows.map((r) => (
              <div key={r.label} className="fs-help-row">
                <span className={`fs-kbd${r.custom ? ' fs-kbd-custom' : ''}`}>{r.combo}</span>
                <span>{r.label}{r.custom && <span className="fs-help-custom-tag">customized</span>}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="fs-help-group">
        <h4 className="fs-help-group-head">Other</h4>
        <div className="fs-help-grid">
          {EXTRA_SHORTCUTS.map(([k, d]) => (
            <div key={k} className="fs-help-row">
              <span className="fs-kbd">{k}</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Knowledge() {
  const H = ({ children }: { children: React.ReactNode }) => <h4 className="fs-kb-h">{children}</h4>;
  const P = ({ children }: { children: React.ReactNode }) => <p className="fs-kb-p">{children}</p>;
  return (
    <div>
      <P>ScriptCraft is a script editor. You write in formatted elements (scene headings,
      action, dialogue, transitions) positioned at spec print columns — Courier, standard
      margins, about 55 lines per page. Everything below is reachable from the menus, the
      toolbar, or the Tool Panels on either side of the page.</P>

      <H>File</H>
      <P><b>Save</b> writes to the app's library; <b>Save As</b> downloads a local .odraft file;
      <b> Save to Cloud</b> signs in and stores the script on your ScriptCraft Cloud account.
      <b> Auto Saves</b> holds Check In plus every saved version — compare or restore any of them.
      Import and export cover Final Draft (.fdx), Fountain, Word, and PDF.</P>

      <H>Tool Panels</H>
      <P>Photoshop-style tool lists flank the editor. Click a tool to open it — small tools expand
      inside the panel; larger ones float in a resizable window. A window's size is remembered per
      tool. <b>View → Customize Layout</b> controls which tools appear, on which side, the toolbar
      mode, and pinned toolbar buttons.</P>

      <H>Tools</H>
      <P><b>Navigator</b> — the outline: scenes, acts, script notes, and to-dos, each jumpable.
      <b> Scenes / Pages / Locations</b> — structure views of the script. <b>Characters</b> —
      profiles, relationship map, and gender data. <b>Index Cards</b> and <b>Outline</b> —
      story planning surfaces. <b>Analytics</b> — statistics organized into Overview, Scenes,
      Dialogue, Characters, Timing, and Gender tabs. <b>Goals</b> — word, page, or timed writing
      targets with live progress in the status bar.</P>

      <H>Sticky Notes, Snippets, To-Do</H>
      <P><b>Sticky Notes</b> holds General cards plus Script notes anchored to text (select text,
      right-click, Add Note; ⌥-click a highlight to jump to its card). <b>Snippets</b>
      receives text cut (⌥⌘X) or copied (⌥⌘C) from the editor. <b>To-Do</b> holds to-do lists; ones added to the script show the scene they’re in.
      All cards take sticky colors, drag to reorder, have editable title headers, and show their
      creation date.</P>

      <H>Title Page</H>
      <P>Insert → Title Page opens the structured editor: title (two rows, each with its own font
      size), byline, draft, contact, and images. The title page always lays out as exactly one page.</P>

      <H>Production</H>
      <P><b>Production Tags</b> marks props, wardrobe, and more inline. <b>Revision Mode</b> marks
      every line you touch. Scene numbers, watermarks, and MORE/CONT'D behavior live under Format.</P>
    </div>
  );
}

interface Props {
  kind: 'shortcuts' | 'knowledge';
  open: boolean;
  onClose: () => void;
}

export default function HelpReferenceDialog({ kind, open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box fs-help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          {kind === 'shortcuts' ? 'Keyboard Shortcuts' : 'Knowledge Base'}
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>
        <div className="dialog-body fs-help-body">
          {kind === 'shortcuts' ? <Shortcuts /> : <Knowledge />}
        </div>
        {kind === 'shortcuts' && (
          <div className="dialog-footer">
            {/* This window LISTS the shortcuts; changing them lives in Customize
                (v0.85). Sends the user straight to the right tab. */}
            <button
              className="dialog-btn-primary"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('scriptcraft:command', { detail: 'customizeShortcuts' }));
                onClose();
              }}
            >Customize Keyboard Shortcuts...</button>
          </div>
        )}
      </div>
    </div>
  );
}
