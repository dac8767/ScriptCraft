// v4.24: the Character tool's Relationships tab (List/Map), extracted from
// CharacterProfiles (component split step 2). Owns its map-toolbar portal slot
// (used nowhere else); the relationship data actions come in as props. The
// List/Map toggle STATE stays in the parent — the fullscreen header renders its
// own copy of the toggle next to the close X.
import { useState } from 'react';
import type { CharacterRelationship } from '../stores/editorStore';
import { RelationshipMap } from './RelationshipMap';
import { REL_TYPES, REL_DYNAMICS } from './InlineRelForm';

interface CharacterRelationshipsTabProps {
  isFullscreen: boolean;
  relViewMode: 'list' | 'map';
  setRelViewMode: (m: 'list' | 'map') => void;
  currentScriptId: string | null;
  characterRelationships: CharacterRelationship[];
  upsertCharacterRelationship: (rel: CharacterRelationship) => void;
  deleteCharacterRelationship: (id: string) => void;
  existingCharNames: string[];
  /** Map node click → jump to that character's profile (parent switches tabs). */
  onSelectCharacter: (name: string) => void;
}

export function CharacterRelationshipsTab({
  isFullscreen, relViewMode, setRelViewMode, currentScriptId,
  characterRelationships, upsertCharacterRelationship, deleteCharacterRelationship,
  existingCharNames, onSelectCharacter,
}: CharacterRelationshipsTabProps) {
  const [mapHeaderSlot, setMapHeaderSlot] = useState<HTMLElement | null>(null);

  // v4.20: add a blank relationship to edit inline.
  const handleAddRelationship = () => {
    const id = `rel-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    upsertCharacterRelationship({ id, characterA: '', characterB: '', type: REL_TYPES[0], description: '', dynamic: REL_DYNAMICS[0] });
  };

  return (
    <div className="char-rels-tab">
      {/* Non-fullscreen carries the List/Map toggle here (fullscreen puts it
          in the header, next to the close X, like Profiles' Cards/List). */}
      {!isFullscreen && (
        <div className="char-rels-view-toggle">
          <button className={`char-fs-view-btn${relViewMode === 'list' ? ' active' : ''}`} onClick={() => setRelViewMode('list')}>List</button>
          <button className={`char-fs-view-btn${relViewMode === 'map' ? ' active' : ''}`} onClick={() => setRelViewMode('map')}>Map</button>
        </div>
      )}
      {relViewMode === 'map' ? (
        <>
          {/* The map's Fit / + Add Relationship buttons portal into this
              toolbar — the SAME .char-rels-toolbar the list uses, so the
              controls sit in the same place in both views (v4.23). */}
          <div className="char-rels-toolbar" ref={setMapHeaderSlot} />
          <RelationshipMap
            key={currentScriptId || 'no-script'}
            scriptId={currentScriptId || undefined}
            headerSlot={mapHeaderSlot}
            onSelectCharacter={onSelectCharacter}
          />
        </>
      ) : (
      <>
      <div className="char-rels-toolbar">
        <button className="char-rels-add" onClick={handleAddRelationship}>+ Add Relationship</button>
      </div>
      <div className="char-rels-list">
        {characterRelationships.length === 0 ? (
          <div className="char-profiles-empty">No relationships yet. Add one to get started.</div>
        ) : (
          characterRelationships.map((rel) => (
            <div key={rel.id} className="char-rel-item">
              <select className="char-rel-field char-rel-char" value={rel.characterA}
                onChange={(e) => upsertCharacterRelationship({ ...rel, characterA: e.target.value })}>
                <option value="">Character A…</option>
                {existingCharNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="char-rel-field char-rel-type" value={rel.type}
                onChange={(e) => upsertCharacterRelationship({ ...rel, type: e.target.value })}>
                {REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="char-rel-field char-rel-char" value={rel.characterB}
                onChange={(e) => upsertCharacterRelationship({ ...rel, characterB: e.target.value })}>
                <option value="">Character B…</option>
                {existingCharNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="char-rel-field char-rel-dynamic" value={rel.dynamic}
                onChange={(e) => upsertCharacterRelationship({ ...rel, dynamic: e.target.value })}>
                {REL_DYNAMICS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input className="char-rel-field char-rel-desc" value={rel.description}
                placeholder="Description…"
                onChange={(e) => upsertCharacterRelationship({ ...rel, description: e.target.value })} />
              <button className="char-rel-delete" title="Delete relationship"
                onClick={() => deleteCharacterRelationship(rel.id)}>&times;</button>
            </div>
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}
