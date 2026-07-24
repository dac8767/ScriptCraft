// v4.24: Help → About, extracted from MenuBar (component split step 4). Pure
// presentation over APP_VERSION + the compat table; What's New hands off to the
// parent, which owns the changelog dialog.
import React from 'react';
import { openInBrowser, DONATE_URL } from '../services/external';
import { APP_VERSION } from '../data/changelog';
import { getCompatEntries } from '../services/compat';

export function AboutDialog({ onClose, onShowChangelog }: { onClose: () => void; onShowChangelog: () => void }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">About ScriptCraft</div>
        <div className="dialog-body about-body">
          <img className="about-logo" src="/splash-logo.png" alt="ScriptCraft" />
          <div className="about-title">ScriptCraft</div>
          <div className="about-version">
            Version {APP_VERSION}
            {/* v3.24 reorg #7: the changelog's home is here now */}
            <button className="about-whatsnew" onClick={onShowChangelog}>
              What's New
            </button>
          </div>
          <div className="about-tagline">Free, open-source screenwriting software</div>
          <div className="about-credit">
            Built from the{' '}
            <a href="https://github.com/Proteus-Technologies-Private-Limited/OpenDraft" target="_blank" rel="noopener noreferrer">
              OpenDraft
            </a>{' '}
            source code by Proteus Technologies.
          </div>
          <div className="about-credit about-oss">
            Made possible by open source:{' '}
            <a href="https://react.dev" target="_blank" rel="noopener noreferrer">React</a>,{' '}
            <a href="https://tiptap.dev" target="_blank" rel="noopener noreferrer">TipTap</a> /{' '}
            <a href="https://prosemirror.net" target="_blank" rel="noopener noreferrer">ProseMirror</a>,{' '}
            <a href="https://yjs.dev" target="_blank" rel="noopener noreferrer">Yjs</a> &{' '}
            <a href="https://tiptap.dev/hocuspocus" target="_blank" rel="noopener noreferrer">Hocuspocus</a>,{' '}
            <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">Vite</a>,{' '}
            <a href="https://www.typescriptlang.org" target="_blank" rel="noopener noreferrer">TypeScript</a>,{' '}
            <a href="https://zustand.docs.pmnd.rs" target="_blank" rel="noopener noreferrer">Zustand</a>,{' '}
            <a href="https://reactrouter.com" target="_blank" rel="noopener noreferrer">React Router</a>,{' '}
            <a href="https://recharts.org" target="_blank" rel="noopener noreferrer">Recharts</a>,{' '}
            <a href="https://dndkit.com" target="_blank" rel="noopener noreferrer">dnd kit</a>,{' '}
            <a href="https://react-icons.github.io/react-icons/" target="_blank" rel="noopener noreferrer">React Icons</a>,{' '}
            <a href="https://github.com/parallax/jsPDF" target="_blank" rel="noopener noreferrer">jsPDF</a>,{' '}
            <a href="https://github.com/dolanmiu/docx" target="_blank" rel="noopener noreferrer">docx</a>,{' '}
            <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener noreferrer">JSZip</a>,{' '}
            <a href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener noreferrer">DOMPurify</a>,{' '}
            <a href="https://writewithharper.com" target="_blank" rel="noopener noreferrer">Harper</a>,{' '}
            <a href="https://github.com/cfinke/Typo.js" target="_blank" rel="noopener noreferrer">Typo.js</a>,{' '}
            <a href="https://github.com/retextjs/retext" target="_blank" rel="noopener noreferrer">retext</a> /{' '}
            <a href="https://unifiedjs.com" target="_blank" rel="noopener noreferrer">unified</a>,{' '}
            <a href="https://tauri.app" target="_blank" rel="noopener noreferrer">Tauri</a>,{' '}
            <a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener noreferrer">FastAPI</a>,{' '}
            <a href="https://www.dulwich.io" target="_blank" rel="noopener noreferrer">Dulwich</a>, and{' '}
            <a href="https://alembic.sqlalchemy.org" target="_blank" rel="noopener noreferrer">Alembic</a>.
          </div>


          <div className="about-whats-new">
            <div className="about-section-title">Compatibility</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fd-text-secondary)' }}>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Subsystem</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Implementation</th>
                </tr>
              </thead>
              <tbody>
                {getCompatEntries().map((entry) => (
                  <React.Fragment key={entry.label}>
                    <tr>
                      <td style={{ padding: '4px 8px', color: 'var(--fd-text)' }}>{entry.label}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: entry.mode === 'primary' ? '#4caf50' : '#ff9800',
                          marginRight: 6,
                          verticalAlign: 'middle',
                        }} />
                        <span style={{ color: entry.mode === 'primary' ? '#4caf50' : '#ff9800', verticalAlign: 'middle' }}>
                          {entry.mode === 'primary' ? 'Latest' : 'Fallback'}
                        </span>
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--fd-text-secondary)', fontSize: 11 }}>
                        {entry.using}
                      </td>
                    </tr>
                    {entry.errorReason && (
                      <tr>
                        <td colSpan={3} style={{ padding: '0 8px 8px 8px' }}>
                          <pre style={{
                            margin: 0,
                            padding: '6px 8px',
                            fontSize: 11,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            background: '#f4f4f4',
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            color: '#1a1a1a',
                          }}>{entry.errorReason}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* v3.18, Derek: donate rides the footer row — left, opposite
            Close. Yellow BMC config (#FFDD00 pill, white cup). */}
        <div className="dialog-actions about-actions">
          <button
            className="fs-bmc-btn"
            title="Buy me a coffee"
            onClick={() => openInBrowser(DONATE_URL)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4.5 h10 l-0.4 2 h-9.2 Z" fill="#000" />
              <path d="M3.9 7 h8.2 l-1 6.2 a1 1 0 0 1 -1 0.8 h-4.2 a1 1 0 0 1 -1 -0.8 Z" fill="#fff" stroke="#000" strokeWidth="0.8" />
              <path d="M4.6 3 c0 -0.8 6.8 -0.8 6.8 0 l0.2 1.5 h-7.2 Z" fill="#fff" stroke="#000" strokeWidth="0.8" />
            </svg>
            <span>Buy me a coffee</span>
          </button>
          <button className="dialog-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
