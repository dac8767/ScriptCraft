// @vitest-environment jsdom
/**
 * screenplayMetrics (v6.33) — the wrap geometry all three renderers share,
 * pinned to Derek's exact reference sample. His report: "the word 'of' is in
 * a third row in scriptcraft, while it is at the end of the second row with a
 * different program." The reference page measures 63 chars per action line
 * (true 10-cpi Courier, column 1.5"→7.8"), and the exporter's old fit check
 * counted each word's trailing space, wrapping one word early on top of the
 * too-narrow 62 — both are covered here.
 */
import { describe, it, expect } from 'vitest';
import {
  CHARS_PER_LINE, FD_CPI, FD_CHAR_WIDTH_PT, columnFor, getTextLines,
} from './screenplayMetrics';
import { wordWrapRuns, type TextRun } from './pdfExporter';
import { migratePageLayout, DEFAULT_PAGE_LAYOUT } from '../stores/editorStore';

const run = (text: string): TextRun => ({ text, bold: false, italic: false, underline: false });
const wrapText = (text: string, max: number): string[] =>
  wordWrapRuns([run(text)], max, false).map((line) => line.map((r) => r.text).join(''));

const SAMPLE =
  'A TALL MAN in coveralls mops in an empty cafeteria. He hears a DISTANT CHOIR and looks up, revealing the eerily blank face of';
const JESSICA =
  'JESSICA (17), a devout honor student, wearing a cross necklace. Standing beside her is her best friend,';

describe('screenplay metrics — the measured reference geometry', () => {
  it('true 10 cpi: 7.2pt per character', () => {
    expect(FD_CPI).toBe(10.0);
    expect(FD_CHAR_WIDTH_PT).toBeCloseTo(7.2, 10);
  });

  it('column capacities on the default layout', () => {
    expect(CHARS_PER_LINE.action).toBe(63);
    expect(CHARS_PER_LINE.sceneHeading).toBe(63);
    expect(CHARS_PER_LINE.dialogue).toBe(35);
    expect(CHARS_PER_LINE.character).toBe(43);
    expect(CHARS_PER_LINE.parenthetical).toBe(25);
    expect(CHARS_PER_LINE.transition).toBe(23);
  });

  it('columnFor clamps full-width columns to the layout content edge', () => {
    const def = { pageWidth: 8.5, leftMargin: 1.5, rightMargin: 0.7 };
    expect(columnFor('action', def)).toEqual({ leftIn: 1.5, rightIn: 7.8, chars: 63 });
    // an imported FDX with a 1.0" right margin wraps at 60, same as its CSS
    const fdx = { pageWidth: 8.5, leftMargin: 1.5, rightMargin: 1.0 };
    expect(columnFor('action', fdx).chars).toBe(60);
    // dialogue's narrower absolute column is untouched by the wider margin
    expect(columnFor('dialogue', def).chars).toBe(35);
    expect(columnFor('dialogue', fdx).chars).toBe(35);
    // unknown types take the general (full-width) column
    expect(columnFor('somethingCustom', def).chars).toBe(63);
  });
});

describe("Derek's sample wraps exactly like the reference", () => {
  it('the TALL MAN action is TWO lines, breaking after "He hears a"', () => {
    const lines = wrapText(SAMPLE, CHARS_PER_LINE.action);
    expect(lines).toEqual([
      'A TALL MAN in coveralls mops in an empty cafeteria. He hears a',
      'DISTANT CHOIR and looks up, revealing the eerily blank face of',
    ]);
    expect(lines[0].length).toBe(62);
    expect(lines[1].length).toBe(62);
  });

  it('the 63-char JESSICA line fills the column exactly', () => {
    const lines = wrapText(JESSICA, CHARS_PER_LINE.action);
    expect(lines[0]).toBe('JESSICA (17), a devout honor student, wearing a cross necklace.');
    expect(lines[0].length).toBe(63);
    expect(lines[1]).toBe('Standing beside her is her best friend,');
  });

  it('getTextLines counts the same lines the exporter renders', () => {
    const cases: Array<[string, number]> = [
      [SAMPLE, 63], [JESSICA, 63], [SAMPLE, 60], [JESSICA, 35],
      ['a'.repeat(70), 63], ['xx ' + 'a'.repeat(130) + ' yy', 63],
      ['one  two   three', 10], ['', 63], ['word', 63],
    ];
    for (const [text, max] of cases) {
      expect(wrapText(text, max).length, `"${text.slice(0, 20)}…" @${max}`)
        .toBe(getTextLines(text, max));
    }
  });

  it('a word carrying its trailing space still fits a full line', () => {
    // 63 visible chars then more words: the trailing space after char 63
    // must not push the last word to the next line.
    const exact = 'x'.repeat(30) + ' ' + 'y'.repeat(32); // 30+1+32 = 63
    const lines = wrapText(exact + ' next', 63);
    expect(lines[0]).toBe(exact);
    expect(lines[1]).toBe('next');
  });
});

describe('page-layout default migration', () => {
  it('the untouched 1.0" right margin upgrades to 0.7"; chained from A4', () => {
    const a4Era = { ...DEFAULT_PAGE_LAYOUT, pageWidth: 8.26, pageHeight: 11.69, leftMargin: 1.5, rightMargin: 0.76 };
    expect(migratePageLayout(a4Era).rightMargin).toBe(0.7);
    expect(migratePageLayout(a4Era).pageWidth).toBe(8.5);
    const letterEra = { ...DEFAULT_PAGE_LAYOUT, pageWidth: 8.5, pageHeight: 11, leftMargin: 1.5, rightMargin: 1.0 };
    expect(migratePageLayout(letterEra).rightMargin).toBe(0.7);
  });

  it('a deliberately customized margin is left alone', () => {
    const custom = { ...DEFAULT_PAGE_LAYOUT, pageWidth: 8.5, pageHeight: 11, leftMargin: 1.5, rightMargin: 0.9 };
    expect(migratePageLayout(custom).rightMargin).toBe(0.9);
  });
});
