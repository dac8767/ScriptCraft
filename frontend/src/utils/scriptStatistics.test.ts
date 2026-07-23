/**
 * Script statistics — the pure computations behind the Statistics / Analytics
 * tools. Untested until now; these pin the scene parsing, word/line counting,
 * and the character-name normalization (SARAH and SARAH (V.O.) are one person).
 */
import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import type { CharacterProfile } from '../stores/editorStore';
import { extractSceneData, computeOverviewStats, computeCharacterDialogue } from './scriptStatistics';

const t = (text: string): JSONContent => ({ type: 'text', text });
const el = (type: string, text: string): JSONContent => ({ type, content: [t(text)] });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

// Two scenes; SARAH speaks twice (once billed "(V.O.)"), MARCUS once.
const script = doc(
  el('sceneHeading', 'INT. DINER - DAY'),   // 4 words
  el('action', 'Sarah sips coffee.'),       // 3
  el('character', 'SARAH'),                  // 1
  el('dialogue', 'We should go now.'),       // 4
  el('character', 'SARAH (V.O.)'),           // 2
  el('dialogue', 'Wait.'),                   // 1
  el('action', 'She leaves.'),               // 2
  el('sceneHeading', 'EXT. PARK - NIGHT'),   // 4
  el('character', 'MARCUS'),                 // 1
  el('dialogue', 'Hello there friend.'),     // 3
);

describe('extractSceneData', () => {
  const scenes = extractSceneData(script);

  it('splits on scene headings', () => {
    expect(scenes).toHaveLength(2);
  });

  it('parses heading prefix / location / time of day', () => {
    expect(scenes[0]).toMatchObject({ prefix: 'INT.', location: 'DINER', timeOfDay: 'DAY' });
    expect(scenes[1]).toMatchObject({ prefix: 'EXT.', location: 'PARK', timeOfDay: 'NIGHT' });
  });

  it('normalizes (V.O.)/(O.S.)/(CONT\'D) so a character is counted once', () => {
    const sarah = scenes[0].dialogueByCharacter;
    expect(sarah.size).toBe(1);                       // SARAH and SARAH (V.O.) merged
    expect(sarah.get('SARAH')).toEqual({ lines: 2, words: 5 });
  });

  it('tallies action words and per-scene total words', () => {
    expect(scenes[0].actionWords).toBe(5);            // 3 + 2
    expect(scenes[0].totalWords).toBe(17);            // 4+3+1+4+2+1+2
    expect(scenes[1].totalWords).toBe(8);             // 4+1+3
    expect(scenes[1].dialogueByCharacter.get('MARCUS')).toEqual({ lines: 1, words: 3 });
  });
});

describe('computeOverviewStats', () => {
  it('aggregates totals; falls back to ~250 words/page when pageCount is 0', () => {
    const s = computeOverviewStats(script, 0);
    expect(s).toMatchObject({
      totalScenes: 2,
      totalWords: 25,
      totalDialogueLines: 3,
      totalCharacters: 2,
      totalPages: 1,          // ceil(25/250) → 1
      estimatedRuntime: 1,    // 1 page ≈ 1 min
    });
    expect(s.averageSceneLength).toBe(0.5);
  });

  it('uses the provided page count when given', () => {
    const s = computeOverviewStats(script, 120);
    expect(s.totalPages).toBe(120);
    expect(s.averageSceneLength).toBe(60);
    expect(s.estimatedRuntime).toBe(120);
  });

  it('handles an empty document without dividing by zero', () => {
    const s = computeOverviewStats(doc(), 0);
    expect(s.totalScenes).toBe(0);
    expect(s.totalWords).toBe(0);
    expect(s.averageSceneLength).toBe(0);
    expect(extractSceneData(doc())).toEqual([]);
  });
});

describe('computeCharacterDialogue', () => {
  it('rolls dialogue up per character with scene counts and share %', () => {
    const profiles = [{ name: 'Sarah', color: '#f00', gender: 'F', role: 'lead' }] as unknown as CharacterProfile[];
    const stats = computeCharacterDialogue(script, profiles);

    const sarah = stats.find((s) => s.name === 'SARAH')!;
    const marcus = stats.find((s) => s.name === 'MARCUS')!;

    expect(sarah).toMatchObject({ lineCount: 2, wordCount: 5, sceneCount: 1, color: '#f00' });
    expect(marcus).toMatchObject({ lineCount: 1, wordCount: 3, sceneCount: 1, color: '#666' }); // no profile → default
    // Dialogue share by words: SARAH 5/8, MARCUS 3/8.
    expect(sarah.dialoguePercentage).toBeCloseTo(62.5, 5);
    expect(marcus.dialoguePercentage).toBeCloseTo(37.5, 5);
  });
});
