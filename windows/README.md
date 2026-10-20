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
- A signed release: the workflow signs once the certificate below is set up. Until then
  SmartScreen warns the first time (**More info → Run anyway**).
- Updating itself: install a newer one over it, your days stay.

## Build

Needs Node 22 and pnpm (as the web app does), Rust, and the Tauri CLI
(`cargo install tauri-cli --version "^2" --locked`). On Windows, Rust also needs the Microsoft
C++ Build Tools with the **Desktop development with C++** workload
([Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/)).

```sh
pnpm build:windows          # the pages, into .next-windows/
cd windows && cargo tauri build
```

On Windows that gives `target/release/bundle/nsis/Daybook_*-setup.exe` (per user, no admin)
and `target/release/bundle/msi/Daybook_*.msi`. `pnpm build:windows` works in cmd.exe and
PowerShell too: `.npmrc` turns on pnpm's shell emulator, so `DAYBOOK_DEVICE=windows` is set
the same way everywhere.

On a Mac, `cargo tauri build --debug --bundles app` builds the same app as a `.app`, enough to
try the pages, the storage and the tray (the menu bar stands in for it).

## Release

Push a `windows-v*` tag (`windows-v0.1.0`). `.github/workflows/windows-release.yml` builds both
installers on `windows-latest` and attaches them to that tag's release as `Daybook-setup.exe`
and `Daybook.msi`. Pull requests that touch the app or the pages build them as an artifact.

## Signing

Releases are signed with an OV code-signing certificate held by SSL.com eSigner, which signs
from CI with no hardware key. Azure Artifact Signing would be cheaper, but it only takes
organizations from the US, Canada, the EU and the UK. Signing puts the publisher's name on the
SmartScreen screen instead of "unknown publisher". Windows still warns about a new app until
enough people have installed it, and that fades on its own.

To set it up once:

1. Buy an **OV code signing** certificate from SSL.com for the organization (the name
   SmartScreen will show), and choose **eSigner** as the way to sign.
2. Pass SSL.com's validation of the organization: documents and a call. It takes a few days.
3. Enroll the certificate in eSigner. Choose the **TOTP** (authenticator) option and keep the
   secret it shows: the workflow needs it to sign without someone typing a code.
4. Add four repository secrets (Settings → Secrets and variables → Actions):
   - `ESIGNER_USERNAME`: the SSL.com account's username
   - `ESIGNER_PASSWORD`: its password
   - `ESIGNER_CREDENTIAL_ID`: the certificate's eSigner credential ID
   - `ESIGNER_TOTP_SECRET`: the TOTP secret from step 3
5. Push a `windows-v*` tag. The workflow downloads CodeSignTool (pinned to v1.3.2, checked by
   hash), and Tauri signs the app, its uninstaller and both installers with
   `scripts/sign.ps1`, which fails the release if Windows doesn't see a valid signature.

Only `windows-v*` tags sign: pull requests build unsigned and never see the secrets. Each
release uses about five signings of the eSigner plan's monthly allowance.

## Where the days live

WebView2 keeps localStorage per origin, and the pages are served from `http://tauri.localhost`
(`use_https_scheme(false)` in `src/main.rs`). Changing that origin, or the app's identifier
(`dev.daybook.windows`, which names its data folder under `%LOCALAPPDATA%`), would open an empty
Daybook and leave the old days behind.
