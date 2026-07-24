// v4.24: the Character tool's "From Script" tab, extracted from the 1.7k-line
// CharacterProfiles (split step 1 of the component-split phase). Purely
// presentational — the scan itself, apply, and classify live in the parent;
// the closure variables the JSX used are now explicit props.
import type { ScannedCharacter } from '../utils/characterScan';

interface CharacterScanTabProps {
  scanResults: ScannedCharacter[] | null;
  visibleScanResults: ScannedCharacter[];
  existingCharNames: string[];
  onScan: () => void;
  onApply: (r: ScannedCharacter) => void;
  onClassifyReferred: (name: string, value: string) => void;
}

export function CharacterScanTab({
  scanResults, visibleScanResults, existingCharNames,
  onScan, onApply, onClassifyReferred,
}: CharacterScanTabProps) {
  return (
    <div className="char-setup-tab">
      <div className="char-setup-section">
        <div className="char-setup-title">Scan Script{scanResults ? ` (${visibleScanResults.length})` : ''}</div>
        <p className="char-setup-desc">
          The script is scanned automatically when you open this tab — names that already have a character entry drop off the list. Add the ones you want; classify the rest to file them away.
        </p>
        <button
          className="char-rels-add"
          onClick={onScan}
          title="Scan again now (the tab also re-scans every time you open it)"
        >
          Re-scan Script
        </button>

        {scanResults && (
          visibleScanResults.length === 0 ? (
            <div className="char-profiles-empty">No characters found in the script.</div>
          ) : (
            <div className="char-scan-list">
              {visibleScanResults.map((r) => {
                return (
                  <div key={r.name} className="char-scan-row">
                    <div className="char-scan-main">
                      <span className="char-scan-name">{r.name}</span>
                      {r.age && <span className="char-scan-age">{r.age}</span>}
                      {r.source === 'referred' && <span className="char-scan-tag">referred</span>}
                      <span className="char-scan-spacer" />
                      <button
                        className="char-unmatched-add"
                        onClick={() => onApply(r)}
                        title="Add as a character with the detected description and age"
                      >
                        + Add
                      </button>
                      {/* v4.19: classify a referred name — location / other /
                          connect to a character — to file it away. */}
                      {r.source === 'referred' && (
                        <select
                          className="char-unmatched-classify"
                          value=""
                          title="File this away so it leaves the list"
                          onChange={(e) => { onClassifyReferred(r.name, e.target.value); e.target.value = ''; }}
                        >
                          <option value="">Classify…</option>
                          <option value="__location">It&rsquo;s a location</option>
                          <option value="__other">Other — hide it</option>
                          {existingCharNames.length > 0 && (
                            <optgroup label="Connect to character">
                              {existingCharNames.map((c) => (
                                <option key={c} value={`__char:${c}`}>{c}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      )}
                    </div>
                    {r.description && <div className="char-scan-desc">{r.description}</div>}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
