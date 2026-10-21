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
- A signed release: the workflow signs once SignPath (below) is set up. Until then
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

Signing puts a publisher's name on the SmartScreen screen instead of "unknown publisher".
Windows still warns about a new app until enough people have installed it; that fades on its
own. The installers on GitHub are signed one of two ways; set up one, not both.

### SignPath Foundation (free, the one we use)

SignPath Foundation signs open-source projects for free. The certificate is theirs, so
Windows shows **SignPath Foundation** as the publisher. In return Daybook keeps its
[code signing policy](https://daybooksalon.vercel.app/code-signing) page (`site/`, linked
from every footer), and a person approves each release in SignPath before it's signed.

To set it up once:

1. Apply at [signpath.org/apply](https://signpath.org/apply.html) with the answers in
   `signpath/application.md`. Approval takes a while; they check the project by hand.
2. When they accept it, in SignPath: create (or check) the project `daybook` with the signing
   policy `release-signing`, link it to this GitHub repository as a trusted build system,
   and paste `signpath/artifact-configuration.xml` as its artifact configuration.
3. Turn on two-factor sign-in for SignPath and GitHub (they require it), and create an API
   token for a CI user that may submit signing requests.
4. In this repository (Settings → Secrets and variables → Actions):
   - secret `SIGNPATH_API_TOKEN`: that token
   - variable `SIGNPATH_ORGANIZATION_ID`: the organization's ID in SignPath
   - variables `SIGNPATH_PROJECT_SLUG` and `SIGNPATH_POLICY_SLUG`, only if they aren't
     `daybook` and `release-signing`
5. Push a `windows-v*` tag. The workflow builds the installers, uploads them, and waits up
   to three hours while an approver accepts the request in SignPath; the signed installers
   then replace the unsigned ones, after Windows confirms their signatures.

### SSL.com eSigner (paid)

An OV certificate in Jamak's own name, about $310 a year: $129 for the certificate and $180
for a year of eSigner signing. Azure Artifact Signing would be cheaper, but it only takes
organizations from the US, Canada, the EU and the UK.

1. Buy an **OV code signing** certificate from SSL.com for the organization, and choose
   **eSigner** as the way to sign.
2. Pass SSL.com's validation of the organization (documents and a call, a few days).
3. Enroll the certificate in eSigner with the **TOTP** option and keep its secret.
4. Add four repository secrets: `ESIGNER_USERNAME`, `ESIGNER_PASSWORD`,
   `ESIGNER_CREDENTIAL_ID` and `ESIGNER_TOTP_SECRET`.
5. Push a `windows-v*` tag. The workflow downloads CodeSignTool (pinned to v1.3.2, checked by
   hash), and Tauri signs the app, its uninstaller and both installers with
   `scripts/sign.ps1`, which fails the release if Windows doesn't see a valid signature.

eSigner is used only when `SIGNPATH_API_TOKEN` isn't set. Only `windows-v*` tags sign: pull
requests build unsigned and never see the secrets.

## Microsoft Store

The Store signs what it publishes, so a Store install never shows SmartScreen. Every build
also makes `Daybook.msix` (`scripts/msix.ps1`, `msix/AppxManifest.xml`), the workflow
artifact **Daybook-msix**. It's unsigned and installs only through the Store.

To publish it once:

1. Open a [Partner Center](https://partner.microsoft.com/dashboard/registration) developer
   account. Individuals register free; a company account has a one-time fee.
2. Create an app and reserve its name. "Daybook" may already be taken; then pick another
   (for example "Daybook Salon") and use it everywhere the Store asks for it.
3. Under Product identity, copy three values into repository variables:
   `MSIX_IDENTITY_NAME` (Package/Identity/Name), `MSIX_PUBLISHER` (Package/Identity/Publisher,
   `CN=…`) and `MSIX_PUBLISHER_DISPLAY_NAME` (Package/Properties/PublisherDisplayName).
4. Push a `windows-v*` tag, download **Daybook-msix** from that workflow run, and upload
   `Daybook.msix` to a new submission with the listing (description, screenshots, the
   privacy policy at /code-signing#privacy, age rating). Microsoft reviews it, usually in a
   few days.

A Store install keeps its own days, apart from an install from `Daybook-setup.exe`: Windows
gives Store apps their own storage. Export a copy in one and import it in the other to move.

## Where the days live

WebView2 keeps localStorage per origin, and the pages are served from `http://tauri.localhost`
(`use_https_scheme(false)` in `src/main.rs`). Changing that origin, or the app's identifier
(`dev.daybook.windows`, which names its data folder under `%LOCALAPPDATA%`), would open an empty
Daybook and leave the old days behind.
