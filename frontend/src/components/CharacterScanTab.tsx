// v4.24: the Character tool's "From Script" tab, extracted from the 1.7k-line
// CharacterProfiles (split step 1 of the component-split phase). Purely
// presentational — the scan itself, apply, and classify live in the parent;
// the closure variables the JSX used are now explicit props.
import type { CharacterProfile } from '../stores/editorStore';
import type { ScannedCharacter } from '../utils/characterScan';

interface CharacterScanTabProps {
  scanResults: ScannedCharacter[] | null;
  visibleScanResults: ScannedCharacter[];
  characterProfiles: CharacterProfile[];
  existingCharNames: string[];
  onScan: () => void;
  onApply: (r: ScannedCharacter) => void;
  onClassifyReferred: (name: string, value: string) => void;
}

export function CharacterScanTab({
  scanResults, visibleScanResults, characterProfiles, existingCharNames,
  onScan, onApply, onClassifyReferred,
}: CharacterScanTabProps) {
  return (
    <div className="char-setup-tab">
      <div className="char-setup-section">
        <div className="char-setup-title">Scan Script{scanResults ? ` (${visibleScanResults.length})` : ''}</div>
        <p className="char-setup-desc">
          Scan the script for characters and pull descriptions and ages from the action lines that introduce them. Review the list, then add the ones you want.
        </p>
        <button
          className="char-rels-add"
          onClick={onScan}
          title="Scan the script for characters and pull descriptions and ages from the action lines that introduce them"
        >
          {scanResults ? 'Re-scan Script' : 'Scan Script'}
        </button>

        {scanResults && (
          visibleScanResults.length === 0 ? (
            <div className="char-profiles-empty">No characters found in the script.</div>
          ) : (
            <div className="char-scan-list">
              {visibleScanResults.map((r) => {
                const existing = characterProfiles.find((p) => p.name === r.name);
                const canApply = !existing
                  || (!!r.description && !existing.description)
                  || (!!r.age && !existing.age);
                return (
                  <div key={r.name} className="char-scan-row">
                    <div className="char-scan-main">
                      <span className="char-scan-name">{r.name}</span>
                      {r.age && <span className="char-scan-age">{r.age}</span>}
                      {r.source === 'referred' && <span className="char-scan-tag">referred</span>}
                      <span className="char-scan-spacer" />
                      {canApply ? (
                        <button
                          className="char-unmatched-add"
                          onClick={() => onApply(r)}
                          title={existing
                            ? 'Add the detected description and age to this character'
                            : 'Add as a character with the detected description and age'}
                        >
                          + Add
                        </button>
                      ) : (
                        <span className="char-scan-added">Added</span>
                      )}
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
