/**
 * Keyboard shortcut registry (v0.77).
 *
 * One source of truth for every rebindable command: its label, which menu it
 * lives under, its default binding (or none), and who owns the key.
 *
 * `owner` matters:
 *   'app'    — handled by FreeDraft's global keydown handler. Fully rebindable.
 *   'editor' — TipTap also has a keymap for it (Bold = Mod+B, etc). Our handler
 *              runs these in the CAPTURE phase and stops propagation, so exactly
 *              one handler fires and rebinding actually takes effect (otherwise
 *              TipTap would still act on the old key and both would run).
 *   'system' — Cut / Copy / Paste / Undo / Redo / Select All. These are owned by
 *              the OS and the browser's native edit pipeline; intercepting them
 *              reliably (especially clipboard access) isn't something a web view
 *              can promise. They're LISTED so the picture is complete, but are
 *              not rebindable, and the UI says so rather than pretending.
 *
 * Combos are stored canonically as 'Mod+Shift+S' — 'Mod' is Cmd on macOS and
 * Ctrl elsewhere, so a binding is portable across platforms. Display formatting
 * (⇧⌘S vs Ctrl+Shift+S) happens only at render time.
 */

export type ShortcutOwner = 'app' | 'editor' | 'system';

export interface ShortcutCommand {
  id: string;
  label: string;
  /** Menu the command lives under — used to group the list. */
  group: string;
  /** Canonical default combo, or null if the command ships unbound. */
  defaultCombo: string | null;
  owner: ShortcutOwner;
}

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  // ── File ──
  { id: 'newScreenplay', label: 'New Screenplay', group: 'File', defaultCombo: 'Mod+N', owner: 'app' },
  { id: 'openFile', label: 'Open from Library / Cloud', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'importLocal', label: 'Open Local File', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'save', label: 'Save', group: 'File', defaultCombo: 'Mod+S', owner: 'app' },
  { id: 'saveAs', label: 'Save As', group: 'File', defaultCombo: 'Mod+Shift+S', owner: 'app' },
  { id: 'print', label: 'Print', group: 'File', defaultCombo: 'Mod+P', owner: 'app' },
  { id: 'preview', label: 'Preview', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'exportPDF', label: 'Export: PDF', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'exportFDX', label: 'Export: Final Draft (.fdx)', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'exportFountain', label: 'Export: Fountain', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'exportDocx', label: 'Export: Word (.docx)', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'rename', label: 'Rename', group: 'File', defaultCombo: null, owner: 'app' },
  { id: 'settings', label: 'Settings', group: 'File', defaultCombo: null, owner: 'app' },

  // ── Edit ──
  { id: 'undo', label: 'Undo', group: 'Edit', defaultCombo: 'Mod+Z', owner: 'system' },
  { id: 'redo', label: 'Redo', group: 'Edit', defaultCombo: 'Mod+Shift+Z', owner: 'system' },
  { id: 'cut', label: 'Cut', group: 'Edit', defaultCombo: 'Mod+X', owner: 'system' },
  { id: 'copy', label: 'Copy', group: 'Edit', defaultCombo: 'Mod+C', owner: 'system' },
  { id: 'paste', label: 'Paste', group: 'Edit', defaultCombo: 'Mod+V', owner: 'system' },
  { id: 'selectAll', label: 'Select All', group: 'Edit', defaultCombo: 'Mod+A', owner: 'system' },
  { id: 'find', label: 'Find & Replace', group: 'Edit', defaultCombo: 'Mod+F', owner: 'app' },
  { id: 'goToPage', label: 'Go to Page', group: 'Edit', defaultCombo: 'Mod+G', owner: 'app' },

  // ── View ──
  { id: 'zoomIn', label: 'Zoom In', group: 'View', defaultCombo: 'Mod+=', owner: 'app' },
  { id: 'zoomOut', label: 'Zoom Out', group: 'View', defaultCombo: 'Mod+-', owner: 'app' },
  { id: 'actualSize', label: 'Actual Size', group: 'View', defaultCombo: null, owner: 'app' },
  { id: 'fitPage', label: 'Fit Page to Screen', group: 'View', defaultCombo: null, owner: 'app' },
  { id: 'customize', label: 'Customize', group: 'View', defaultCombo: null, owner: 'app' },

  // ── Format ──
  { id: 'bold', label: 'Bold', group: 'Format', defaultCombo: 'Mod+B', owner: 'editor' },
  { id: 'italic', label: 'Italic', group: 'Format', defaultCombo: 'Mod+I', owner: 'editor' },
  { id: 'underline', label: 'Underline', group: 'Format', defaultCombo: 'Mod+U', owner: 'editor' },

  // ── Insert ──
  { id: 'dualDialogue', label: 'Dual Dialogue', group: 'Insert', defaultCombo: 'Mod+D', owner: 'editor' },

  // ── Tools ──
  { id: 'spellCheck', label: 'Spelling', group: 'Tools', defaultCombo: 'F7', owner: 'app' },
  { id: 'writingSuggestions', label: 'Writing Suggestions', group: 'Tools', defaultCombo: 'Shift+F7', owner: 'app' },
  { id: 'takeSnapshot', label: 'Take Auto Save', group: 'Tools', defaultCombo: null, owner: 'app' },
  { id: 'scriptHistory', label: 'Script History', group: 'Tools', defaultCombo: null, owner: 'app' },
  { id: 'trackChanges', label: 'Track Changes', group: 'Tools', defaultCombo: null, owner: 'app' },
];

export const COMMAND_BY_ID: Record<string, ShortcutCommand> = Object.fromEntries(
  SHORTCUT_COMMANDS.map((c) => [c.id, c]),
);

/** Menu order for the shortcuts list. */
export const SHORTCUT_GROUPS = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools'];

export const isMac = typeof navigator !== 'undefined'
  && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Keys that can't stand alone as a shortcut. */
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt', 'CapsLock', 'Dead']);

/**
 * Canonical combo for a keyboard event, or null if it isn't a usable shortcut.
 * Bare letters are rejected — a shortcut needs a modifier or must be a function
 * key, or every keystroke while typing would fire a command.
 */
export function eventToCombo(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('Mod');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  // Normalize so Cmd+= and Cmd++ (same physical key) are one binding, and
  // letters are case-insensitive (Shift is already captured above).
  if (key === '+') key = '=';
  if (key === '_') key = '-';
  if (key.length === 1) key = key.toUpperCase();

  const isFunctionKey = /^F\d{1,2}$/.test(key);
  const isNamed = ['Escape', 'Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End',
    'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);

  // Needs a modifier unless it's a function key.
  if (parts.length === 0 && !isFunctionKey) return null;
  // Shift alone + a letter isn't a shortcut (that's just a capital letter).
  if (parts.length === 1 && parts[0] === 'Shift' && !isFunctionKey && !isNamed) return null;

  parts.push(key);
  return parts.join('+');
}

/** Human-readable combo: ⇧⌘S on macOS, Ctrl+Shift+S elsewhere. */
export function formatCombo(combo: string | null): string {
  if (!combo) return '';
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  if (isMac) {
    let out = '';
    if (mods.includes('Alt')) out += '⌥';
    if (mods.includes('Shift')) out += '⇧';
    if (mods.includes('Mod')) out += '⌘';
    const k = key === '=' ? '+' : key === '-' ? '−' : key;
    return out + k;
  }
  const out: string[] = [];
  if (mods.includes('Mod')) out.push('Ctrl');
  if (mods.includes('Alt')) out.push('Alt');
  if (mods.includes('Shift')) out.push('Shift');
  out.push(key === '=' ? '+' : key);
  return out.join('+');
}

// ── Persistence ────────────────────────────────────────────────────────────
// An override maps a command id to a combo, or to null meaning "explicitly
// unbound". A command absent from the map simply uses its default — so the
// difference between "never touched" and "deliberately cleared" survives.

const STORAGE_KEY = 'opendraft:shortcutOverrides';

export type ShortcutOverrides = Record<string, string | null>;

export function loadShortcutOverrides(): ShortcutOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ShortcutOverrides = {};
    for (const [id, combo] of Object.entries(parsed)) {
      if (!COMMAND_BY_ID[id]) continue;                 // drop stale ids
      if (combo === null || typeof combo === 'string') out[id] = combo as string | null;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveShortcutOverrides(o: ShortcutOverrides) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}

/** Effective binding for every command: override if present, else the default. */
export function effectiveBindings(overrides: ShortcutOverrides): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const c of SHORTCUT_COMMANDS) {
    out[c.id] = Object.prototype.hasOwnProperty.call(overrides, c.id)
      ? overrides[c.id]
      : c.defaultCombo;
  }
  return out;
}

/** The command already using `combo`, if any (ignoring `exceptId`). */
export function findConflict(
  bindings: Record<string, string | null>,
  combo: string,
  exceptId: string,
): string | null {
  for (const [id, c] of Object.entries(bindings)) {
    if (id !== exceptId && c === combo) return id;
  }
  return null;
}
