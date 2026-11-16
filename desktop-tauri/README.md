# Atlas Tauri migration spike

This is an isolated Tauri v2 runtime prototype. The shipped Electron app remains the production desktop app.

## Current prototype

- Rust/Tauri owns the native window and application lifecycle.
- Rust creates/loads a persistent per-install JWT secret in the Tauri app-data directory.
- Rust starts the existing FastAPI sidecar and the existing Next.js standalone server concurrently.
- The frontend uses the same local API origin and port as the Electron runtime.
- The startup screen is displayed immediately while both services become healthy.
- Rust owns both child processes and terminates/waits for them when the app exits.
- Existing FastAPI, Next.js UI, SQLite schema and PDF storage are intentionally unchanged.

## Runtime resources

Before running the prototype, populate `desktop/runtime/` with:

- `atlas-api` (Linux/macOS) or `atlas-api.exe` (Windows), built from `backend/desktop_entry.py`.
- `node` (Linux/macOS) or `node.exe` (Windows), from the matching official Node.js 22 LTS distribution.
- `frontend/server.js` and the rest of the Next.js standalone output under `frontend/`.

The Tauri bundle resource map includes these runtime paths. The current repository does not yet automate the Node runtime download or produce cross-platform Tauri installers; that is the next build-pipeline task.

## Build locally

Install the Rust toolchain and platform prerequisites from the Tauri v2 prerequisites guide. Populate runtime resources as described above, then:

```sh
cd desktop-tauri
cargo fmt --all -- --check
cargo check
cargo tauri dev
```

The prototype is not yet a distributable replacement for Electron. Do not remove or change the Electron release workflow until Windows, macOS and Linux Tauri builds, user-data migration/compatibility, and lifecycle tests pass.

## Important design constraints

- Do not run a second database or move the existing app-data directory during this spike.
- The same SQLite database, PDF directory, and `instance.secret` must remain in a stable user-data location.
- Services bind to loopback only.
- No user-installed Node, Python, Docker, PostgreSQL, or external storage service is required in the final installer.
- Keep startup and shutdown logs so cold-start and lifecycle behavior can be compared with Electron.
