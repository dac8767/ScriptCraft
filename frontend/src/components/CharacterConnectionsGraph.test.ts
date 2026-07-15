// @vitest-environment jsdom
/**
 * CharacterConnectionsGraph (v1.86) — pins the scene → link derivation
 * (the replacement for the Airtable "encounters" table).
 */
import { describe, it, expect } from 'vitest';
import { buildConnections } from './CharacterConnectionsGraph';

describe('buildConnections', () => {
  it('links every pair in a scene and weights repeat encounters', () => {
    const { nodes, links } = buildConnections([
      ['ALICE', 'BOB'],
      ['ALICE', 'BOB', 'CAROL'],
    ]);
    expect(nodes.map((n) => n.id)).toEqual(['ALICE', 'BOB', 'CAROL']);
    const ab = links.find((l) => l.source === 'ALICE' && l.target === 'BOB');
    expect(ab?.value).toBe(2);                          // two shared scenes
    expect(links.find((l) => l.source === 'BOB' && l.target === 'CAROL')?.value).toBe(1);
  });

  it('drops characters with no connections and dedupes within a scene', () => {
    const { nodes, links } = buildConnections([
      ['LONER'],                       // alone in a scene — no link, no node
      ['ALICE', 'ALICE', 'BOB'],       // duplicate cue counts once
    ]);
    expect(nodes.map((n) => n.id)).toEqual(['ALICE', 'BOB']);
    expect(links).toHaveLength(1);
    expect(links[0].value).toBe(1);
  });
});
