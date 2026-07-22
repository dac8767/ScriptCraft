import { describe, it, expect } from 'vitest';
import { toTitleCaseName, firstNameOf, lastNameOf, joinName, escapeRegExp } from './characterNames';

describe('character name helpers', () => {
  it('title-cases screenplay caps', () => {
    expect(toTitleCaseName('SAM VEDU')).toBe('Sam Vedu');
    expect(toTitleCaseName('SAM')).toBe('Sam');
    expect(toTitleCaseName('VEDU')).toBe('Vedu');
    expect(toTitleCaseName("O'BRIEN")).toBe("O'Brien");
    expect(toTitleCaseName('MARY-JANE')).toBe('Mary-Jane');
    expect(toTitleCaseName('')).toBe('');
  });

  it('splits first and last', () => {
    expect(firstNameOf('SAM VEDU')).toBe('SAM');
    expect(lastNameOf('SAM VEDU')).toBe('VEDU');
    expect(lastNameOf('SAM')).toBe('');
    expect(lastNameOf('')).toBe('');
    // multi-word last name
    expect(lastNameOf('JEAN DE LA FONTAINE')).toBe('DE LA FONTAINE');
  });

  it('rejoins, dropping a blank last', () => {
    expect(joinName('SAM', 'PRUSA')).toBe('SAM PRUSA');
    expect(joinName('SAM', '')).toBe('SAM');
    expect(joinName('Sam', 'Vedu')).toBe('Sam Vedu');
  });

  it('a first-name replace regex hits the cue and the full name but not title case', () => {
    const re = new RegExp('\\b' + escapeRegExp('SAM') + '\\b', 'g');
    const script = 'SAM VEDU walks in.\nSAM\n(dialogue) Sam, over here!\nSAMANTHA waves.';
    expect(script.replace(re, 'SAMUEL')).toBe(
      'SAMUEL VEDU walks in.\nSAMUEL\n(dialogue) Sam, over here!\nSAMANTHA waves.',
    );
  });

  it('a last-name replace hits only the full-name phrase, not the bare cue', () => {
    const re = new RegExp('\\b' + escapeRegExp('SAM VEDU') + '\\b', 'g');
    const script = 'SAM VEDU walks in.\nSAM\nSAM VEDU again.';
    expect(script.replace(re, 'SAM PRUSA')).toBe('SAM PRUSA walks in.\nSAM\nSAM PRUSA again.');
  });
});
