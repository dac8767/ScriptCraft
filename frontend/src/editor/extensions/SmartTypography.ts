/**
 * SmartTypography (v1.61) — curly quotes and em dashes as you type.
 *
 * Settings > General > Editing toggles it LIVE: every rule checks the setting
 * inside its handler, and tiptap treats a handler that leaves the transaction
 * untouched as "not handled" (core: `if (handler === null || !tr.steps.length)
 * return`), so the raw character types normally when the setting is off. No
 * editor rebuild needed.
 *
 * Rules are tiptap's own typography patterns, scoped to what Derek asked for:
 * double quotes, single quotes/apostrophes, and `--` → em dash. Deliberately
 * NOT ellipsis: trailing dots are a screenwriting idiom best left alone.
 */
import { Extension, InputRule } from '@tiptap/core';
import { useSettingsStore } from '../../stores/settingsStore';

const enabled = () => useSettingsStore.getState().smartTypography;

/** textInputRule's exact insert logic, behind the settings gate. */
function gatedTextRule(find: RegExp, replace: string): InputRule {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      if (!enabled()) return;   // no tr steps -> tiptap lets the raw char through
      let insert = replace;
      let start = range.from;
      const end = range.to;
      if (match[1]) {
        const offset = match[0].lastIndexOf(match[1]);
        insert += match[0].slice(offset + match[1].length);
        start += offset;
        const cutOff = start - end;
        if (cutOff > 0) {
          insert = match[0].slice(offset - cutOff, offset) + insert;
          start = end;
        }
      }
      state.tr.insertText(insert, start, end);
    },
  });
}

export const SmartTypography = Extension.create({
  name: 'smartTypography',

  addInputRules() {
    return [
      gatedTextRule(/(?:^|[\s{[(<'"‘“])(")$/, '“'),   // opening “
      gatedTextRule(/"$/, '”'),                                  // closing ”
      gatedTextRule(/(?:^|[\s{[(<'"‘“])(')$/, '‘'),   // opening ‘
      gatedTextRule(/'$/, '’'),                                  // closing ’ / apostrophe
      gatedTextRule(/--$/, '—'),                                 // em dash —
    ];
  },
});

export default SmartTypography;
