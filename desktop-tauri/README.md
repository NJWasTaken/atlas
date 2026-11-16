# Atlas Tauri migration spike

This is an isolated Tauri v2 shell prototype. It does not replace the shipped Electron application and is not included in the release workflow.

## Current scope

- Compile a minimal Rust/Tauri desktop shell.
- Establish the native window configuration and application identifier.
- Keep the existing Electron application as the production desktop app while the migration is evaluated.
- Preserve FastAPI and the existing Next.js standalone server as the first migration target; neither backend nor frontend is being rewritten in this spike.

## Next integration steps

1. Measure the current Electron cold-start stages on a clean Windows install: process launch, FastAPI health, Next.js health, first window paint, and first interactive screen.
2. Add Rust-managed process supervision for the existing bundled FastAPI executable and a bundled Node runtime running the existing Next.js standalone server.
3. Start both services concurrently, expose a lightweight local startup page, and navigate to the existing frontend once both health checks pass.
4. Implement graceful shutdown and forced cleanup for both child processes.
5. Verify the existing SQLite database, PDFs, instance secret, and user-data directory remain unchanged.
6. Add Windows/macOS/Linux packaging only after the runtime lifecycle works on all three platforms.

## Build locally

Install the Rust toolchain and the platform prerequisites from the Tauri v2 prerequisites guide, then:

```sh
cd desktop-tauri
cargo check
cargo tauri dev
```

The prototype window currently displays a static shell page. It intentionally does not start the Atlas services yet. Do not distribute it or treat it as a replacement installer.

## Why this is staged

The current Electron app launches a Python API sidecar, waits for its health endpoint, launches the Next.js standalone Node server, waits again, and only then creates the application window. We need measurements before attributing the delay to Electron itself. Tauri changes the desktop shell and WebView runtime, but retaining the current Next.js server still means shipping and starting Node. The first goal is to remove Electron without changing the backend or frontend behavior.
