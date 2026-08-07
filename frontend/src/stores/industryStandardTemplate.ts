/**
 * Industry Standard formatting template — codifies the hardcoded CSS rules
 * and Enter/Tab transitions from the original script editor.
 *
 * This is a readonly constant, never stored in the database.
 */

import type { FormattingTemplate, FormattingElementRule } from './formattingTypes';
import { INDUSTRY_STANDARD_ID } from './formattingTypes';

function rule(
  id: string,
  label: string,
  overrides: Partial<FormattingElementRule>,
): FormattingElementRule {
  return {
    id,
    label,
    isBuiltIn: true,
    enabled: true,
    fontFamily: null,
    fontSize: null,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    textTransform: 'none',
    textColor: null,
    backgroundColor: null,
    textAlign: 'left',
    marginTop: 0,
    leftIndent: 1.50,
    // v6.33: full-width columns run to the 7.8" content edge — 63 chars of
    // true 10-cpi Courier, measured from Derek's reference page. Must match
    // utils/screenplayMetrics FD_INDENTS.
    rightIndent: 7.80,
    nextOnEnter: id,
    nextOnTab: null,
    placeholder: '',
    allowFormatOverride: true,
    ...overrides,
  };
}

export const INDUSTRY_STANDARD_TEMPLATE: FormattingTemplate = {
  id: INDUSTRY_STANDARD_ID,
  name: 'Film Script',
  description: 'Industry-standard feature-film script formatting (Final Draft compatible).',
  mode: 'enforce',
  category: 'system',
  createdAt: '',
  updatedAt: '',
  rules: {
    sceneHeading: rule('sceneHeading', 'Scene Heading', {
      bold: true,
      textTransform: 'uppercase',
      marginTop: 24,   // v6.30: the spec-standard TWO blank lines
      nextOnEnter: 'action',
      nextOnTab: 'action',
      placeholder: 'INT./EXT. LOCATION - TIME',
    }),
    action: rule('action', 'Action', {
      marginTop: 12,
      nextOnEnter: 'action',
      nextOnTab: 'character',
      placeholder: 'Action...',
    }),
    character: rule('character', 'Character', {
      textTransform: 'uppercase',
      marginTop: 12,
      leftIndent: 3.50,
      nextOnEnter: 'dialogue',
      nextOnTab: 'parenthetical',
      placeholder: 'CHARACTER NAME',
    }),
    dialogue: rule('dialogue', 'Dialogue', {
      leftIndent: 2.50,
      rightIndent: 6.00,
      nextOnEnter: 'dialogue',
      nextOnTab: 'parenthetical',
      placeholder: 'Dialogue...',
    }),
    parenthetical: rule('parenthetical', 'Parenthetical', {
      leftIndent: 3.00,
      rightIndent: 5.50,
      nextOnEnter: 'dialogue',
      nextOnTab: 'dialogue',
      placeholder: '(direction)',
    }),
    transition: rule('transition', 'Transition', {
      textTransform: 'uppercase',
      textAlign: 'right',
      marginTop: 12,
      leftIndent: 5.50,
      nextOnEnter: 'sceneHeading',
      placeholder: 'TRANSITION:',
    }),
    general: rule('general', 'General', {
      nextOnEnter: 'general',
      placeholder: 'Text...',
    }),
    shot: rule('shot', 'Shot', {
      textTransform: 'uppercase',
      marginTop: 12,
      nextOnEnter: 'action',
      placeholder: 'SHOT DESCRIPTION',
    }),
    newAct: rule('newAct', 'New Act', {
      bold: true,
      underline: true,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginTop: 24,
      nextOnEnter: 'sceneHeading',
      placeholder: 'ACT ONE',
    }),
    endOfAct: rule('endOfAct', 'End of Act', {
      bold: true,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginTop: 24,
      nextOnEnter: 'newAct',
      placeholder: 'END OF ACT',
    }),
    lyrics: rule('lyrics', 'Lyrics', {
      italic: true,
      leftIndent: 2.50,
      rightIndent: 6.00,
      nextOnEnter: 'lyrics',
      placeholder: 'Lyrics...',
    }),
    showEpisode: rule('showEpisode', 'Show/Episode', {
      bold: true,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginTop: 12,
      nextOnEnter: 'action',
      placeholder: 'SHOW TITLE',
    }),
    castList: rule('castList', 'Cast List', {
      textTransform: 'uppercase',
      leftIndent: 1.75,
      nextOnEnter: 'castList',
      placeholder: 'Cast...',
    }),
  },
};
