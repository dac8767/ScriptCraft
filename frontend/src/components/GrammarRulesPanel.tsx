import React, { useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { RETEXT_CATEGORIES, RETEXT_CATEGORY_META } from '../editor/grammar/retextProvider';
import { HARPER_CATEGORIES, HARPER_CATEGORY_META } from '../editor/grammar/harperProvider';
import DictionaryLibrary from './DictionaryLibrary';
import DictionaryConfigPanel from './DictionaryConfigPanel';
import { Modal } from './Modal';

interface GrammarRulesPanelProps {
  onClose: () => void;
}

type RuleSection = {
  blurb: string;
  ids: readonly string[];
  meta: Record<string, { label: string; severity: 'grammar' | 'style'; description: string }>;
};

const GRAMMAR_SECTION: RuleSection = {
  blurb: 'Real grammar mistakes: agreement, tense, articles, capitalization, repeated words.',
  ids: HARPER_CATEGORIES,
  meta: HARPER_CATEGORY_META as Record<string, { label: string; severity: 'grammar' | 'style'; description: string }>,
};

const STYLE_SECTION: RuleSection = {
  blurb: 'Wordiness and tone suggestions (passive voice, weak intensifiers, "in order to").',
  ids: RETEXT_CATEGORIES,
  meta: RETEXT_CATEGORY_META as Record<string, { label: string; severity: 'grammar' | 'style'; description: string }>,
};

type TabId = 'grammar' | 'style' | 'dictionaries';
const TABS: { id: TabId; label: string }[] = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'style', label: 'Style' },
  { id: 'dictionaries', label: 'Dictionaries' },
];

const RuleList: React.FC<{ section: RuleSection }> = ({ section }) => {
  const grammarRulesEnabled = useEditorStore((s) => s.grammarRulesEnabled);
  const setGrammarRuleEnabled = useEditorStore((s) => s.setGrammarRuleEnabled);
  const isOn = (id: string) => grammarRulesEnabled[id] !== false;

  return (
    <>
      {/* v7.04 (style audit item 13): this panel styled every row inline. */}
      <p className="fs-gr-blurb">{section.blurb}</p>
      <div className="fs-gr-rules">
        {section.ids.map((id) => {
          const meta = section.meta[id];
          if (!meta) return null;
          return (
            <label key={id} className="fs-gr-rule">
              <input
                type="checkbox"
                checked={isOn(id)}
                onChange={(e) => setGrammarRuleEnabled(id, e.target.checked)}
              />
              <div className="fs-gr-rule-text">
                <div className="fs-gr-rule-name">{meta.label}</div>
                <div className="fs-gr-rule-desc">{meta.description}</div>
              </div>
              <span className={`fs-gr-sev fs-gr-sev--${meta.severity === 'grammar' ? 'grammar' : 'style'}`}>
                {meta.severity}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
};

const GrammarRulesPanel: React.FC<GrammarRulesPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('grammar');
  const dictionaryLibraryOpen = useEditorStore((s) => s.dictionaryLibraryOpen);
  const setDictionaryLibraryOpen = useEditorStore((s) => s.setDictionaryLibraryOpen);

  return (
    <>
      <Modal onClose={onClose} boxClassName="">
          <div className="dialog-header">Grammar &amp; Spelling Settings</div>
          <div className="fs-gr-tabs">
            {TABS.map((t) => {
              const active = t.id === activeTab;
              return (
                /* v7.04: these are TABS, not buttons — v7.02 gave them
                   `dialog-btn`, which every inline rule here then overrode. */
                <button
                  key={t.id}
                  type="button"
                  className={`fs-gr-tab${active ? ' active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="dialog-body fs-gr-body">
            {activeTab === 'grammar' && <RuleList section={GRAMMAR_SECTION} />}
            {activeTab === 'style' && <RuleList section={STYLE_SECTION} />}
            {activeTab === 'dictionaries' && (
              <DictionaryConfigPanel onOpenLibrary={() => setDictionaryLibraryOpen(true)} />
            )}
          </div>
          <div className="dialog-footer">
            <button className="dialog-btn dialog-btn-primary" onClick={onClose}>Done</button>
          </div>
      </Modal>
      {dictionaryLibraryOpen && (
        <DictionaryLibrary onClose={() => setDictionaryLibraryOpen(false)} />
      )}
    </>
  );
};

export default GrammarRulesPanel;
