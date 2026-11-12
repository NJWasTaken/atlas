# Desktop installer branding

Electron Builder reads installer branding from this directory. Replace the placeholder assets with the final Atlas artwork while keeping these filenames:

- `icon.ico` — Windows application, taskbar, and installer icon (multi-resolution ICO; include 16, 32, 48, 64, 128, and 256 px).
- `icon.icns` — macOS application icon.
- `icons/` — Linux PNG icons named by pixel size (for example `256x256.png`).
- `installer.nsh` — custom NSIS hooks. The uninstall hook stops the Atlas and API processes before installed files are removed.

The artwork should be a square, transparent-background mark with sufficient padding. Keep the source artwork in a vector or high-resolution format so platform variants can be regenerated consistently.

Installer configuration lives in `desktop/package.json` under `build`:
- `productName`, `appId`, and `artifactName` control application identity and output naming.
- `win`, `nsis`, `mac`, and `linux` configure platform-specific installers.
- `directories.buildResources` selects this directory.
- `win.icon`, `mac.icon`, and `linux.icon` select the platform icon assets.

Do not set `deleteAppDataOnUninstall` to true by default: user databases and PDFs live outside the installation directory and should survive uninstall/reinstall unless the user explicitly chooses to remove their data.
