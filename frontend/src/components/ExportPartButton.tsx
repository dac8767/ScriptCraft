/**
 * ExportPartButton (v7.74, Derek) — "make it so I can export design and helper
 * text info. these two windows are not going to be part of the release. I will
 * export a file from each for you to integrate into the code directly."
 *
 * ONE button, rendered by both windows. They are the same act — take what this
 * window governs and write it to a file — and the two would otherwise be two
 * copies of the same twelve lines, drifting the moment either window changed.
 *
 * THE FILE IS A PRESET BUNDLE WITH ONE PART. That is the whole design decision
 * here, and it is what stops this becoming a new file format nothing can read:
 *
 *   • the payload comes from PRESET_PARTS' own `collect()`, so a window's
 *     export and the same window's slice of a full preset are the same bytes;
 *   • readPresetFile already understands it, so the file imports straight back
 *     through Settings ▸ Backup & Restore. A file the app writes must never be
 *     a file the app cannot read — the rule presets.ts states in its header;
 *   • and it costs no new reader, no new `kind`, no second apply path.
 *
 * The filename carries the type, per the standing rule that you can tell what
 * a preset file holds by looking at it: `scriptcraft-2026-08-22_design.json`.
 */
import { useState } from 'react';
import { FaDownload, FaCheck } from 'react-icons/fa';
import {
  buildPresetBundle, presetPart, stampedBase, typedExportName,
  type PresetPartId,
} from '../utils/presets';
import { saveFile } from '../utils/fileOps';
import { showToast } from './Toast';

export default function ExportPartButton({ part, className = '' }: {
  part: PresetPartId;
  /** Extra class for the bar this sits in — .dz-footer stretches its buttons,
   *  .ht-tools does not. */
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const def = presetPart(part);
  if (!def) return null;

  /* Nothing to export is a real state — Derek has 81 design values and a long
     hidden-helper list, but a fresh profile has neither, and a button that
     writes an empty file is a button that lies about having done something. */
  const count = def.count();
  const empty = count === 0;

  const run = async () => {
    const now = new Date().toISOString();
    const name = typedExportName(stampedBase(now), part);
    if (await saveFile(buildPresetBundle([part], now), name,
      [{ name: 'ScriptCraft Preset', extensions: ['json'] }])) {
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
      showToast(`${def.label} exported — ${name}`, 'success');
    }
  };

  return (
    <button
      /* dz-export-btn is the STABLE handle. The label swaps to "Saved" for a
         beat after a write, so anything selecting on the text finds nothing
         during that window — which reads as "the button is gone". */
      className={`dz-foot-btn dz-export-btn${className ? ` ${className}` : ''}`}
      data-export-part={part}
      onClick={() => { void run(); }}
      disabled={empty}
      title={empty
        ? `Nothing to export yet — ${def.label.toLowerCase()} is still at the app defaults`
        : `Save ${def.label.toLowerCase()} to a file (${count})`}
    >
      {done ? <><FaCheck /> Saved</> : <><FaDownload /> Export…</>}
    </button>
  );
}
