// @vitest-environment jsdom
/**
 * v7.11, Derek: "double check the formatting standards for the tv drama, radio
 * drama, Multicam, stage play, and av script templates. they seem too close to
 * the film script template."
 *
 * Two of them were. This pins what each form's page is actually supposed to
 * look like, so the answer is a test rather than an impression:
 *
 *  · 1-HOUR DRAMA is SUPPOSED to match the feature template — an hour-long
 *    teleplay is written in ordinary screenplay format. What makes it a
 *    teleplay is act structure, so the act break is what gets asserted. (Its
 *    scene-heading gap had drifted to one blank line; v6.30 measured the
 *    standard at two.)
 *  · RADIO was the film template wearing different flags: cue at 3.50",
 *    speech in the narrow 2.50–6.00 column. Audio drama puts the cue at the
 *    left margin, the speech under it at near-full measure, double-spaced.
 *  · MULTICAM, STAGE and AV were already differentiated; these lock that in.
 */
import { describe, it, expect } from 'vitest';
import { SYSTEM_TEMPLATE_LIST } from './formattingTemplateStore';
import { INDUSTRY_STANDARD_TEMPLATE } from './industryStandardTemplate';
import { ONE_HOUR_DRAMA_ID } from './templates/oneHourDramaTemplate';
import { MULTICAM_SITCOM_ID } from './templates/multicamSitcomTemplate';
import { STAGE_PLAY_ID } from './templates/stagePlayTemplate';
import { RADIO_PLAY_ID } from './templates/radioPlayTemplate';
import { AV_SCRIPT_ID } from './templates/avScriptTemplate';

const byId = (id: string) => {
  const t = SYSTEM_TEMPLATE_LIST.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};
const std = INDUSTRY_STANDARD_TEMPLATE;
const geom = ['bold', 'italic', 'underline', 'textTransform', 'textAlign', 'marginTop', 'leftIndent', 'rightIndent'] as const;
/** Element ids whose geometry differs from the feature template. */
const differing = (id: string) => {
  const t = byId(id);
  return Object.entries(t.rules)
    .filter(([rid, r]) => {
      const s = std.rules[rid];
      if (!s) return true;
      return geom.some((k) => JSON.stringify((r as unknown as Record<string, unknown>)[k]) !== JSON.stringify((s as unknown as Record<string, unknown>)[k]));
    })
    .map(([rid]) => rid);
};

describe('template formatting standards (v7.11)', () => {
  it('1-hour drama keeps FEATURE geometry — that is the standard for the form', () => {
    const t = byId(ONE_HOUR_DRAMA_ID);
    for (const id of ['sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'transition']) {
      for (const k of geom) {
        expect((t.rules[id] as unknown as Record<string, unknown>)[k], `${id}.${k}`)
          .toEqual((std.rules[id] as unknown as Record<string, unknown>)[k]);
      }
    }
  });

  it('…and carries the structure that makes it a teleplay: acts start a page', () => {
    expect(byId(ONE_HOUR_DRAMA_ID).forceBreakBefore).toContain('newAct');
  });

  it('scene headings keep the standard two-line gap everywhere they are film-format', () => {
    // v6.30 measured it; a template that drifts to 12pt reads visibly tighter.
    expect(std.rules.sceneHeading.marginTop).toBe(24);
    expect(byId(ONE_HOUR_DRAMA_ID).rules.sceneHeading.marginTop).toBe(24);
  });

  it('multicam is a DIFFERENT page: caps action, double-spaced dialogue, act-per-page', () => {
    const t = byId(MULTICAM_SITCOM_ID);
    expect(t.rules.action.textTransform).toBe('uppercase');
    expect(t.lineHeightMultiplier?.dialogue).toBe(2);
    expect(t.forceBreakBefore).toContain('sceneHeading');
    expect(t.rules.sceneHeading.underline).toBe(true);
    expect(differing(MULTICAM_SITCOM_ID).length).toBeGreaterThanOrEqual(5);
  });

  it('stage play centres its character cues and runs dialogue full width', () => {
    const t = byId(STAGE_PLAY_ID);
    expect(t.rules.character.textAlign).toBe('center');
    expect(t.rules.dialogue.leftIndent).toBeLessThan(std.rules.dialogue.leftIndent);
    expect(t.rules.dialogue.rightIndent).toBeGreaterThan(std.rules.dialogue.rightIndent);
    expect(t.rules.stageDirection).toBeTruthy();
  });

  it('radio puts the cue at the LEFT MARGIN with the speech under it, double-spaced', () => {
    const t = byId(RADIO_PLAY_ID);
    expect(t.rules.character.leftIndent).toBe(1.5);
    expect(t.rules.character.leftIndent).toBeLessThan(std.rules.character.leftIndent);
    expect(t.rules.dialogue.rightIndent).toBeGreaterThan(std.rules.dialogue.rightIndent);
    expect(t.lineHeightMultiplier?.dialogue).toBe(2);
    expect(t.rules.soundEffect).toBeTruthy();
    expect(t.rules.musicCue).toBeTruthy();
  });

  it('radio is no longer the film column — the speech measure really moved', () => {
    const t = byId(RADIO_PLAY_ID);
    const filmWidth = std.rules.dialogue.rightIndent - std.rules.dialogue.leftIndent;
    const radioWidth = t.rules.dialogue.rightIndent - t.rules.dialogue.leftIndent;
    expect(radioWidth).toBeGreaterThan(filmWidth + 1);
  });

  it('AV is a two-column script: its own elements, full-measure fallbacks', () => {
    const t = byId(AV_SCRIPT_ID);
    expect(t.rules.avPara).toBeTruthy();
    expect(t.rules.avShot).toBeTruthy();
    expect(t.rules.dialogue.rightIndent).toBeGreaterThan(std.rules.dialogue.rightIndent);
  });

  it('every non-feature template differs from the feature one somewhere', () => {
    // 1-hour drama excepted, and deliberately — see the first case.
    for (const id of [MULTICAM_SITCOM_ID, STAGE_PLAY_ID, RADIO_PLAY_ID, AV_SCRIPT_ID]) {
      expect(differing(id).length, id).toBeGreaterThan(3);
    }
  });
});
