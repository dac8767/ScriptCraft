// v4.24: ScreenplayEditor static config — collaboration cursor colors, the
// element-type maps, autofill option lists, and the demo doc — lifted out of the
// 4.5k-line component. Pure data (+ one trivial color picker); no React, no state.
// The DEFAULT_NEXT_TYPE / ALL_ELEMENT_TYPES pair is exactly the "two lists that
// drift apart" footgun (CLAUDE.md §3), so screenplayEditorConstants.test.ts locks
// them in sync.
import type { ElementType } from '../stores/editorStore';

// Vibrant dark colors for collaboration cursors and avatars
export const COLLAB_COLORS = [
  '#7C3AED', '#DC2626', '#D97706', '#059669', '#2563EB',
  '#DB2777', '#7C2D12', '#4338CA', '#0E7490', '#9333EA',
];
export function randomCollabColor() {
  return COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
}

// Default next element type when pressing Enter
export const DEFAULT_NEXT_TYPE: Record<string, string> = {
  sceneHeading: 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'dialogue',
  parenthetical: 'dialogue',
  transition: 'sceneHeading',
  general: 'general',
  shot: 'action',
  newAct: 'sceneHeading',
  endOfAct: 'newAct',
  lyrics: 'lyrics',
  showEpisode: 'action',
  castList: 'castList',
};

export const ALL_ELEMENT_TYPES: ElementType[] = [
  'sceneHeading', 'action', 'character', 'dialogue', 'parenthetical',
  'transition', 'general', 'shot', 'newAct', 'endOfAct', 'lyrics',
  'showEpisode', 'castList',
];

// v4.59 — Derek's full follows-what grammar table, stored VERBATIM (v4.61).
// The Enter-key suggestion list is filtered by the element ABOVE the line
// being chosen (working-note lines don't count; they take no space in the
// final document).
//
// There are three dialogue options in every list (v4.61, Derek): plain
// "Dialogue" (the speech), "Dialogue (Name)" (the `character` id — the
// name line; the label lives in ELEMENT_LABELS), and "Dual Dialogue". Picks
// apply their element directly — nothing is silently converted (the v4.54
// implicit Dialogue→character resolver is retired).
//
//   Scene Heading → Action, Dialogue (Name), Dual Dialogue
//   Action        → Action, Dialogue (Name), Dual Dialogue, Scene Heading, Transition
//   Dialogue (Name) → Dialogue, Parenthetical
//   Parenthetical → Dialogue
//   Dialogue      → Dialogue (Name), Action, Scene Heading, Dual Dialogue, Transition
//   Transition    → Scene Heading, Action
//
// A dual-dialogue block ends in dialogue, so it uses the Dialogue row.
// Unlisted contexts (top of script, shot, general, custom elements) fall
// back to everything minus the two hard constraints his rows imply:
// Parenthetical needs a character name above, Transition needs action or
// dialogue above. Deliberate conversion surfaces (toolbar dropdown, Insert
// menu, right-click) stay unfiltered — they fix lines, not suggest them.
export const DEFAULT_SUGGESTION_RULES: Record<string, readonly string[]> = {
  sceneHeading: ['action', 'character', 'dualDialogue'],
  action: ['action', 'character', 'dualDialogue', 'sceneHeading', 'transition'],
  character: ['dialogue', 'parenthetical'],
  parenthetical: ['dialogue'],
  dialogue: ['character', 'action', 'sceneHeading', 'dualDialogue', 'transition'],
  transition: ['sceneHeading', 'action'],
};

/** Every element the rules editor can offer as an allowed-next candidate. */
export const SUGGESTION_RULE_CANDIDATES: readonly string[] = [
  'action', 'dialogue', 'character', 'dualDialogue', 'sceneHeading',
  'transition', 'parenthetical', 'general', 'shot', 'lyrics', 'showEpisode',
];

// v4.59 (same-day follow-up): the table is USER-EDITABLE — Customize ▸ Editor
// ▸ Element Suggestions edits a copy stored in editorStore viewState
// (`suggestionRules`, null = use the default above), and `suggestionMode`
// 'all' switches the filter off entirely. Pass the effective table here; a
// dual-dialogue block above uses the dialogue row (it ends in dialogue).
export function allowedElementsAfter(
  prevType: string | null,
  rules: Record<string, readonly string[]> = DEFAULT_SUGGESTION_RULES,
): (id: string) => boolean {
  const row = prevType
    ? (rules[prevType] ?? (prevType === 'dualDialogue' ? rules['dialogue'] : undefined))
    : undefined;
  if (row) return (id) => row.includes(id);
  return (id) => id !== 'parenthetical' && id !== 'transition';
}

// v3.44, Derek: element autofill option lists (shown as soon as you're in an
// empty element, filtered as you type). Scene prefixes get a trailing space so
// the location follows immediately.
export const SCENE_PREFIX_OPTIONS = ['INT.', 'EXT.'];
// v4.22: the transition list moved into formattingTemplateStore
// (DEFAULT_TRANSITIONS + getEffectiveTransitions) so it's customizable and read
// from one place — see Customize ▸ Script Editor ▸ Transitions.

export const SAMPLE_CONTENT = {
  type: 'doc',
  content: [
    { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. COFFEE SHOP - DAY' }] },
    { type: 'action', content: [{ type: 'text', text: 'A busy coffee shop in downtown Los Angeles. Patrons sit at small tables, laptops open, headphones on. The hiss of the espresso machine punctuates the low murmur of conversation. A BARISTA calls out orders while steam curls from ceramic cups.' }] },
    { type: 'action', content: [{ type: 'text', text: 'SARAH CHEN (30s, sharp eyes, worn leather jacket) sits alone at a corner table, nursing a cold coffee. She stares at her phone, waiting. Her leg bounces under the table — the only outward sign of the tension coiled inside her.' }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: '(under her breath)' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'Come on... pick up.' }] },
    { type: 'action', content: [{ type: 'text', text: 'The door SWINGS open. MARCUS WEBB (40s, rumpled suit, easy smile that hides something harder) enters, shaking rain off his umbrella. He spots Sarah and heads her way, weaving between tables with practiced ease.' }] },
    { type: 'character', content: [{ type: 'text', text: 'MARCUS' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'You know, most people just text when they want to meet.' }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "Most people aren't being followed." }] },
    { type: 'action', content: [{ type: 'text', text: "Marcus's smile fades. He sits down across from her, leaning in close. The ambient noise of the coffee shop seems to recede, leaving them in their own bubble of urgency." }] },
    { type: 'character', content: [{ type: 'text', text: 'MARCUS' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: '(low)' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'Tell me everything. From the beginning.' }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "Three weeks ago I found a file on Reeves' server. Something called NIGHTFALL. It had names, dates, bank accounts — everything. The next day, my access was revoked and someone broke into my apartment." }] },
    { type: 'character', content: [{ type: 'text', text: 'MARCUS' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'Did you make a copy?' }] },
    { type: 'action', content: [{ type: 'text', text: 'Sarah reaches into her jacket and slides a USB drive across the table. Marcus stares at it like it might explode.' }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "That's the only copy. Guard it with your life. I mean that literally." }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
    { type: 'sceneHeading', content: [{ type: 'text', text: 'EXT. CITY STREET - NIGHT' }] },
    { type: 'action', content: [{ type: 'text', text: 'Rain slicks the pavement, reflecting neon signs in shattered patterns. Sarah walks quickly, collar up, glancing over her shoulder every few steps. The city feels hostile — every shadow a threat, every passing car a potential tail.' }] },
    { type: 'action', content: [{ type: 'text', text: 'She turns down an alley. Stops. Listens. Nothing but the patter of rain on dumpsters and the distant wail of a siren. She exhales, allows herself a moment of relief.' }] },
    { type: 'action', content: [{ type: 'text', text: 'Then: FOOTSTEPS. Behind her. Measured. Deliberate.' }] },
    { type: 'action', content: [{ type: 'text', text: "Sarah doesn't run. She turns slowly, hands loose at her sides, ready." }] },
    { type: 'action', content: [{ type: 'text', text: 'A FIGURE emerges from the shadows. Tall, broad-shouldered, face hidden under a dark hood. He stops ten feet away.' }] },
    { type: 'character', content: [{ type: 'text', text: 'HOODED FIGURE' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "You should have left it alone, Sarah." }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "I tried. Your boss wouldn't let me." }] },
    { type: 'action', content: [{ type: 'text', text: 'The figure takes a step forward. Sarah holds her ground. Rain streams down her face, but her eyes are steady, defiant.' }] },
    { type: 'character', content: [{ type: 'text', text: 'HOODED FIGURE' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "Give me the drive and you walk away. That's the deal. Only deal you're going to get." }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: '(smiling)' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "I don't have it anymore." }] },
    { type: 'action', content: [{ type: 'text', text: "The figure's posture shifts. Anger, barely contained." }] },
    { type: 'character', content: [{ type: 'text', text: 'HOODED FIGURE' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "Then we have a problem." }] },
    { type: 'transition', content: [{ type: 'text', text: 'SMASH CUT TO:' }] },
    { type: 'sceneHeading', content: [{ type: 'text', text: "INT. MARCUS' APARTMENT - NIGHT" }] },
    { type: 'action', content: [{ type: 'text', text: "A small, cluttered studio. Stacks of newspapers, half-eaten takeout containers, a wall covered in pinned photos and red string. Marcus sits at his desk, the USB drive plugged into his laptop." }] },
    { type: 'action', content: [{ type: 'text', text: 'His eyes widen as he scrolls through the files. Page after page of financial records, offshore accounts, wire transfers. Names he recognizes — senators, CEOs, a Supreme Court justice.' }] },
    { type: 'character', content: [{ type: 'text', text: 'MARCUS' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: '(whispered)' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'Holy shit.' }] },
    { type: 'action', content: [{ type: 'text', text: 'His phone BUZZES. A text from an unknown number: "CHECK YOUR DOOR."' }] },
    { type: 'action', content: [{ type: 'text', text: 'Marcus freezes. Slowly turns toward his front door. Through the peephole: nothing but the empty hallway. But on his doormat — a manila envelope.' }] },
    { type: 'action', content: [{ type: 'text', text: 'He opens it with trembling hands. Inside: a single photograph of Sarah, taken from above, a red X drawn across her face.' }] },
    { type: 'action', content: [{ type: 'text', text: 'Marcus grabs his phone, dials Sarah. It rings. And rings. And rings.' }] },
    { type: 'character', content: [{ type: 'text', text: 'MARCUS' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: '(into phone, desperate)' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'Pick up, Sarah. Pick up...' }] },
    { type: 'action', content: [{ type: 'text', text: 'No answer. Marcus stares at the photograph, then at the laptop screen full of secrets. He makes a decision.' }] },
    { type: 'action', content: [{ type: 'text', text: 'He copies the files to a second drive, tapes it under his desk drawer, grabs his coat and the original drive, and heads for the door.' }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
    { type: 'sceneHeading', content: [{ type: 'text', text: 'EXT. CITY STREET - CONTINUOUS' }] },
    { type: 'action', content: [{ type: 'text', text: 'Marcus bursts out of his building into the rain. He looks left, right — the street is deserted. He starts walking fast, then running.' }] },
    { type: 'action', content: [{ type: 'text', text: 'Behind him, a black sedan pulls away from the curb. Its headlights stay off.' }] },
  ],
};
