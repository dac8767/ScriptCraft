<p align="center">
  <img src="images/OpenDraft-1024x1024.png" alt="ScriptCraft Logo" width="120">
</p>

<h1 align="center">ScriptCraft</h1>

<p align="center">
  <strong>Write professional screenplays for free</strong><br>
  No subscription. No cloud lock-in. Own your scripts forever.
</p>


<p align="center">
  <a href="#status">Status</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#comparison">Compare</a>
</p>

<p align="center">
  <img src="images/opendraft-demo.gif" alt="ScriptCraft in action — writing a screenplay" width="80%"><br>
  <em>Professional screenplay formatting, story planning, and version history — all in one app.</em>
</p>

<p align="center">
  <strong>Free forever</strong> &bull;
  <strong>Works 100% offline</strong> &bull;
  <strong>Your scripts never leave your machine</strong> &bull;
  <strong>Import from Final Draft in seconds</strong>
</p>

<p align="center">
  <a href="https://github.com/dac8767/ScriptCraft/stargazers">
    <img src="https://img.shields.io/github/stars/dac8767/ScriptCraft?style=flat-square&cacheSeconds=600" alt="GitHub Stars">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License: MIT">
  </a>
</p>

---

## Status

**ScriptCraft is in active development and has not had its first release.**
There are no published builds yet — signing and notarization are still
outstanding — so the only way to run it today is to
[build from source](#for-developers). When builds ship they will appear under
[Releases](https://github.com/dac8767/ScriptCraft/releases).

It is a fork of [OpenDraft](https://github.com/Proteus-Technologies-Private-Limited/OpenDraft)
and has diverged substantially: features have been added, rebuilt and in some
cases removed. Where this README and upstream's disagree, this one describes
what is actually in this repository.

---

## Why ScriptCraft?

Your script is your intellectual property. Cloud-based screenwriting tools store your work on corporate servers — where it can be mined, leaked, or used to train AI. ScriptCraft keeps every word on your machine.

- **Never pay for your own words** — Free under the MIT license. No trial, no subscription, no feature gating.
- **Switch without starting over** — Import from Final Draft (.fdx), Fountain, Word (.docx) or PDF. Export to any of them. Your scripts are never locked in.
- **Write offline** — A desktop app built on Tauri. No internet required, and no account to write.
- **Nothing phones home** — No telemetry, no analytics, no tracking.

---

## Screenshots

<p align="center">
  <img src="images/macos/editor.png" alt="Screenplay Editor" width="80%"><br>
  <em>Industry-standard screenplay formatting with scene navigator</em>
</p>

<p align="center">
  <img src="images/macos/beatboard.png" alt="Beat Board" width="80%"><br>
  <em>Visual story planning with drag-and-drop index cards</em>
</p>

<p align="center">
  <img src="images/version_history.png" alt="Version History" width="80%"><br>
  <em>Built-in version history with check-in, diff, and restore</em>
</p>

---

## Features

**Screenplay Editor**
Industry-standard formatting with autocomplete for character names, scene headings, and transitions.

**Beat Board**
Plan your story visually with drag-and-drop index cards before you write a single page.

**Version History**
Check in drafts, compare versions side-by-side, and restore any previous draft instantly.

**Character Profiles**
Track characters with descriptions, role types, reference images, and color-coded highlighting in your script.

**Import & Export**
Move freely between Final Draft (.fdx), Fountain, Word (.docx) and PDF — never locked into one tool.

**Customizable Throughout**
The ribbon toolbar, side panels, quick-access bar, context menu, keyboard shortcuts, themes and element formats are all editable, and every one of them resets.

> See the [full feature list](docs/FEATURES.md) for scene navigator, spell check
> and grammar, thesaurus, search & replace, script notes, annotations,
> production tags, goals, analytics, asset management, and more.

### Not in this fork

Being straight about what upstream has and this does not:

- **Real-time collaboration** was removed in v6.40 — the menu, invite links, sync
  machinery and settings are all gone. This is a single-writer app.
- **iOS and Android apps** are not built from this repository. The mobile apps in
  the app stores are upstream OpenDraft's, not this fork's.

---

## Comparison

How ScriptCraft compares to commercial screenwriting software. The ScriptCraft
column describes this repository; the other columns are from those products'
own published information.

| Feature | ScriptCraft | Final Draft | WriterDuet | Fade In |
|---------|:---------:|:-----------:|:----------:|:-------:|
| **Price** | Free | $250 | Free / $12/mo | $80 |
| **Open Source** | Yes (MIT) | No | No | No |
| **Offline Desktop App** | Yes | Yes | Limited | Yes |
| **Real-time Collaboration** | No | Yes | Yes | Yes |
| **Beat Board / Index Cards** | Yes | Yes | Yes | Yes |
| **Version History with Diff** | Yes | Limited | Limited | Limited |
| **Self-Hostable** | Yes | No | No | No |
| **Linux Support** | Yes | No | Yes (paid) | Yes |
| **No Account Required** | Yes | No | No | Yes |
| **Privacy-First (No Tracking)** | Yes | No | No | No |
| **Character Profiles** | Yes | Limited | No | No |
| **Casting / Reference Images** | Yes | No | No | No |
| **Mobile Apps** | No | Yes | Yes | Yes |
| **Production Tags** | Yes | Limited | Yes | Yes |
| **Fountain Import/Export** | Yes | No | Yes | Yes |
| **Web Browser Access** | Yes (self-hosted) | No | Yes | Limited |
| **Plugin Architecture** | Yes | No | No | No |

<sub>Competitor information from publicly available product pages as of April 2026 and not re-verified since. If you spot an inaccuracy, please <a href="https://github.com/dac8767/ScriptCraft/issues/new/choose">open an issue</a>.</sub>

---

## Getting Started

- **Want to run it?** Build from source — see [For Developers](#for-developers).
- **Need a walkthrough?** Read the [User Manual](user-manual/index.html).
- **Have a question?** Start a [Discussion](https://github.com/dac8767/ScriptCraft/discussions).

---

## Contributing

Contributions are welcome — a typo fix, a bug report and a new feature all count.

- **Found a bug?** [Open an issue](https://github.com/dac8767/ScriptCraft/issues/new/choose).
- **Have a question?** Start a [Discussion](https://github.com/dac8767/ScriptCraft/discussions).
- **Want to contribute code?** See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

---

## For Developers

<details>
<summary>Tech Stack, Project Structure, and Development Setup</summary>

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TipTap editor |
| Backend | Python 3.12, FastAPI, Uvicorn |
| Desktop | Tauri 2 (Rust) with bundled Python backend |
| State Management | Zustand |
| Version Control | Git (per-script, built-in, via dulwich) |

### Project Structure

```
ScriptCraft/
├── frontend/          # React + TypeScript web UI
├── backend/           # FastAPI Python API server
├── src-tauri/         # Tauri 2 desktop app shell (Rust)
├── docs/              # Documentation
├── images/            # Logos and assets
├── setup.sh           # One-click browser setup script
├── build.sh           # Web build script
└── build-desktop.sh   # Desktop app build script
```

<sub>`collab-server/` is still in the tree but is not used — collaboration was removed from the app in v6.40.</sub>

### Development

```bash
# Clone and install
git clone https://github.com/dac8767/ScriptCraft.git
cd ScriptCraft

# Backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Start development servers (in separate terminals)
./start_backend.sh    # API server on http://localhost:8000
./start_frontend.sh   # Dev server on http://localhost:5173
```

### Verification gates

Every change must pass all four before it ships:

```bash
cd frontend
npx tsc -b                        # zero errors — this gates the release build
npx vitest run                    # unit + component tests
npm run build                     # tsc -b && vite build
node devtools/check-all.mjs       # browser checks, driven by Playwright
```

### Building Desktop App

```bash
./build-desktop.sh            # signed + notarized (needs an Apple Developer account)
./build-desktop.sh --local    # unsigned local .app, no account needed
```

Output lands in `src-tauri/target/release/bundle/`. See
[docs/DESKTOP-RELEASE.md](docs/DESKTOP-RELEASE.md) for details.

### Run in Browser (Self-Hosted)

To run your own instance of ScriptCraft in a browser:

```bash
git clone https://github.com/dac8767/ScriptCraft.git
cd ScriptCraft
./setup.sh
```

Installs dependencies, builds the app, and opens it at **http://localhost:8000**.

Requires Python 3.12+, Node.js 18+, and Git. See [docs/INSTALLATION.md](docs/INSTALLATION.md) for details.

</details>

---

## License

ScriptCraft is open-source software licensed under the [MIT License](LICENSE).
Free to use, modify, and distribute. The MIT notice in `LICENSE` is upstream
OpenDraft's and is retained as that license requires.

---

<p align="center">
  Forked from <a href="https://github.com/Proteus-Technologies-Private-Limited/OpenDraft">OpenDraft</a>,
  built by screenwriters and engineers at
  <a href="https://github.com/Proteus-Technologies-Private-Limited">Proteus Technologies</a>.
</p>

<p align="center">
  <em>Write screenplays, not subscriptions.</em><br>
  If ScriptCraft helps your writing, a <a href="https://github.com/dac8767/ScriptCraft">star on GitHub</a> helps others discover it.
</p>
