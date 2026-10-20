# Daybook for Windows (preview)

The Daybook pages in a window on your PC, as the Mac app has them: the same static copy
(`pnpm build:windows`), every request answered in the page (`lib/localApi.ts`), your days kept
on this PC in the window's storage. A Tauri 2 app on WebView2, which Windows 10 and 11 already have.

## What it does

- Opens on the welcome screen, then **Start my day**. No account, no server.
- Your days live only on this PC, inside Daybook. Settings → Your data exports a copy into
  Downloads, and imports one.
- A tray icon by the clock: click it to bring the window back; right-click for **Open** and
  **Quit**. Closing the window keeps Daybook in the tray. Opening Daybook again shows the
  window that's there.

## Not yet

- A glance at today from the tray (the Mac app's menu bar popover).
- Connecting a cloud Daybook (phone, Frame TV, AI agents, Linear). Settings doesn't offer it.
- Code signing: SmartScreen warns the first time (**More info → Run anyway**).
- Updating itself: install a newer one over it, your days stay.

## Build

Needs Node 22 and pnpm (as the web app does), Rust, and the Tauri CLI
(`cargo install tauri-cli --version "^2" --locked`).

```sh
pnpm build:windows          # the pages, into .next-windows/
cd windows && cargo tauri build
```

On Windows that gives `target/release/bundle/nsis/Daybook_*-setup.exe` (per user, no admin)
and `target/release/bundle/msi/Daybook_*.msi`. In cmd.exe or PowerShell, set the variable
yourself before the pages build: `$env:DAYBOOK_DEVICE="windows"; pnpm exec next build`.

On a Mac, `cargo tauri build --debug --bundles app` builds the same app as a `.app`, enough to
try the pages, the storage and the tray (the menu bar stands in for it).

## Release

Push a `windows-v*` tag (`windows-v0.1.0`). `.github/workflows/windows-release.yml` builds both
installers on `windows-latest` and attaches them to that tag's release as `Daybook-setup.exe`
and `Daybook.msi`. Pull requests that touch the app or the pages build them as an artifact.

## Where the days live

WebView2 keeps localStorage per origin, and the pages are served from `http://tauri.localhost`
(`use_https_scheme(false)` in `src/main.rs`). Changing that origin, or the app's identifier
(`dev.daybook.windows`, which names its data folder under `%LOCALAPPDATA%`), would open an empty
Daybook and leave the old days behind.
