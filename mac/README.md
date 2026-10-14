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
Terminal: `xattr -d com.apple.quarantine /Applications/Daybook.app`. A notarized
build opens directly, so ship notarized when you can. Notarizing needs an Apple
Developer Program membership and, on the Mac that builds:

1. A **Developer ID Application** certificate in the login keychain (Xcode →
   Settings → Accounts → Manage Certificates → + → Developer ID Application).
   Check with `security find-identity -v -p codesigning`.
2. A notary profile: `xcrun notarytool store-credentials daybook --apple-id
   <you> --team-id <TEAMID>` (it asks for an app-specific password from
   account.apple.com).

On first launch, enter your Daybook URL (for example
`https://your-daybook.vercel.app`, or `http://localhost:3000` while
developing) and your `DAYBOOK_KEY`.

| Path | What |
| --- | --- |
| `Daybook/DaybookApp.swift` | The app shell: window, menu bar item, Go menu, notification handling |
| `DaybookPackage/Sources/DaybookFeature/` | Everything else: API client, model, popover, settings, the web window, Keychain, fonts |
| `Config/` | Build settings, `Info.plist` (App Transport Security for localhost), entitlements |
