# FreeDraft — Mac Desktop Release Roadmap

Target: a signed, notarized `.dmg` users download from your site. Keeps
login + cloud sync for a future paid tier; ships offline-first now.

## Architecture (already built by the OpenDraft base)
- **Tauri** wraps the React frontend in a native macOS app → real `.app`/`.dmg`.
- Desktop runs on **local SQLite** bundled in the app — no Python server, no
  ports, works offline. (frontend `initStorage()` swaps the HTTP api for a
  local one when running under Tauri.)
- **Login + cloud sync are additive**, gated behind sign-in, layered on top of
  the local store — they don't replace the offline experience.
- `build-desktop.sh` already builds + signs + notarizes a `.dmg`.

## The one hard dependency for cloud
The cloud/login code worked by syncing to **open-draft.com** (Proteus's
servers) — hardcoded in `frontend/src/config.ts`. You can't ship a FreeDraft
app that depends on a competitor's infrastructure. As of this commit those
defaults are removed: cloud endpoints now come from build-time env vars
(`VITE_CLOUD_API_BASE`, `VITE_COLLAB_WS_URL`) and default to **empty =
cloud disabled**, so the app runs fully offline until *you* deploy a backend.

To turn cloud on later you must stand up your own copy of this repo's
`backend/` (FastAPI) and `collab-server/` on a host you control (e.g.
`api.freedraft.com` / `collab.freedraft.com`), then build with those env vars
set. That is its own infra project — domain, server, database, hosting cost.

## Recommended sequence

### Phase 1 — ship the offline .dmg (do this first)
Don't block launch on running servers. Cloud UI can show "coming soon."
1. **On a real Mac** (Codespaces can't build macOS apps): install Xcode CLT,
   Rust (`rustup`), Node. Then `npm install -g @tauri-apps/cli`,
   `cd frontend && npm install`, and `npm run tauri dev`. A FreeDraft window
   on local SQLite = milestone zero.
2. **Rebrand** — DONE in this commit: `tauri.conf.json` productName
   `FreeDraft`, identifier `com.freedraft.app`, window titles. Still TODO:
   replace the app icons (`src-tauri/icons/*`, still OpenDraft art) — this is
   also audit item T1. Generate a new set with `npm run tauri icon path/to/
   freedraft-1024.png`.
3. **Apple Developer Program — $99/yr.** Required: macOS refuses to open an
   unsigned downloaded app ("damaged and can't be opened"). Enroll, create a
   "Developer ID Application" certificate.
4. **Point the signing at your account.** `build-desktop.sh` hardcodes
   Proteus's identity (`Base Information Management Pvt. Ltd. (335RGMFDB6)`) —
   replace `APPLE_SIGNING_IDENTITY` with your own "Developer ID Application:
   <You> (<TEAMID>)", and set `APPLE_ID` / `APPLE_PASSWORD` (app-specific
   password) / `APPLE_TEAM_ID` in a root `.env` (never commit it).
5. **Build**: `./build-desktop.sh` → a signed, notarized `.dmg`. Test it opens
   cleanly on a Mac that never saw the code (drag the quarantine bit: download
   it, don't just copy).
6. **Host** the `.dmg` on your site with a download link.

### Phase 2 — turn on cloud (when you're ready to charge)
1. Deploy `backend/` + `collab-server/` to your infra; set production
   `COLLAB_JWT_SECRET` / `JWT_SECRET` (the code refuses to start in prod
   without them). Put the API behind TLS; set `CORS_ORIGINS` to your app
   origin and drop the LAN regex (audit S4).
2. Rebuild the desktop app with `VITE_CLOUD_API_BASE=https://api.freedraft.com`
   and `VITE_COLLAB_WS_URL=wss://collab.freedraft.com`.
3. Ship it as an update; the paid tier lights up.

## Don't-forget list (from the audit, blocks public release)
- Replace ALL OpenDraft brand art (icons, splash, favicon, store images) — T1.
- Keep upstream MIT `LICENSE`; add your own copyright line — T2.
- Dictionary + Courier Prime license files; THIRD-PARTY notices — T5/T6/T7.
- `npm audit fix` in frontend — S3.
- Trademark clearance search on "FreeDraft" — T4.
- Rotate the GitHub PAT exposed in chat — S7.
