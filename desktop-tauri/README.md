# Atlas Tauri desktop runtime

Tauri v2 is the desktop release target. The release workflow was switched from Electron to Tauri in PR #26; the first complete installer/runtime validation is still a release-readiness task.

## Runtime

- Rust/Tauri owns the native window and application lifecycle.
- Rust starts the bundled FastAPI sidecar and Next.js standalone server concurrently.
- The API listens on `127.0.0.1:43121`; the frontend listens on `127.0.0.1:43122`.
- The API and frontend must pass health checks before the app navigates to the full UI.
- The local startup shell remains visible while services start. If startup fails, Atlas keeps the shell visible, changes the window title to indicate failure, and writes diagnostic output rather than leaving a hidden or blank window.
- The Rust shell owns both child processes and attempts graceful termination on Unix, with a forced-stop fallback. Windows child termination uses the platform process kill fallback.

## User data compatibility

The runtime deliberately reuses the legacy Electron `Atlas` profile location rather than Tauri's identifier-derived app-data path:

- Windows: `%APPDATA%/Atlas`
- macOS: `~/Library/Application Support/Atlas`
- Linux: `$XDG_CONFIG_HOME/Atlas`, falling back to `~/.config/Atlas`

The profile contains:

- `atlas.sqlite3` — local structured data.
- `pdfs/` — managed Explore PDF files.
- `instance.secret` — generated per-install authentication secret.
- `logs/desktop.log` — startup failures and shell diagnostics.
- `logs/api.log` and `logs/frontend.log` — bundled service logs.

The FastAPI entry point creates the profile directories, configures SQLite and the PDF directory, and runs Alembic migrations to the current head before serving requests. The Tauri runtime must not silently switch to a second profile or delete user data during updates.

**PDF storage is not user-configurable yet.** The current default remains the Atlas-managed `pdfs/` directory under the profile. A native folder picker and verified migration workflow are planned as the next storage milestone.

## Bundled resources

The installer bundles:

- `atlas-api` / `atlas-api.exe`, built from `backend/desktop_entry.py`.
- A pinned Node runtime.
- The Next.js standalone server and its static assets.

End users should not need to install Node.js, Python, Docker, PostgreSQL, or a cloud-storage service.

## Build locally

Install the Rust toolchain and platform prerequisites from the Tauri v2 prerequisites guide. Prepare the runtime resources using the same staging steps as the desktop workflows, then:

```sh
cd desktop-tauri
cargo fmt --all -- --check
cargo check
cargo test
cargo tauri dev
```

## Validation status

The Tauri release workflow builds Windows x64, macOS Intel, macOS Apple Silicon, and Linux x64 installers. The multi-platform Tauri CI workflow compiles the shell, runs Rust helper tests, and smoke-tests the packaged API/frontend runtime.

The runtime smoke test also starts from the previous SQLite schema revision, verifies the packaged API upgrades it to the current migration head, creates an account, restarts the API against the same profile, and verifies the account remains available.

Still required before calling desktop releases production-ready:

- Install and launch each generated installer on its target OS.
- Verify clean install, relaunch, upgrade, and uninstall/reinstall behavior.
- Verify a real pre-Tauri Electron profile retains its database, PDF files, reading positions, bookmarks, and annotations.
- Confirm recovery behavior for failed migrations and missing/corrupt runtime resources.
- Complete platform-specific signing/notarisation when release credentials are available.

Installers are currently unsigned. Do not describe them as signed or notarised.

## Security and data constraints

- Services bind to loopback only.
- No API key, JWT secret, SQLite database, or user PDF is bundled in the installer.
- The per-install JWT secret is generated at runtime and stored in the user-data profile.
- User data stays outside the installation directory.
- Database and PDF files form one logical backup set; backing up SQLite without the PDF directory is incomplete.
