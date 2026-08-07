/**
 * GenderAnalysisTool — ported from ScriptCraft v5.5's Gender Analysis.
 * Assign a gender to each speaking role to review parity by character count,
 * lines, and spoken words — plus the count of scenes where two or more female
 * characters speak.
 *
 * Gender assignments are stored on Character Profiles (the `gender` field),
 * so they persist with the script and flow into Statistics and FDX export.
 */
import { useMemo, useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorStore } from '../stores/editorStore';
import { computeCharacterDialogue, extractSceneData } from '../utils/scriptStatistics';
import { useHt } from '../utils/helperText';

const G = ['Male', 'Female', 'Other', 'Unassigned'] as const;
type Gender = typeof G[number];
const COLORS: Record<Gender, string> = {
  Male: '#3a4656', Female: '#e13d6f', Other: '#3aa0e1', Unassigned: '#c2c8cf',
};

/** Normalize a profile's free-text gender into one of our four buckets. */
function bucket(g: string): Gender {
  const v = (g || '').trim().toLowerCase();
  if (!v) return 'Unassigned';
  if (v.startsWith('m')) return 'Male';
  if (v.startsWith('f') || v.startsWith('w')) return 'Female';
  return 'Other';
}

interface GenderAnalysisToolProps {
  editor: Editor | null;
}

export default function GenderAnalysisTool({ editor }: GenderAnalysisToolProps) {
  const ht = useHt();
  const { characterProfiles, upsertCharacterProfile } = useEditorStore();
  const [docTick, setDocTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setDocTick((t) => t + 1);
    editor.on('update', onUpdate);
    return () => { editor.off('update', onUpdate); };
  }, [editor]);

  const doc = useMemo(() => (editor ? editor.getJSON() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, docTick]);

  const charStats = useMemo(
    () => (doc ? computeCharacterDialogue(doc, characterProfiles) : []),
    [doc, characterProfiles],
  );

  const gOf = (name: string): Gender => {
    const p = characterProfiles.find((x) => x.name.toUpperCase() === name.toUpperCase());
    return bucket(p?.gender || '');
  };

  const setGender = (name: string, g: Gender) => {
    // Same path as the Character Profiles panel — creates the profile if
    // missing and inherits its save behavior.
    upsertCharacterProfile(name.toUpperCase(), { gender: g === 'Unassigned' ? '' : g });
  };

  const totals = useMemo(() => {
    const t: Record<string, Record<Gender, number>> = {
      characters: {} as Record<Gender, number>,
      lines: {} as Record<Gender, number>,
      words: {} as Record<Gender, number>,
    };
    (['characters', 'lines', 'words'] as const).forEach((m) => {
      G.forEach((g) => { t[m][g] = 0; });
    });
    for (const c of charStats) {
      const g = gOf(c.name);
      t.characters[g]++;
      t.lines[g] += c.lineCount;
      t.words[g] += c.wordCount;
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charStats, characterProfiles]);

  const bechdelish = useMemo(() => {
    if (!doc) return 0;
    return extractSceneData(doc).filter((s) => {
      let female = 0;
      for (const name of s.dialogueByCharacter.keys()) {
        if (gOf(name) === 'Female') female++;
      }
      return female >= 2;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, characterProfiles]);

  const Bar = ({ metric }: { metric: 'characters' | 'lines' | 'words' }) => {
    const sum = G.reduce((a, g) => a + totals[metric][g], 0) || 1;
    return (
      <div className="fs-gender-metric">
        <b>{metric[0].toUpperCase() + metric.slice(1)}</b>
        <div className="fs-gender-bar">
          {G.map((g) => (
            <div
              key={g}
              style={{ width: `${(totals[metric][g] / sum) * 100}%`, background: COLORS[g] }}
              title={`${g}: ${totals[metric][g]}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fs-gender">
      <p className="fs-tool-intro">
        Assign a gender to each speaking role (or leave it unassigned) to review parity by
        character count, lines, and spoken words — plus how many scenes have two or more
        female characters interacting. Assignments save to Character Profiles.
      </p>
      <div className="fs-gender-legend">
        {G.map((g) => (
          <span key={g}><i style={{ background: COLORS[g] }} />{g}</span>
        ))}
      </div>
      <Bar metric="characters" />
      <Bar metric="lines" />
      <Bar metric="words" />
      <p className="fs-gender-bechdel">
        <b>{bechdelish}</b> scene{bechdelish === 1 ? '' : 's'} with two or more female characters speaking.
      </p>
      <table className="fs-gender-table">
        <thead>
          <tr>
            <th>Role</th><th>Lines</th><th>Words</th>
            {G.map((g) => <th key={g} title={g}>{g[0]}</th>)}
          </tr>
        </thead>
        <tbody>
          {charStats.map((c) => (
            <tr key={c.name}>
              <td className="fs-gender-name">{c.name}</td>
              <td>{c.lineCount}</td>
              <td>{c.wordCount}</td>
              {G.map((g) => (
                <td key={g}>
                  <input
                    type="radio"
                    name={`g-${c.name}`}
                    checked={gOf(c.name) === g}
                    onChange={() => setGender(c.name, g)}
                  />
                </td>
              ))}
            </tr>
          ))}
          {charStats.length === 0 && (
            <tr><td colSpan={7} className="fs-nav-empty">{ht('No speaking roles yet.')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
