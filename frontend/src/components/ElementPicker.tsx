import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ELEMENT_LABELS, type ElementType } from '../stores/editorStore';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';

// Context-aware element ordering: most likely choices first per current type
const ELEMENT_ORDER: Record<string, ElementType[]> = {
  sceneHeading: ['action', 'character', 'general', 'transition', 'shot', 'sceneHeading', 'dialogue', 'parenthetical', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  action:       ['action', 'character', 'dialogue', 'general', 'sceneHeading', 'transition', 'shot', 'parenthetical', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  character:    ['dialogue', 'parenthetical', 'action', 'character', 'general', 'sceneHeading', 'transition', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  dialogue:     ['action', 'character', 'general', 'dialogue', 'parenthetical', 'sceneHeading', 'transition', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  parenthetical:['dialogue', 'action', 'character', 'general', 'parenthetical', 'sceneHeading', 'transition', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  transition:   ['sceneHeading', 'action', 'transition', 'general', 'character', 'dialogue', 'parenthetical', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  general:      ['general', 'action', 'character', 'dialogue', 'sceneHeading', 'transition', 'parenthetical', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  shot:         ['action', 'shot', 'character', 'general', 'sceneHeading', 'transition', 'dialogue', 'parenthetical', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  newAct:       ['sceneHeading', 'action', 'newAct', 'general', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'endOfAct', 'lyrics', 'showEpisode', 'castList'],
  endOfAct:     ['newAct', 'sceneHeading', 'action', 'endOfAct', 'general', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'lyrics', 'showEpisode', 'castList'],
  lyrics:       ['lyrics', 'dialogue', 'action', 'character', 'general', 'sceneHeading', 'parenthetical', 'transition', 'shot', 'newAct', 'endOfAct', 'showEpisode', 'castList'],
  showEpisode:  ['action', 'sceneHeading', 'showEpisode', 'general', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'newAct', 'endOfAct', 'lyrics', 'castList'],
  castList:     ['castList', 'action', 'character', 'general', 'sceneHeading', 'dialogue', 'parenthetical', 'transition', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode'],
};

const DEFAULT_ORDER: ElementType[] = [
  'action', 'character', 'dialogue', 'general', 'sceneHeading', 'parenthetical',
  'transition', 'shot', 'newAct', 'endOfAct', 'lyrics', 'showEpisode', 'castList',
];

interface ElementPickerProps {
  position: { top: number; left: number };
  defaultType: ElementType;
  /** When provided, overrides the template-derived element list (used inside AV cells). */
  availableTypes?: ElementType[];
  onSelect: (type: ElementType) => void;
  onDismiss: () => void;
}

const ElementPicker: React.FC<ElementPickerProps> = ({
  position, defaultType, availableTypes, onSelect, onDismiss,
}) => {
  const activeTemplate = useFormattingTemplateStore((s) => s.getActiveTemplate());
  // v0.81: read the EFFECTIVE rules (template + the user's Customize > Elements
  // overrides), not the raw template — otherwise the Enter-key picker would
  // keep offering elements the user hid, and ignore their ordering. Same source
  // as the Element dropdown, the Insert menu, and the context menu.
  // v0.84: the SAME canonical list as the Element dropdown, the Insert menu and
  // the right-click menu. It previously filtered effective rules itself, without
  // the non-pickable exclusion the other three carried — which is why New Act,
  // End of Act and Cast List still showed up here.
  const effectiveRules = useFormattingTemplateStore((s) => s.getEffectiveRules)();
  const pickable = useFormattingTemplateStore((s) => s.getPickableElements)();
  useFormattingTemplateStore((s) => s.elementHidden);   // re-render on change
  useFormattingTemplateStore((s) => s.elementOrder);

  const orderedTypes = useMemo<ElementType[]>(
    () => {
      // Caller-supplied list (e.g. AV cell context) wins outright.
      if (availableTypes && availableTypes.length > 0) return availableTypes;
      const enabled = pickable.map((r) => r.id as ElementType);

      // v0.88 — the picker's whole order used to come from ELEMENT_ORDER, a
      // context-aware table (after a Character, Dialogue leads; after a
      // Transition, Scene Heading leads). Useful, but it meant this list was
      // ordered differently from every other element list, and it ignored the
      // order the user set in Customize > Elements entirely.
      //
      // Split the difference: the list is now the USER'S order, with just the
      // single likeliest element for the current line lifted to the top — where
      // the caret already is, so Enter-Enter still lands on the obvious choice.
      // Everything below it reads exactly like the other menus.
      const suggestion = (ELEMENT_ORDER[defaultType] || DEFAULT_ORDER)
        .find((t) => enabled.includes(t));
      if (!suggestion) return enabled;
      return [suggestion, ...enabled.filter((t) => t !== suggestion)];
    },
    [defaultType, pickable, availableTypes],
  );

  // Resolve a display label: built-in label first, then template-rule label,
  // finally the raw id. Custom-element ids (avShot, sceneCharacters, etc.) only
  // have labels in the template rules.
  const labelFor = (type: ElementType): string =>
    type === ('dualDialogue' as ElementType) ? 'Dual Dialogue'
      : ELEMENT_LABELS[type] || effectiveRules[type]?.label || activeTemplate.rules[type]?.label || String(type);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Adjust position to stay within viewport
  const [adjustedPos, setAdjustedPos] = useState(position);
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let { top, left } = position;
    if (top + rect.height > window.innerHeight - 8) {
      top = position.top - rect.height - 20;
    }
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setAdjustedPos({ top, left });
  }, [position]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only intercept keys when focus is in the editor (or body), not in other panels
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i => Math.min(i + 1, orderedTypes.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        onSelect(orderedTypes[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
        break;
      default:
        // Any typing key dismisses the picker and passes through to editor
        onDismiss();
        break;
    }
  }, [selectedIndex, orderedTypes, onSelect, onDismiss]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Click outside to dismiss
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onDismiss]);

  return (
    <div
      className="element-picker"
      ref={menuRef}
      style={{ top: adjustedPos.top, left: adjustedPos.left }}
    >
      <div className="element-picker-header">Element Type</div>
      {orderedTypes.map((type, i) => (
        <div
          key={type}
          ref={el => { itemRefs.current[i] = el; }}
          className={`element-picker-item${i === selectedIndex ? ' selected' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(type); }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="element-picker-label">{labelFor(type)}</span>
        </div>
      ))}
    </div>
  );
};

export default ElementPicker;
