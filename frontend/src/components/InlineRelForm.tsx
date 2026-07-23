import React, { useState } from 'react';
import type { CharacterRelationship } from '../stores/editorStore';

export const REL_TYPES = ['allies', 'rivals', 'family', 'romantic', 'mentor', 'antagonist', 'employer', 'friends'];
export const REL_DYNAMICS = ['Stable', 'Evolving', 'Tense', 'One-sided', 'Supportive', 'Adversarial', 'Complex'];

/** Compact inline form for adding a relationship from within a character profile */
export const InlineRelForm: React.FC<{
  characterName: string;
  allCharacters: string[];
  onSave: (rel: CharacterRelationship) => void;
  onCancel: () => void;
}> = ({ characterName, allCharacters, onSave, onCancel }) => {
  const [otherChar, setOtherChar] = useState('');
  const [relType, setRelType] = useState('allies');
  const [dynamic, setDynamic] = useState('Stable');
  const [desc, setDesc] = useState('');

  const others = allCharacters.filter((c) => c !== characterName);

  return (
    <div className="char-profile-rel-form">
      <div className="char-profile-rel-form-row">
        <select value={otherChar} onChange={(e) => setOtherChar(e.target.value)}>
          <option value="">Select character...</option>
          {others.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={relType} onChange={(e) => setRelType(e.target.value)}>
          {REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={dynamic} onChange={(e) => setDynamic(e.target.value)}>
          {REL_DYNAMICS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Describe the relationship..."
        rows={2}
        className="char-profile-rel-form-desc"
      />
      <div className="char-profile-rel-form-actions">
        <button className="char-profile-rel-form-btn" onClick={onCancel}>Cancel</button>
        <button
          className="char-profile-rel-form-btn char-profile-rel-form-btn-primary"
          disabled={!otherChar}
          onClick={() => onSave({
            id: crypto.randomUUID(),
            characterA: characterName,
            characterB: otherChar,
            type: relType,
            description: desc,
            dynamic,
          })}
        >
          Add
        </button>
      </div>
    </div>
  );
};
