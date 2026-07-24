/**
 * pdfClassify — pins the classifyParagraph decision table exhaustively.
 * pdfImporter.test.ts covers the happy paths; this file pins every branch,
 * the exact numeric boundaries of each indent band (< 40, > 40, [130, 260],
 * >= 60, [45, 130)), the rule ORDER (scene > transition > character >
 * parenthetical > dialogue > action), and the fall-through default — so a
 * threshold tweak can't silently reshuffle imported scripts.
 *
 * Rules under test (indent is pt right of the dominant action margin):
 *   1. sceneHeading  — INT/EXT/EST/I-E prefix AND indent < 40
 *   2. transition    — ALL CAPS, ends TO: / FADE OUT / FADE IN: /
 *                      CUT TO BLACK, AND indent > 40
 *   3. character     — indent in [130, 260], ALL CAPS, length < 45
 *   4. parenthetical — starts "(", indent >= 60, prev character|dialogue
 *   5. dialogue      — indent in [45, 130), prev character|parenthetical|dialogue
 *   6. action        — everything else
 */
import { describe, it, expect } from 'vitest';
import { classifyParagraph } from './pdfClassify';

describe('classifyParagraph — scene headings', () => {
  it('recognizes every prefix form near the left margin', () => {
    expect(classifyParagraph(0, 'INT. FARMHOUSE - NIGHT', null)).toBe('sceneHeading');
    expect(classifyParagraph(0, 'EXT. STREET - DAY', null)).toBe('sceneHeading');
    expect(classifyParagraph(0, 'EST. PARIS - DAY', null)).toBe('sceneHeading');
    expect(classifyParagraph(0, 'INT./EXT. CAR - MOVING', null)).toBe('sceneHeading');
    expect(classifyParagraph(0, 'I/E. CAR - MOVING', null)).toBe('sceneHeading');
  });

  it('matches case-insensitively — a lowercase heading still counts', () => {
    expect(classifyParagraph(0, 'int. house - day', null)).toBe('sceneHeading');
  });

  it('boundary: indent must be < 40 — at exactly 40 a heading degrades to action', () => {
    expect(classifyParagraph(39, 'INT. HOUSE - DAY', null)).toBe('sceneHeading');
    expect(classifyParagraph(40, 'INT. HOUSE - DAY', null)).toBe('action');
  });

  it('KNOWN LIMITATION: a heading drifted into the character band becomes a character cue', () => {
    // Rule 1 requires indent < 40, so a caps heading at 158pt (< 45 chars)
    // falls through to rule 3 and imports as a character name.
    expect(classifyParagraph(158, 'INT. HOUSE - DAY', null)).toBe('character');
  });
});

describe('classifyParagraph — transitions', () => {
  it('recognizes each right-side transition ending', () => {
    expect(classifyParagraph(400, 'CUT TO:', null)).toBe('transition');
    expect(classifyParagraph(400, 'SMASH CUT TO:', 'action')).toBe('transition');
    expect(classifyParagraph(400, 'FADE OUT.', null)).toBe('transition');
    expect(classifyParagraph(400, 'FADE OUT', null)).toBe('transition'); // dot optional
    expect(classifyParagraph(400, 'CUT TO BLACK.', null)).toBe('transition');
  });

  it('boundary: indent must be > 40 — at exactly 40 it falls to action', () => {
    expect(classifyParagraph(41, 'FADE OUT.', null)).toBe('transition');
    expect(classifyParagraph(40, 'FADE OUT.', null)).toBe('action');
  });

  it('trailing whitespace is trimmed before the ending check', () => {
    expect(classifyParagraph(400, 'CUT TO:   ', null)).toBe('transition');
  });

  it('mixed case is not a transition — the caps guard is case-sensitive', () => {
    expect(classifyParagraph(400, 'Cut to:', null)).toBe('action');
  });

  it('precedence: a transition inside the character band is still a transition', () => {
    // Rule 2 runs before rule 3, so caps "CUT TO:" at 158pt never
    // misreads as a character cue.
    expect(classifyParagraph(158, 'CUT TO:', null)).toBe('transition');
  });

  it('KNOWN LIMITATION: FADE IN: at the left margin imports as action', () => {
    // FADE IN: conventionally sits at the LEFT margin, but rule 2 requires
    // indent > 40 — so the standard opening transition is never recognized.
    expect(classifyParagraph(0, 'FADE IN:', null)).toBe('action');
  });
});

describe('classifyParagraph — character cues', () => {
  it('caps + short + indent in [130, 260] is a character, inclusive at both ends', () => {
    expect(classifyParagraph(158, 'SARAH', null)).toBe('character');
    expect(classifyParagraph(130, 'SARAH', null)).toBe('character');
    expect(classifyParagraph(260, 'SARAH', null)).toBe('character');
    expect(classifyParagraph(261, 'SARAH', null)).toBe('action');
  });

  it('just left of the band, a caps line follows the dialogue rule instead', () => {
    expect(classifyParagraph(129, 'SARAH', null)).toBe('action'); // no prev → default
    expect(classifyParagraph(129, 'SARAH', 'dialogue')).toBe('dialogue'); // band handoff
  });

  it('boundary: length must be < 45 characters', () => {
    expect(classifyParagraph(158, 'A'.repeat(44), null)).toBe('character');
    expect(classifyParagraph(158, 'A'.repeat(45), null)).toBe('action');
  });

  it('requires ALL CAPS with at least one letter', () => {
    expect(classifyParagraph(158, 'Sarah', null)).toBe('action'); // mixed case
    expect(classifyParagraph(158, '1985', null)).toBe('action'); // no A-Z at all
  });
});

describe('classifyParagraph — parentheticals', () => {
  it('a "(" line at >= 60pt after a character or dialogue is a parenthetical', () => {
    expect(classifyParagraph(108, '(beat)', 'character')).toBe('parenthetical');
    expect(classifyParagraph(108, '(beat)', 'dialogue')).toBe('parenthetical');
  });

  it('has no upper indent bound — a far-right lowercase "(" line still qualifies', () => {
    // Rule 3 needs caps, so lowercase "(beat)" passes through to rule 4
    // even inside the character band.
    expect(classifyParagraph(300, '(beat)', 'character')).toBe('parenthetical');
  });

  it('needs the right predecessor — after action or nothing it stays action', () => {
    expect(classifyParagraph(108, '(beat)', 'action')).toBe('action');
    expect(classifyParagraph(108, '(beat)', null)).toBe('action');
  });

  it('boundary + KNOWN LIMITATION: at 59pt it is dialogue, not parenthetical', () => {
    // Rule 4 requires indent >= 60; one point left, rule 5 claims the line.
    expect(classifyParagraph(60, '(beat)', 'character')).toBe('parenthetical');
    expect(classifyParagraph(59, '(beat)', 'character')).toBe('dialogue');
  });

  it('KNOWN LIMITATION: back-to-back parentheticals — the second becomes dialogue', () => {
    // Rule 4 accepts prev character|dialogue only, never 'parenthetical',
    // so a second consecutive "(...)" at the standard 108pt indent falls
    // through to rule 5.
    expect(classifyParagraph(108, '(beat)', 'parenthetical')).toBe('dialogue');
  });

  it('KNOWN LIMITATION: a caps parenthetical in the character band becomes a character', () => {
    // "(V.O.)" is all caps with letters, < 45 chars — rule 3 fires before
    // rule 4 ever sees the leading "(".
    expect(classifyParagraph(158, '(V.O.)', 'character')).toBe('character');
  });
});

describe('classifyParagraph — dialogue', () => {
  it('indent in [45, 130) after character / parenthetical / dialogue', () => {
    expect(classifyParagraph(72, 'Hello there.', 'character')).toBe('dialogue');
    expect(classifyParagraph(72, 'Hello there.', 'parenthetical')).toBe('dialogue');
    expect(classifyParagraph(72, 'Hello there.', 'dialogue')).toBe('dialogue');
  });

  it('needs the right predecessor — after action or nothing it stays action', () => {
    expect(classifyParagraph(72, 'Hello there.', 'action')).toBe('action');
    expect(classifyParagraph(72, 'Hello there.', null)).toBe('action');
  });

  it('boundaries: 45 is in, 44 is out; 129 is in, 130 is out', () => {
    expect(classifyParagraph(45, 'Hi.', 'character')).toBe('dialogue');
    expect(classifyParagraph(44, 'Hi.', 'character')).toBe('action');
    expect(classifyParagraph(129, 'Hi.', 'character')).toBe('dialogue');
    // KNOWN LIMITATION: the dialogue band is half-open at 130 while the
    // character band starts at 130 — non-caps text at exactly 130pt after
    // a cue is claimed by neither and falls to action.
    expect(classifyParagraph(130, 'hi.', 'character')).toBe('action');
  });

  it('shouted ALL-CAPS dialogue at dialogue indent is still dialogue', () => {
    // Caps alone triggers nothing here: not a transition ending, and 72pt
    // is left of the character band.
    expect(classifyParagraph(72, 'I SAID NO!', 'character')).toBe('dialogue');
  });
});

describe('classifyParagraph — the action fall-through', () => {
  it('ordinary prose at the margin is action', () => {
    expect(classifyParagraph(0, 'He walks in.', null)).toBe('action');
    expect(classifyParagraph(0, 'He walks in.', 'dialogue')).toBe('action');
  });

  it('an empty paragraph at the margin is action', () => {
    expect(classifyParagraph(0, '', null)).toBe('action');
  });

  it('KNOWN LIMITATION: an empty paragraph inside the dialogue band inherits dialogue', () => {
    // Rule 5 has no text requirement — "" at 72pt after dialogue matches it.
    expect(classifyParagraph(72, '', 'dialogue')).toBe('dialogue');
  });
});
