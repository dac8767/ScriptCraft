/**
 * Customize ▸ Editor ▸ Element Suggestions (v4.59, Derek).
 *
 * Mode toggle: Script-Aware (the follows-what grammar filters the Enter-key
 * suggestion list) vs All Elements (no filtering). Below it, the rules
 * themselves: one row per previous element, a chip per allowed next element.
 * Derek's table is the default; edits are stored whole in editorStore
 * (`suggestionRules`), Reset returns to the default. "Dialogue" here is the
 * couplet cue — on an empty line it starts at the character name — so there
 * is no separate Character column, and a dual-dialogue block above uses the
 * Dialogue row.
 */
import React from 'react';
import { ELEMENT_LABELS, useEditorStore } from '../stores/editorStore';
import { DEFAULT_SUGGESTION_RULES, SUGGESTION_RULE_CANDIDATES } from './screenplayEditorConstants';

const label = (id: string): string =>
  id === 'dualDialogue' ? 'Dual Dialogue' : (ELEMENT_LABELS[id] ?? id);

const ROWS = Object.keys(DEFAULT_SUGGESTION_RULES);

const SuggestionRulesEditor: React.FC = () => {
  const mode = useEditorStore((s) => s.suggestionMode);
  const setMode = useEditorStore((s) => s.setSuggestionMode);
  const rules = useEditorStore((s) => s.suggestionRules);
  const setRules = useEditorStore((s) => s.setSuggestionRules);
  const effective = rules ?? DEFAULT_SUGGESTION_RULES;

  const toggle = (row: string, id: string) => {
    const next: Record<string, string[]> = Object.fromEntries(
      ROWS.map((r) => [r, [...(effective[r] ?? [])]]),
    );
    const list = next[row];
    const at = list.indexOf(id);
    if (at >= 0) list.splice(at, 1);
    else list.push(id);
    setRules(next);
  };

  return (
    <div className="fs-sugg-editor">
      <div className="fs-sugg-mode">
        <span className="fs-customize-seg">
          <button
            className={mode !== 'all' ? 'active' : ''}
            onClick={() => setMode('smart')}
          >Script-Aware</button>
          <button
            className={mode === 'all' ? 'active' : ''}
            onClick={() => setMode('all')}
          >All Elements</button>
        </span>
        {rules && (
          <button className="fs-sugg-reset" onClick={() => setRules(null)}>
            Reset to Default
          </button>
        )}
      </div>
      {mode !== 'all' && (
        <div className="fs-sugg-rules">
          {ROWS.map((row) => (
            <div className="fs-sugg-row" key={row}>
              <span className="fs-sugg-prev">{label(row)}</span>
              <span className="fs-sugg-chips">
                {SUGGESTION_RULE_CANDIDATES.map((id) => (
                  <button
                    key={id}
                    className={`fs-sugg-chip${(effective[row] ?? []).includes(id) ? ' active' : ''}`}
                    onClick={() => toggle(row, id)}
                  >{label(id)}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestionRulesEditor;
