# Daybook for Mac

The full Daybook in a window, plus a glance at today in the menu bar.

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
| `DaybookPackage/Sources/DaybookFeature/` | Everything else: API client, model, popover, settings, the web window, Keychain, fonts |
| `Config/` | Build settings, `Info.plist` (App Transport Security for localhost), entitlements |

## Releasing from GitHub

Pushing a `mac-v*` tag runs
[`.github/workflows/mac-release.yml`](../.github/workflows/mac-release.yml) on
a macOS runner. It runs `package-dmg.sh` and attaches `Daybook.dmg` to that
tag's GitHub release, creating the release if there isn't one. Bump
`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `Config/Shared.xcconfig`
and merge first: the workflow stops if the tag and `MARKETING_VERSION`
differ. A tag with a suffix (`mac-v0.2.0-beta.1`) makes a pre-release.

```bash
git tag mac-v0.1.2 && git push origin mac-v0.1.2   # on an up-to-date main
```

The workflow writes the install steps, how the build was signed and its
SHA-256 into the release notes, between `<!-- mac-release:start -->` and
`<!-- mac-release:end -->`, and a re-run replaces only that block. Write
"What's new" above it; notes written before the run keep their text and get
the block after them. Pull requests that change `mac/` build the image too,
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

The API key wins when both are set. Only tag builds get the secrets. The
workflow imports the certificate into a temporary keychain, deletes it
afterwards, and never prints a secret.
