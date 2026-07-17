# ClipStack

A tiny native macOS **menu-bar clipboard manager**. No dependencies, one Swift file.

- **Automatic history** — everything you copy (⌘C) anywhere on your Mac is captured into a "Recently Copied" list (up to 50 items, deduplicated).
- **Saved phrases** — type a phrase you use often and save it. It stays forever until you delete it.
- **One-click copy** — every item (recent or saved) is a button. Click it and the text is on your clipboard, ready to paste (⌘V) into any app. A green checkmark confirms the copy.
- **Pin from history** — hover a recent item and click the 📌 to promote it to a saved phrase.
- **Private by design** — skips content flagged as concealed (e.g. password managers). Everything is stored locally in `~/Library/Application Support/ClipStack/`.

## Build & run

Requires macOS 13 (Ventura) or later and the Xcode Command Line Tools
(`xcode-select --install` if you don't have them).

```bash
cd ClipStack
./build.sh
open build/ClipStack.app
```

A clipboard icon appears in your menu bar (top-right of the screen). Click it to open the panel.

To install permanently:

```bash
cp -R build/ClipStack.app /Applications/
```

To launch at login: System Settings → General → Login Items → **+** → select ClipStack.

## Usage

| Action | How |
|--------|-----|
| Copy a recent or saved item | Click it — it's now on your clipboard, paste with ⌘V |
| Save a custom phrase | Type it in the "Add a phrase to save…" field, press Return or click **+** |
| Save a recent copy as a phrase | Hover the item, click the pin icon |
| Delete a saved phrase | Hover it, click the trash icon |
| Remove one history item | Hover it, click the ✕ |
| Clear all history | **Clear History** at the bottom |
| Quit | **Quit** at the bottom of the panel |

## Notes

- The app is menu-bar only (no Dock icon).
- History and saved phrases persist across restarts (JSON files in `~/Library/Application Support/ClipStack/`).
- The build is ad-hoc signed for local use. Distributing it to other Macs would require Developer ID signing + notarization (see the main repo's `CLAUDE.md` for that process).
