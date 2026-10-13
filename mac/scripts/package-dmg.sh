#!/bin/sh
# Builds Daybook for Mac (Release, universal) and packages it as a disk image
# with an Applications shortcut: mac/build/Daybook.dmg.
#
#   mac/scripts/package-dmg.sh
#
# Signing: with DEVELOPER_ID set (e.g. "Developer ID Application: Name (TEAMID)")
# the app is signed with it and the hardened runtime; with NOTARY_PROFILE set too
# (a `xcrun notarytool store-credentials` profile) the image is notarized and
# stapled, so it opens without a Gatekeeper prompt. Without them the app is
# ad-hoc signed and macOS asks once (System Settings → Privacy & Security →
# Open Anyway).
set -eu

cd "$(dirname "$0")/.."
OUT=build
DD="$OUT/dd"
STAGE="$OUT/dmg"
DMG="$OUT/Daybook.dmg"
rm -rf "$STAGE" "$DMG"
mkdir -p "$OUT"

SIGN_ARGS='CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM='
if [ -n "${DEVELOPER_ID:-}" ]; then
  SIGN_ARGS="CODE_SIGN_IDENTITY=$DEVELOPER_ID CODE_SIGN_STYLE=Manual ENABLE_HARDENED_RUNTIME=YES OTHER_CODE_SIGN_FLAGS=--timestamp"
fi

# shellcheck disable=SC2086
xcodebuild -workspace Daybook.xcworkspace -scheme Daybook -configuration Release \
  -derivedDataPath "$DD" -destination 'generic/platform=macOS' \
  ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO $SIGN_ARGS build -quiet

APP="$DD/Build/Products/Release/Daybook.app"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname Daybook -srcfolder "$STAGE" -ov -format UDZO "$DMG" -quiet
# The staging folder links to /Applications; don't leave it for tools that walk the repo.
rm -rf "$STAGE"

if [ -n "${DEVELOPER_ID:-}" ]; then
  codesign --sign "$DEVELOPER_ID" --timestamp "$DMG"
  if [ -n "${NOTARY_PROFILE:-}" ]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG"
  fi
fi

shasum -a 256 "$DMG"
echo "Built $DMG ($(du -h "$DMG" | cut -f1)), version $(defaults read "$PWD/$APP/Contents/Info" CFBundleShortVersionString)"
