// Fountain markup format parser
// Spec: https://fountain.io/syntax
import { EMPTY_TITLE_PAGE, titlePageJsonNodes, type TitlePageData } from './titlePageLayout';

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

/* v2.25: the Fountain title block ("Title: …", "Credit:", "Author:" … at the
   very top, ended by the first blank line) used to be ignored — every line
   landed in the script body as action. Parse it into the same structured
   title page the FDX importer and the Title Page editor build. */
const TITLE_KEYS: Record<string, keyof TitlePageData | 'credit'> = {
  'title': 'tpTitle',
  'credit': 'credit',
  'author': 'tpWrittenBy',
  'authors': 'tpWrittenBy',
  'source': 'tpBasedOn',
  'draft': 'tpDraft',
  'draft date': 'tpDraft',
  'date': 'tpDraftDate',
  'contact': 'tpContact',
  'copyright': 'tpCopyright',
  'notes': 'tpNotes',
};

/** Parse a leading title block. Returns the data (null if there is none) and
 *  how many lines it consumed (including the terminating blank line). */
export function parseFountainTitleBlock(lines: string[]): { data: TitlePageData | null; consumed: number } {
  const first = lines[0]?.match(/^([A-Za-z][A-Za-z ]*):\s*(.*)$/);
  if (!first || TITLE_KEYS[first[1].trim().toLowerCase()] === undefined) return { data: null, consumed: 0 };

  const data: TitlePageData = { ...EMPTY_TITLE_PAGE };
  let sawAny = false;
  let currentKey: keyof TitlePageData | 'credit' | null = null;
  let i = 0;
  const append = (key: keyof TitlePageData | 'credit', value: string) => {
    // v2.51: strip Fountain emphasis markup (_underline_, *italic*, **bold**)
    // — titles like `_**STAR WARS**_` displayed their raw underscores and
    // asterisks on the rendered title page.
    const v = value.trim()
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_([^_]+)_/g, '$1');
    if (!v) return;
    if (key === 'credit') return;   // "Written by" — deriveTitleFields adds it
    const prev = data[key];
    (data as unknown as Record<string, string>)[key] = typeof prev === 'string' && prev ? `${prev}\n${v}` : v;
    sawAny = true;
  };
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { i++; break; }        // blank line ends the block
    const kv = line.match(/^([A-Za-z][A-Za-z ]*):\s*(.*)$/);
    const key = kv ? TITLE_KEYS[kv[1].trim().toLowerCase()] : undefined;
    if (kv && key !== undefined) {
      currentKey = key;
      append(key, kv[2]);
    } else if (currentKey && /^(\s{3,}|\t)/.test(line)) {
      append(currentKey, line);                    // indented continuation
    } else {
      break;                                       // not a title line — body starts here
    }
  }
  return sawAny ? { data, consumed: i } : { data: null, consumed: 0 };
}

export function parseFountain(text: string): TipTapNode {
  const lines = text.split('\n');
  const nodes: TipTapNode[] = [];
  const titleBlock = parseFountainTitleBlock(lines);
  const titleNodes: TipTapNode[] = titleBlock.data ? titlePageJsonNodes(titleBlock.data) : [];
  let i = titleBlock.consumed;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Page break: a line of 3+ equals signs (Fountain forced page break).
    // v2.51: this used to fall through to action and print a literal "==="
    // in the script. There's no forced-break element yet, so the marker is
    // consumed; pagination still breaks pages on its own.
    if (/^={3,}$/.test(trimmed)) {
      i++;
      continue;
    }

    // Synopsis line: starts with = (must follow a scene heading)
    if (trimmed.startsWith('= ') && nodes.length > 0 && nodes[nodes.length - 1].type === 'sceneHeading') {
      const prev = nodes[nodes.length - 1];
      if (!prev.attrs) prev.attrs = {};
      prev.attrs.synopsis = trimmed.substring(2).trim();
      i++;
      continue;
    }

    // Forced scene heading: line starts with .
    if (trimmed.startsWith('.') && trimmed.length > 1 && trimmed[1] !== '.') {
      nodes.push(makeNode('sceneHeading', trimmed.substring(1).trim()));
      i++;
      continue;
    }

    // Scene heading: starts with INT., EXT., EST., INT/EXT., I/E.
    if (/^(INT\.|EXT\.|EST\.|INT\.\/EXT\.|I\/E\.)/.test(trimmed.toUpperCase())) {
      nodes.push(makeNode('sceneHeading', trimmed));
      i++;
      continue;
    }

    // Forced transition: line starts with >
    if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
      nodes.push(makeNode('transition', trimmed.substring(1).trim()));
      i++;
      continue;
    }

    // Transition: all caps ending with TO:
    if (/^[A-Z\s]+TO:$/.test(trimmed)) {
      nodes.push(makeNode('transition', trimmed));
      i++;
      continue;
    }

    // Forced character: line starts with @
    if (trimmed.startsWith('@')) {
      let charName = trimmed.substring(1).trim();
      // Check for dual dialogue marker ^
      const isDual = charName.endsWith('^');
      if (isDual) charName = charName.replace(/\s*\^$/, '');
      const charNode = makeNode('character', charName);
      if (isDual) charNode.attrs = { ...charNode.attrs, dualDialogue: true };
      nodes.push(charNode);
      i++;
      i = collectDialogueBlock(lines, i, nodes);
      continue;
    }

    // Character: all uppercase, preceded by empty line — and, per the spec,
    // FOLLOWED by a non-empty line (the dialogue). v2.51: without that check
    // a lone all-caps line like "OPENING SCROLL" became a stranded character.
    if (isCharacterLine(trimmed.replace(/\s*\^$/, '')) && isPrecededByEmptyLine(lines, i) && isFollowedByContent(lines, i)) {
      let charName = trimmed;
      const isDual = charName.endsWith('^');
      if (isDual) charName = charName.replace(/\s*\^$/, '').trim();
      const charNode = makeNode('character', charName);
      if (isDual) charNode.attrs = { ...charNode.attrs, dualDialogue: true };
      nodes.push(charNode);
      i++;
      i = collectDialogueBlock(lines, i, nodes);
      continue;
    }

    // Default: action
    nodes.push(makeNode('action', trimmed));
    i++;
  }

  // Post-process: merge dual dialogue pairs
  const merged = mergeDualDialogue(nodes);

  const body = merged.length > 0 ? merged : [makeNode('action', '')];
  return {
    type: 'doc',
    content: [...titleNodes, ...body],
  };
}

function makeNode(type: string, text: string): TipTapNode {
  if (text === '') {
    return { type, content: [] };
  }
  return {
    type,
    content: [{ type: 'text', text }],
  };
}

function isCharacterLine(line: string): boolean {
  // All uppercase, not empty, no lowercase letters
  const cleaned = line.replace(/\(.*\)/, '').trim();
  return cleaned.length > 0 && cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned);
}

function isPrecededByEmptyLine(lines: string[], index: number): boolean {
  if (index === 0) return true;
  return lines[index - 1].trim() === '';
}

/** Fountain: a character cue must have its dialogue directly under it. */
function isFollowedByContent(lines: string[], index: number): boolean {
  const next = lines[index + 1];
  return next !== undefined && next.trim() !== '';
}

const DIALOGUE_TYPES = new Set(['character', 'dialogue', 'parenthetical']);

/**
 * Post-process: find character nodes marked with dualDialogue=true and merge
 * the previous dialogue group with the current one into a dualDialogue container.
 */
function mergeDualDialogue(nodes: TipTapNode[]): TipTapNode[] {
  const result: TipTapNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'character' && node.attrs?.dualDialogue) {
      // This character starts the right column — find the previous dialogue group for the left column
      // Remove dualDialogue marker from attrs
      delete node.attrs!.dualDialogue;
      if (Object.keys(node.attrs!).length === 0) delete (node as any).attrs;

      // Collect right column: this character + following dialogue/parenthetical
      const rightCol: TipTapNode[] = [node];
      for (let j = i + 1; j < nodes.length; j++) {
        if (DIALOGUE_TYPES.has(nodes[j].type) && nodes[j].type !== 'character') {
          rightCol.push(nodes[j]);
          i = j;
        } else {
          i = j - 1;
          break;
        }
      }

      // Find previous dialogue group in result (walk backwards to find character)
      const leftCol: TipTapNode[] = [];
      while (result.length > 0) {
        const last = result[result.length - 1];
        if (DIALOGUE_TYPES.has(last.type)) {
          leftCol.unshift(result.pop()!);
        } else {
          break;
        }
      }

      if (leftCol.length > 0) {
        result.push({
          type: 'dualDialogue',
          content: [
            { type: 'dualDialogueColumn', content: leftCol },
            { type: 'dualDialogueColumn', content: rightCol },
          ],
        });
      } else {
        // No previous dialogue group found — just add nodes normally
        result.push(...rightCol);
      }
    } else {
      result.push(node);
    }
  }

  return result;
}

function collectDialogueBlock(lines: string[], i: number, nodes: TipTapNode[]): number {
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      break;
    }

    // Parenthetical
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      nodes.push(makeNode('parenthetical', trimmed));
      i++;
      continue;
    }

    // Dialogue
    nodes.push(makeNode('dialogue', trimmed));
    i++;
  }
  return i;
}
