/**
 * Native macOS menu bar (v2.93) — mirrors the in-window menus into the real
 * app menu via Tauri's menu API.
 *
 * ONE SOURCE: the same MenuSection[] the in-window MenuBar computes is what
 * syncs here — labels, order, hidden menus, live text ("Zoom (120%)"), the
 * Scrapbook's contextual menus, everything. MenuBar calls syncNativeMenu()
 * every render; a signature diff makes that cheap (rebuild only when the
 * visible shape actually changed — actions are looked up fresh by path, so
 * closures never force a rebuild).
 *
 * What flattens, by design (Derek's spec sends these to the toolbar's second
 * row instead): item icons, the Insert Table grid picker (its native item
 * falls back to the item's plain `action`), and color chips.
 *
 * Cut/Copy/Paste/Select All are PredefinedMenuItems so macOS drives the
 * webview's clipboard natively. Undo/Redo stay OURS — smartUndo's beat
 * routing must keep working, and native undo selectors would bypass
 * ProseMirror history.
 */
import { isTauri } from '../services/platform';

export interface NativeItemData {
  label: string;
  shortcut?: string;         // DISPLAY string from formatCombo (⌘⇧S / Ctrl+Shift+S)
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  children?: NativeItemData[];
  render?: unknown;          // custom submenu content — cannot exist natively
  checked?: boolean;         // v3.05: checkable items become CheckMenuItems
}
export interface NativeSectionData { label: string; items: NativeItemData[] }

let lastSignature = '';
let installed = false;
/** Freshest sections — native actions resolve through here by path, so a
 *  re-render with new closures needs no menu rebuild. */
let latest: NativeSectionData[] = [];

/** Which Edit items hand over to the OS (clipboard needs the responder
 *  chain). Undo/Redo intentionally absent — see the header. */
const PREDEFINED_EDIT: Record<string, 'Copy' | 'Cut' | 'Paste' | 'SelectAll'> = {
  Cut: 'Cut', Copy: 'Copy', Paste: 'Paste', 'Select All': 'SelectAll',
};

/** formatCombo's display string → a muda accelerator ("⌘⇧S" → "Cmd+Shift+S"). */
export function displayShortcutToAccelerator(s?: string): string | undefined {
  if (!s) return undefined;
  const parts: string[] = [];
  let rest = s;
  const eat = (sym: string, name: string) => {
    if (rest.includes(sym)) { parts.push(name); rest = rest.replaceAll(sym, ''); }
  };
  eat('⌘', 'Cmd'); eat('⌃', 'Ctrl'); eat('⌥', 'Option'); eat('⇧', 'Shift');
  // Non-symbol form ("Ctrl+Shift+S") — split on +.
  if (rest.includes('+')) {
    const segs = rest.split('+').map((x) => x.trim()).filter(Boolean);
    const key = segs.pop() ?? '';
    for (const m of segs) parts.push(m === 'Mod' ? 'CmdOrCtrl' : m);
    rest = key;
  }
  rest = rest.trim();
  if (!rest) return undefined;
  return [...parts, rest].join('+');
}

function signatureOf(sections: NativeSectionData[]): string {
  const item = (it: NativeItemData): unknown => [
    it.separator ? '|' : it.label, it.disabled ? 1 : 0, it.shortcut ?? '',
    it.checked === undefined ? '' : (it.checked ? 'C1' : 'C0'),
    it.children ? it.children.map(item) : (it.render ? 'R' : 0),
  ];
  return JSON.stringify(sections.map((s) => [s.label, s.items.map(item)]));
}

function actionAt(path: number[]): (() => void) | undefined {
  let items: NativeItemData[] | undefined = latest[path[0]]?.items;
  let it: NativeItemData | undefined;
  for (const idx of path.slice(1)) {
    it = items?.[idx];
    items = it?.children;
  }
  return it?.action;
}

export async function syncNativeMenu(sections: NativeSectionData[]): Promise<void> {
  if (!isTauri()) return;
  latest = sections;
  const sig = signatureOf(sections);
  if (installed && sig === lastSignature) return;
  lastSignature = sig;

  const { Menu, Submenu, MenuItem, CheckMenuItem, PredefinedMenuItem } = await import('@tauri-apps/api/menu');

  const buildItem = async (it: NativeItemData, path: number[], inEdit: boolean): Promise<unknown> => {
    if (it.separator) return PredefinedMenuItem.new({ item: 'Separator' });
    if (inEdit && PREDEFINED_EDIT[it.label]) {
      return PredefinedMenuItem.new({ text: it.label, item: PREDEFINED_EDIT[it.label] });
    }
    if (it.children && it.children.length > 0) {
      const kids = await Promise.all(it.children.map((c, i) => buildItem(c, [...path, i], false)));
      return Submenu.new({ text: it.label, enabled: !it.disabled, items: kids as never[] });
    }
    // v3.05: checkable items are real CheckMenuItems, so macOS draws the
    // checkmark in its own gutter. The signature includes checked state,
    // so a toggle rebuilds the menu with the mark in the right place.
    if (it.checked !== undefined) {
      return CheckMenuItem.new({
        text: it.label,
        checked: it.checked,
        enabled: !it.disabled && !!it.action,
        accelerator: displayShortcutToAccelerator(it.shortcut),
        action: () => { actionAt(path)?.(); },
      });
    }
    return MenuItem.new({
      text: it.label,
      enabled: !it.disabled && !!(it.action || it.render),
      accelerator: displayShortcutToAccelerator(it.shortcut),
      action: () => { actionAt(path)?.(); },
    });
  };

  const submenus = await Promise.all(sections.map(async (s, si) =>
    Submenu.new({
      text: s.label,
      items: (await Promise.all(s.items.map((it, ii) => buildItem(it, [si, ii], s.label === 'Edit')))) as never[],
    })));

  // The application menu (first slot on macOS): the standard block.
  const appMenu = await Submenu.new({
    text: 'ScriptCraft',
    items: [
      await PredefinedMenuItem.new({ text: 'About ScriptCraft', item: { About: null } }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Services' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ text: 'Hide ScriptCraft', item: 'Hide' }),
      await PredefinedMenuItem.new({ item: 'HideOthers' }),
      await PredefinedMenuItem.new({ item: 'ShowAll' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ text: 'Quit ScriptCraft', item: 'Quit' }),
    ] as never[],
  });

  // A standard Window menu keeps Minimize/Zoom behavior.
  const windowMenu = await Submenu.new({
    text: 'Window',
    items: [
      await PredefinedMenuItem.new({ item: 'Minimize' }),
      await PredefinedMenuItem.new({ item: 'Maximize' }),
      await PredefinedMenuItem.new({ item: 'Fullscreen' }),
    ] as never[],
  });

  // v3.03, Derek: Window sits BEFORE Help (the macOS convention) — it used
  // to trail the whole bar because it's appended after the synced sections.
  const helpIdx = sections.findIndex((s) => s.label === 'Help');
  const ordered = helpIdx === -1
    ? [...submenus, windowMenu]
    : [...submenus.slice(0, helpIdx), windowMenu, ...submenus.slice(helpIdx)];
  const menu = await Menu.new({ items: [appMenu, ...ordered] as never[] });
  await menu.setAsAppMenu();
  installed = true;
}

/** Back to Tauri's default menu — the instant revert path. */
export async function uninstallNativeMenu(): Promise<void> {
  if (!isTauri() || !installed) return;
  installed = false;
  lastSignature = '';
  const { Menu } = await import('@tauri-apps/api/menu');
  const def = await Menu.default();
  await def.setAsAppMenu();
}
