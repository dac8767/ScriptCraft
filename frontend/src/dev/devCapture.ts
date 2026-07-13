/**
 * devCapture — screenshots and the export bundle for the Dev Picker. DEV ONLY.
 *
 * The clipboard question, since it drove the design: a copy carries text OR an
 * image, never one paste containing both. So there are two routes out of here,
 * and you pick whichever suits the moment:
 *
 *   1. Copy image  — the PNG goes on the clipboard, ⌘V straight into the chat.
 *                    Two pastes: the note, then the picture.
 *   2. Export .md  — ONE file holding the note text and every screenshot embedded
 *                    as base64. Upload that single file and everything arrives
 *                    together, in order, with the shots captioned.
 */

export interface Shot {
  id: string;
  /** PNG data URL — embeds straight into the bundle, and renders as a thumbnail. */
  dataUrl: string;
  label: string;
  at: string;
}

/**
 * Snapshot the app.
 *
 * html2canvas re-renders the DOM into a canvas rather than asking the OS for the
 * screen, which means: no permission prompt, nothing leaves the machine, and it
 * works the same inside Tauri's WebKit as in a browser. The Dev Picker itself is
 * excluded — you want a picture of the bug, not of the tool you reported it with.
 */
export async function captureApp(label: string): Promise<Shot> {
  const { default: html2canvas } = await import('html2canvas');
  const target = (document.querySelector('.app-container') as HTMLElement) || document.body;

  const canvas = await html2canvas(target, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#1a1a1a',
    scale: Math.min(window.devicePixelRatio || 1, 2),   // crisp, but not enormous
    logging: false,
    useCORS: true,
    ignoreElements: (el) => el.hasAttribute?.('data-dev-panel')
      || el.classList?.contains('dev-picker-outline')
      || el.classList?.contains('dev-picker-tip'),
  });

  return {
    id: `shot-${Date.now()}`,
    dataUrl: canvas.toDataURL('image/png'),
    label,
    at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Put a PNG on the clipboard, so it can be pasted directly into the chat. */
export async function copyImage(shot: Shot): Promise<boolean> {
  try {
    const blob = await (await fetch(shot.dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;   // clipboard image writes can be blocked; the download still works
  }
}

/**
 * One file with everything: the note, then each screenshot, embedded.
 *
 * Markdown with base64 data URIs, because it's readable as plain text even if
 * nothing renders it — the note survives regardless, and the images can always be
 * decoded back out.
 */
export function buildBundle(note: string, shots: Shot[], context: string[]): string {
  const lines: string[] = [
    '# ScriptCraft — dev note',
    '',
    `_${new Date().toLocaleString()}_`,
    '',
    note.trim() || '_(no note)_',
    '',
  ];

  if (context.length) {
    lines.push('## Context', '', ...context.map((c) => `- ${c}`), '');
  }

  if (shots.length) {
    lines.push('## Screenshots', '');
    shots.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.label} (${s.at})`, '', `![${s.label}](${s.dataUrl})`, '');
    });
  }

  return lines.join('\n');
}

/** Download a string as a file — no server, no network, straight to disk. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download one screenshot on its own, for dragging into the chat. */
export function downloadShot(shot: Shot) {
  const a = document.createElement('a');
  a.href = shot.dataUrl;
  a.download = `${shot.label.replace(/[^\w-]+/g, '-').toLowerCase()}-${shot.id}.png`;
  a.click();
}
