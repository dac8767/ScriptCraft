/**
 * ScriptCraft native format (.odraft) — import/export utilities.
 *
 * An .odraft file is a JSON document containing the script metadata and
 * TipTap content, designed for lossless round-tripping.
 */

import type { ScriptMeta } from '../services/api';

interface OdraftFile {
  odraft_version: number;
  format: 'opendraft-script';
  exported_at: string;
  meta: {
    title: string;
    author: string;
    color: string;
    page_count: number;
  };
  content: Record<string, unknown>;
  /** v0.82: the project's custom themes travel with it, so another ScriptCraft
   *  can import them ("Import Themes from a Project"). Optional — files written
   *  before this simply have no themes to offer. */
  themes?: unknown[];
}

/** Build an .odraft JSON blob from script metadata and content. */
export function exportOdraft(
  meta: ScriptMeta,
  content: Record<string, unknown>,
  themes?: unknown[],
): Blob {
  const data: OdraftFile = {
    odraft_version: 1,
    format: 'opendraft-script',
    exported_at: new Date().toISOString(),
    meta: {
      title: meta.title,
      author: meta.author,
      color: meta.color,
      page_count: meta.page_count,
    },
    content,
    ...(themes && themes.length ? { themes } : {}),
  };
  return new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
}

/** Download a script as an .odraft file. */
export async function downloadOdraft(
  meta: ScriptMeta,
  content: Record<string, unknown>,
  themes?: unknown[],
): Promise<void> {
  const blob = exportOdraft(meta, content, themes);
  const text = await blob.text();
  const filename = `${meta.title || 'Untitled'}.odraft`;
  const { saveFile } = await import('./fileOps');
  await saveFile(text, filename, [{ name: 'ScriptCraft', extensions: ['odraft'] }]);
}

/** Parse an .odraft JSON string back into meta + content. */
export function parseOdraft(
  jsonText: string,
): { meta: { title: string; author: string; color: string; page_count: number }; content: Record<string, unknown> } {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid .odraft file: not valid JSON');
  }

  if (data.format !== 'opendraft-script') {
    throw new Error('Invalid .odraft file: unrecognized format');
  }
  if (typeof data.odraft_version !== 'number') {
    throw new Error('Invalid .odraft file: missing version');
  }

  return {
    meta: {
      title: data.meta?.title || 'Untitled',
      author: data.meta?.author || '',
      color: data.meta?.color || '',
      page_count: data.meta?.page_count || 0,
    },
    content: data.content || {},
  };
}
