# Daybook for Mac

The full Daybook in a window, plus a glance at today in the menu bar.
[Download Daybook.dmg](https://github.com/joseamijares/daybook/releases/latest/download/Daybook.dmg):
signed with Developer ID and notarized, macOS 14 or later.

- **Window:** the web app itself (Today, Week, Backlog, Shut down), with the
  painting of the day. Use ⌘1–⌘4 for the four screens. The page signs itself
  in once with your saved key.
- **Menu bar:** today's painting with the day set over it, then:
  - the focus line;
  - meetings from Frame Dashboard;
  - your to-dos, which you can tick, push to tomorrow, or add to with
    quick-add ("Draft deck 45m #client");
  - the week strip.

  The text beside the icon is your next meeting when it's close, otherwise
  how many to-dos are left.
- **Frame sync:** every 2 minutes, and after each edit, the app asks your
  Daybook to sync with Frame Dashboard in both directions. Ticks made on Frame
  Desk or the TV come back, and Daybook's week goes out.
- **Frame design:** switch the TV between Day and night, Salon and Painting
  in Settings.
- **Shutdown reminder:** a daily notification (6 pm by default). It opens the
  Shut down screen.
- **Updates:** once a day the app checks for a new version and offers it
  with its notes; Install Update installs it and reopens Daybook. Daybook →
  Check for Updates… (or Settings → Updates → Check now) checks right away,
  and Settings turns the daily check off. See [Updates](#updates).
- The key is stored in the login Keychain. The app is sandboxed, with network
  access only.

```bash
open mac/Daybook.xcworkspace                       # run the Daybook scheme (macOS 14+)
swift test --package-path mac/DaybookPackage       # unit tests
SNAPSHOT_DIR=/tmp swift test --package-path mac/DaybookPackage   # also renders /tmp/popover.png
```

From the command line:

```bash
xcodebuild -workspace mac/Daybook.xcworkspace -scheme Daybook -derivedDataPath mac/.build/dd build
open mac/.build/dd/Build/Products/Debug/Daybook.app
```

To ship a download (the landing page's "Download for Mac" points at the latest
GitHub release's `Daybook.dmg`):

```bash
mac/scripts/package-dmg.sh                         # → mac/build/Daybook.dmg (universal, ad-hoc signed)
DEVELOPER_ID="Developer ID Application: … (TEAMID)" NOTARY_PROFILE=daybook mac/scripts/package-dmg.sh   # signed + notarized
```

Without a Developer ID, macOS 15 and later says it "could not verify"
Daybook and offers only Done and Move to Trash. Choose Done, then System
Settings → Privacy & Security → (bottom of the pane) Open Anyway → Open. Or, in
Terminal: `xattr -dr com.apple.quarantine /Applications/Daybook.app`. A notarized
build opens directly, so ship notarized when you can. Notarizing needs an Apple
Developer Program membership and, on the Mac that builds:

1. A **Developer ID Application** certificate in the login keychain (Xcode →
   Settings → Accounts → Manage Certificates → + → Developer ID Application).
   Check with `security find-identity -v -p codesigning`.
2. A notary profile: `xcrun notarytool store-credentials daybook --apple-id
   <you> --team-id <TEAMID>` (it asks for an app-specific password from
   account.apple.com). Or skip the profile and pass an App Store Connect API
   key: `NOTARY_KEY=AuthKey_XXXXXXXXXX.p8 NOTARY_KEY_ID=… NOTARY_ISSUER=…`
   (leave out the issuer for an individual key). The script's header lists
   every option.

On first launch, enter your Daybook URL (for example
`https://your-daybook.vercel.app`, or `http://localhost:3000` while
developing) and your `DAYBOOK_KEY`.

| Path | What |
| --- | --- |
| `Daybook/DaybookApp.swift` | The app shell: window, menu bar item, Go menu, notification handling |
| `DaybookPackage/Sources/DaybookFeature/` | Everything else: API client, model, popover, settings, updates (`Updates.swift`), the web window, Keychain, fonts |
| `Config/` | Build settings, `Info.plist` (App Transport Security for localhost, the update feed and its key), entitlements |

## Releasing from GitHub

Pushing a `mac-v*` tag runs
[`.github/workflows/mac-release.yml`](../.github/workflows/mac-release.yml) on
a macOS runner. It runs `package-dmg.sh` and attaches `Daybook.dmg` to that
tag's GitHub release, creating the release if there isn't one, then signs the
image for Sparkle and attaches `appcast.xml` (see [Updates](#updates)). Bump
`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `Config/Shared.xcconfig`
and merge first: the workflow stops if the tag and `MARKETING_VERSION`
differ, or if `CURRENT_PROJECT_VERSION` isn't higher than the build number in
the published appcast (installed copies compare that number, not the
version). A tag with a suffix (`mac-v0.2.0-beta.1`) makes a pre-release.

```bash
git tag mac-v0.1.2 && git push origin mac-v0.1.2   # on an up-to-date main
```

The workflow writes the install steps, how the build was signed and its
SHA-256 into the release notes, between `<!-- mac-release:start -->` and
`<!-- mac-release:end -->`, and a re-run replaces only that block. Write
"What's new" above it; notes written before the run keep their text and get
the block after them. The update window shows that "What's new" (Markdown) as
it was when the release job ran, so write the notes before tagging, or re-run
the job after editing them. Pull requests that change `mac/` build the image too,
ad-hoc and without secrets, and keep it as a workflow artifact.

With these repository secrets (Settings → Secrets and variables → Actions) a
tag build is signed with the Developer ID, notarized and stapled. Without the
certificate it's ad-hoc signed and the notes carry the Done → Open Anyway
steps. With the certificate but no notary secrets it's signed but not
notarized, which macOS 15+ still blocks the same way, and the notes say so.

| Secret | What |
| --- | --- |
| `DEVELOPER_ID_P12` | The Developer ID Application certificate with its private key, exported from Keychain Access (My Certificates → the certificate → Export, as .p12) and base64-encoded: `base64 -i DeveloperID.p12 \| gh secret set DEVELOPER_ID_P12` |
| `DEVELOPER_ID_P12_PASSWORD` | The password you gave that export (`gh secret set DEVELOPER_ID_P12_PASSWORD` asks for it) |
| `NOTARY_KEY_P8` | An App Store Connect API key (Users and Access → Integrations → App Store Connect API, Developer access): the `.p8` file as it is, `gh secret set NOTARY_KEY_P8 < AuthKey_XXXXXXXXXX.p8` |
| `NOTARY_KEY_ID` | That key's ID |
| `NOTARY_ISSUER` | The Issuer ID on the same page, for a team key; leave it unset for an individual key |
| `NOTARY_APPLE_ID`, `NOTARY_PASSWORD`, `NOTARY_TEAM_ID` | Instead of an API key: your Apple ID, an app-specific password from account.apple.com and your team ID |
| `SPARKLE_ED_PRIVATE_KEY` | Sparkle's private EdDSA key, as `generate_keys -x` exports it (one base64 line). It signs each release as an update; see [Updates](#updates) |

The API key wins when both are set. Only tag builds get the secrets. The
workflow imports the certificate into a temporary keychain, deletes it
afterwards, and never prints a secret. A notarized build also needs
`SPARKLE_ED_PRIVATE_KEY` and `SUPublicEDKey` in `Config/Info.plist`: without
them the workflow stops before building, so no notarized release goes out
that installed copies can't update to.

On the Mac that holds the certificate and the API key, one script exports
the Developer ID identity (and no other) to a `.p12` with a new password,
backs it up with the `.p8` to 1Password (`op` CLI; otherwise to a folder on
your Desktop), and sets all five secrets with `gh`. Then it does the same for
Sparkle's update key (see [Updates](#updates)). It prints no secret:

```bash
NOTARY_ISSUER=<Issuer ID> mac/scripts/signing-secrets.sh
```

The header of [`scripts/signing-secrets.sh`](scripts/signing-secrets.sh)
lists its options.

The image opens in a designed window: Daybook in a gilt frame under a picture
lamp, a brass arrow to Applications, and each name on a brass plaque
([`dmg/settings.py`](dmg/settings.py), drawn in Paper as "Mac · DMG window").
`package-dmg.sh` lays it out with [dmgbuild](https://pypi.org/project/dmgbuild/)
through `uvx` or `pipx` (both on GitHub's macOS runners have pipx), so Finder is
never scripted. To change the art, export "Mac · DMG background (export)" at
1x and 2x and join them: `tiffutil -cathidpicheck bg.png bg@2x.png -out dmg/background.tiff`.

## Updates

Daybook updates itself with [Sparkle](https://sparkle-project.org) 2
(`DaybookPackage/Package.swift` pins the version; `Updates.swift` drives it).
Once a day it reads the feed in `Config/Info.plist`,
`https://github.com/joseamijares/daybook/releases/latest/download/appcast.xml`,
which is the `appcast.xml` the release workflow attached to the latest
release (pre-releases are never "latest", so they aren't offered). When the
feed's build number is higher than the app's `CFBundleVersion`, Sparkle shows
the new version with its notes; Install Update downloads `Daybook.dmg`, checks
it, replaces the app and reopens it. If another kind of release ever goes up
in this repository, create it with `--latest=false` so this URL keeps pointing
at the Mac release.

Each update is checked twice before it's installed: its EdDSA signature has to
match `SUPublicEDKey` in `Config/Info.plist` (the workflow signs it with
`SPARKLE_ED_PRIVATE_KEY`), and the new app has to be signed with the same
Developer ID. The app is sandboxed, so Sparkle installs from outside the
sandbox through its installer service: `SUEnableInstallerLauncherService` in
`Info.plist`, and the two `mach-lookup` exceptions in `Config/Daybook.entitlements`.
The app has `network.client`, so it downloads updates itself (no downloader
service). `package-dmg.sh` signs Sparkle's helpers with the Developer ID and
the hardened runtime, which `xcodebuild build` doesn't do for them; the
notary service rejects the app otherwise.

The window's own Settings (the web app's gear) shows it too: the app sets
`window.daybookMac` (version, the update found) on your Daybook's pages, and
the page's Update and Check now ask the app to open its update window
(`components/mac.ts`; nothing shows in a browser). Launch with
`-DaybookPreviewUpdate 0.9.9` to see the "available" state before there's a
newer release.

Builds without a feed or key (a fork, say) don't update themselves, and
Settings links to the releases instead. Debug builds check only when you ask.

### Opening

On a cold launch the window plays the landing's salon hang
(`LaunchScene.swift`; Paper: "Mac · Launch" and its motion spec on
"v3 · Placard"): the picture lamp warms, the works hang (small copies in
`Art/Hang`, placed as in `site/lib/hang.ts`), then Daybook's mark and today's
date. Meanwhile the page loads hidden and signs in with the saved key, so its
key screen never shows, and while the app checks its saved key the scene is
what you see (a Mac with no key saved goes straight to setup). The scene gives
way once it has played (1.5s) and the page has said `ready` through the same
message handler as Update (`components/mac.ts`); a Daybook from before `ready`
gets 0.8s after its signed-in page loads, and nothing waits more than 8s.
Reopening the window skips the scene, and Reduce Motion shows it without
movement.

### The key, once

Sparkle's key pair is made once and kept: installed copies accept only updates
signed with the key they shipped with, so a lost private key means everyone
has to download the next version by hand. On the Mac that signs releases:

```bash
SPARKLE_ONLY=1 mac/scripts/signing-secrets.sh
```

It runs Sparkle's `generate_keys --account daybook`, which makes the key in
your login keychain the first time (and reuses it after that), backs up the
private key to 1Password (or the Desktop folder), sets
`SPARKLE_ED_PRIVATE_KEY` with `gh`, and writes the public key into
`SUPublicEDKey` in `Config/Info.plist`. Commit that change before tagging. A
full run of the script (without `SPARKLE_ONLY`) does this after the Developer
ID secrets; `SKIP_SPARKLE=1` leaves it out.

By hand, with the tools from the resolved package (in Xcode: the Sparkle
package → Show in Finder → `../artifacts/sparkle/Sparkle/bin/`):

```bash
generate_keys --account daybook                          # prints the public key for SUPublicEDKey
generate_keys --account daybook -x sparkle-key.txt       # the private key, for the secret and your backup
gh secret set SPARKLE_ED_PRIVATE_KEY < sparkle-key.txt   # then delete the file
```

### Trying an update before releasing it

Build two versions signed with your Developer ID (no need to notarize them),
the second with a higher `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, and
keep a copy of the first `Daybook.app`. If Daybook is running on that Mac, give
both builds another `PRODUCT_BUNDLE_IDENTIFIER` (say `dev.daybook.mac.updatetest`)
so the test copy has its own settings. Sign the second image and put it with
an `appcast.xml` (copy the release job's) in a folder:

```bash
sign_update --account daybook mac/build/Daybook.dmg     # sparkle:edSignature="…" length="…" for the enclosure
python3 -m http.server 8000 --bind 127.0.0.1             # in the folder with appcast.xml and the image
open -n Daybook.app --args -DaybookAppcastURL http://127.0.0.1:8000/appcast.xml
```

With automatic checks on, the first launch checks right away; otherwise use
Daybook → Check for Updates…. The `-DaybookAppcastURL` argument only changes
the feed for that launch (the relaunched app reads the real one again), and
the update still has to be signed with the key in `Info.plist`.
