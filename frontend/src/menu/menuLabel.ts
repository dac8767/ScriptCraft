/**
 * How a menu item reads — the one place that decides it (v7.68).
 *
 * Derek, twice: "the grayed options are not showing the helper text like I
 * asked." They were not, and could not.
 *
 * `tooltip` is HOVER text, and hover text does not exist in a native macOS
 * menu. nativeMenuSync hands Tauri a text / enabled / accelerator / checked
 * set and Tauri's menu API has no tooltip field to hand it — NSMenuItem has
 * `toolTip`, Tauri does not expose it. Derek runs the native menu, so every
 * disabled item has been grey and mute for him since v7.06 no matter how many
 * render paths passed `title` through. v7.58 fixed a real pointer-events bug
 * in the IN-APP menu and I reported it as fixed; the menu he was looking at
 * was never the one I fixed.
 *
 * A label is the only channel both menus share, so the reason goes there.
 *
 * THIS FILE HOLDS NO REACT. It is imported by MenuBar (a component) and by
 * nativeMenuSync (which runs outside React and is unit-tested in a bare node
 * environment). Putting the builder in MenuBar and importing it from the sync
 * pulled the entire component graph — and the zustand store it creates — into
 * that test, which stopped collecting at all. Shared code between a component
 * and a non-component belongs in neither of them.
 */

/** The short forms that ride in a label, beside the sentences they shorten. */
export const NOTE_IN_DEVELOPMENT = 'in development';
export const NOTE_FORMAT_LOCKED = 'format locked';

/**
 * A label with its reason appended: `Revision Mode (in development)`.
 *
 * Both menus call this. They used to decide separately how an item reads,
 * which is exactly how one of them ended up explaining itself and the other
 * staying silent.
 */
export function labelWithNote(label: string, note?: string): string {
  return note ? `${label} (${note})` : label;
}
