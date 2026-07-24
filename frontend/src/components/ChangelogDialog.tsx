// v4.24: Help → Changelog ("What's New"), extracted from MenuBar (component
// split step 5). Stays mounted and gates on `open` so the v1.56 filter state
// (keyword, date range, tag) survives close/reopen exactly as it did when it
// lived in MenuBar; the parent keeps only the open flag.
import React, { useState } from 'react';
import { CHANGELOG, APP_VERSION, ALL_TAGS, TAG_META, tagsFor, type ChangeTag } from '../data/changelog';
import { formatAppDate, parseISODate } from '../utils/dateFormat';
import { useSettingsStore } from '../stores/settingsStore';

export function ChangelogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // v1.56: changelog filters — keyword, tags (any-match), and a date range.
  const [clKeyword, setClKeyword] = useState('');
  const [clTag, setClTag] = useState<'' | ChangeTag>('');
  const dateFormatSetting = useSettingsStore((s) => s.dateFormat);
  const [clFrom, setClFrom] = useState('');
  const [clTo, setClTo] = useState('');

  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box fs-changelog-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          Changelog
          <button className="fs-dialog-x" onClick={onClose} title="Close">&times;</button>
        </div>
        <div className="dialog-body fs-changelog-body">
          <div className="about-section-title">What's New in {APP_VERSION}</div>
          {/* v1.56: filter bar — keyword, date range, and tag toggles. */}
          <div className="fs-changelog-filters">
            <input
              className="fs-changelog-search"
              placeholder="Filter by keyword…"
              value={clKeyword}
              onChange={(e) => setClKeyword(e.target.value)}
            />
            <label className="fs-changelog-datelabel">From
              <input type="date" value={clFrom} onChange={(e) => setClFrom(e.target.value)} />
            </label>
            <label className="fs-changelog-datelabel">To
              <input type="date" value={clTo} onChange={(e) => setClTo(e.target.value)} />
            </label>
            <select
              className="fs-changelog-tagselect"
              value={clTag}
              onChange={(e) => setClTag(e.target.value as '' | ChangeTag)}
              title="Filter by tag"
            >
              <option value="">All tags</option>
              {ALL_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
          <div className="about-changelog">
            {(() => {
              const kw = clKeyword.trim().toLowerCase();
              const shown = CHANGELOG.map((entry) => {
                if (clFrom && (!entry.date || entry.date < clFrom)) return null;
                if (clTo && (!entry.date || entry.date > clTo)) return null;
                const items = entry.items.filter((it) => {
                  if (kw && !(`${it.title} ${it.detail}`.toLowerCase().includes(kw))) return false;
                  if (clTag && !tagsFor(it).includes(clTag)) return false;
                  return true;
                });
                return items.length ? { ...entry, items } : null;
              }).filter((e): e is NonNullable<typeof e> => e !== null);
              if (!shown.length) {
                return <div className="fs-changelog-empty">Nothing matches these filters.</div>;
              }
              return shown.map((entry) => {
                // v1.59: the entry's tags (union across items) ride the
                // version row, right-aligned; the date follows Settings.
                const entryTags = Array.from(new Set(entry.items.flatMap((it) => tagsFor(it))));
                const parsed = entry.date ? parseISODate(entry.date) : null;
                return (
                  <React.Fragment key={entry.version}>
                    <div className="about-subsection-title fs-cl-versionrow">
                      <span>
                        v{entry.version}
                        {parsed && <span className="fs-changelog-date"> — {formatAppDate(parsed, dateFormatSetting)}</span>}
                      </span>
                      <span className="fs-cl-tagcol">
                        {entryTags.map((t) => (
                          <span key={t} className="fs-cl-tag fs-cl-tag-mini" style={{ ['--tag-color' as string]: TAG_META[t].color }}>{t}</span>
                        ))}
                      </span>
                    </div>
                    <ul className="about-list fs-cl-list">
                      {entry.items.map((it, i) => (
                        <li key={i}>
                          <strong>{it.title}</strong>{it.detail ? <> — {it.detail}</> : null}
                        </li>
                      ))}
                    </ul>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
