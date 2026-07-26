/**
 * NewScriptLauncher (v4.80, Derek) — the first window File ▸ New Script shows.
 * Four ways in, one card:
 *
 *   • New Script (Manual Setup)  → the NewScriptDialog we already had
 *   • New Script (Guided Setup)  → the setup wizard
 *   • Open Script                → the Open window
 *   • Import File                → the importer
 *
 * Open and Import USED to sit as small links on the manual window; they live
 * here now, so that window is purely "name this script".
 */
import React from 'react';
import { FaBoxOpen, FaFileImport, FaFolderOpen, FaMagic, FaRegFileAlt } from 'react-icons/fa';

export type LauncherChoice = 'manual' | 'guided' | 'open' | 'import';

const CHOICES: {
  id: LauncherChoice;
  icon: React.ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
}[] = [
  {
    id: 'manual',
    icon: <FaRegFileAlt />,
    title: 'New Script — Manual Setup',
    desc: 'Name it, pick a format and where it saves, and start writing.',
  },
  {
    id: 'guided',
    icon: <FaMagic />,
    title: 'New Script — Guided Setup',
    desc: 'A short walkthrough of the setup choices, one step at a time. Skip any step you like.',
    primary: true,
  },
  {
    id: 'open',
    icon: <FaFolderOpen />,
    title: 'Open Script',
    desc: 'Pick up a script from your library, the cloud, or this computer.',
  },
  {
    id: 'import',
    icon: <FaFileImport />,
    title: 'Import File',
    desc: 'Bring in a Final Draft, Fountain, Word or PDF file.',
  },
];

export default function NewScriptLauncher({ open, onChoose, onClose }: {
  open: boolean;
  onChoose: (choice: LauncherChoice) => void;
  /** Absent = this launcher is the app's landing screen and can't be dismissed. */
  onClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="dialog-overlay fs-overlay-center"
      onMouseDown={(e) => { if (onClose && e.target === e.currentTarget) onClose(); }}
    >
      <div className="welcome-card fs-launcher-card" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-hero">
          <div className="welcome-logo">SC</div>
          <h1 className="welcome-title">Start a Script</h1>
          <p className="welcome-subtitle">Everything here can be changed later.</p>
        </div>

        <div className="fs-launcher-grid">
          {CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fs-launcher-choice${c.primary ? ' fs-launcher-primary' : ''}`}
              onClick={() => onChoose(c.id)}
            >
              <span className="fs-launcher-icon" aria-hidden>{c.icon}</span>
              <span className="fs-launcher-text">
                <span className="fs-launcher-title">{c.title}</span>
                <span className="fs-launcher-desc">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="fs-launcher-foot">
          <span className="fs-launcher-note">
            <FaBoxOpen aria-hidden /> Both setups can copy their look and layout from a preset file.
          </span>
          {onClose && <button onClick={onClose}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}
