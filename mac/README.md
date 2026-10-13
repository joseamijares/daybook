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

On first launch, enter your Daybook URL (for example
`https://your-daybook.vercel.app`, or `http://localhost:3000` while
developing) and your `DAYBOOK_KEY`.

| Path | What |
| --- | --- |
| `Daybook/DaybookApp.swift` | The app shell: window, menu bar item, Go menu, notification handling |
| `DaybookPackage/Sources/DaybookFeature/` | Everything else: API client, model, popover, settings, the web window, Keychain, fonts |
| `Config/` | Build settings, `Info.plist` (App Transport Security for localhost), entitlements |
