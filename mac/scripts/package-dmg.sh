#!/bin/sh
# Builds Daybook for Mac (Release, universal) and packages it as a disk image
# with an Applications shortcut: mac/build/Daybook.dmg.
#
#   mac/scripts/package-dmg.sh
#
# Signing: with DEVELOPER_ID set (e.g. "Developer ID Application: Name (TEAMID)")
# the app is signed with it and the hardened runtime, and so are the helpers inside
# Sparkle.framework (the updater). With notary credentials too
# the image is notarized and stapled, so it opens without a Gatekeeper prompt.
# The first of these that is set is used:
#   NOTARY_PROFILE                            a `xcrun notarytool store-credentials` profile
#   NOTARY_KEY, NOTARY_KEY_ID, NOTARY_ISSUER  an App Store Connect API key (.p8 path; the
#                                             issuer ID is left out for an individual key)
#   NOTARY_APPLE_ID, NOTARY_PASSWORD, NOTARY_TEAM_ID   an Apple ID and app-specific password
# Without them the app is ad-hoc signed: macOS 15+ says it "could not verify"
# Daybook (Done / Move to Trash), and each person has to choose Done, then System
# Settings → Privacy & Security → Open Anyway (see mac/README.md).
# .github/workflows/mac-release.yml runs this for each mac-v* tag.
set -eu

cd "$(dirname "$0")/.."
OUT=build
DD="$OUT/dd"
STAGE="$OUT/dmg"
DMG="$OUT/Daybook.dmg"
rm -rf "$STAGE" "$DMG" "$OUT/notary.json"
mkdir -p "$OUT"

# Xcode adds get-task-allow (debugger access) to every `build` unless told not
# to, and the notary service rejects an app that has it.
build() {
  xcodebuild -workspace Daybook.xcworkspace -scheme Daybook -configuration Release \
    -derivedDataPath "$DD" -destination 'generic/platform=macOS' \
    ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO "$@" build -quiet
}

if [ -n "${DEVELOPER_ID:-}" ]; then
  # Each setting is its own argument, so an identity with spaces stays whole.
  # The team comes from the identity's "(TEAMID)"; an identity given as a
  # SHA-1 hash has none, and the build goes on without setting it.
  TEAM=$(printf '%s\n' "$DEVELOPER_ID" | sed -n 's/.*(\([A-Z0-9]*\))$/\1/p')
  build "CODE_SIGN_IDENTITY=$DEVELOPER_ID" ${TEAM:+"DEVELOPMENT_TEAM=$TEAM"} CODE_SIGN_STYLE=Manual \
    ENABLE_HARDENED_RUNTIME=YES OTHER_CODE_SIGN_FLAGS=--timestamp
else
  build CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=
fi

APP="$DD/Build/Products/Release/Daybook.app"
if [ -n "${DEVELOPER_ID:-}" ]; then
  # Sparkle's installer, downloader and helper apps come ad-hoc signed, and Xcode
  # re-signs only the framework around them, which the notary service rejects.
  # Sign each one, inside out in the order Sparkle documents, then the app again,
  # keeping the entitlements Xcode resolved. Never --deep.
  SPARKLE="$APP/Contents/Frameworks/Sparkle.framework"
  sign() { codesign --force --sign "$DEVELOPER_ID" --options runtime --timestamp "$@"; }
  sign "$SPARKLE/Versions/B/XPCServices/Installer.xpc"
  sign --preserve-metadata=entitlements "$SPARKLE/Versions/B/XPCServices/Downloader.xpc"
  sign "$SPARKLE/Versions/B/Autoupdate"
  sign "$SPARKLE/Versions/B/Updater.app"
  sign "$SPARKLE"
  sign --preserve-metadata=entitlements "$APP"
  codesign --verify --deep --strict "$APP"
fi

# The window the image opens in: Daybook in a gilt frame, an arrow to Applications
# (dmg/settings.py, drawn in Paper). dmgbuild writes it without scripting Finder,
# so it works on CI too; it comes from uvx or pipx. Without either, a plain window.
if command -v uvx > /dev/null 2>&1; then
  DMGBUILD="uvx --from dmgbuild==1.6.7 dmgbuild"
elif command -v pipx > /dev/null 2>&1; then
  DMGBUILD="pipx run --spec dmgbuild==1.6.7 dmgbuild"
else
  DMGBUILD=""
fi
rm -f "$DMG"
if [ -n "$DMGBUILD" ]; then
  $DMGBUILD -s dmg/settings.py -D app="$APP" -D background="$(pwd)/dmg/background.tiff" Daybook "$DMG"
else
  echo "warning: no uvx or pipx, so Daybook.dmg opens in a plain window" >&2
  mkdir -p "$STAGE"
  cp -R "$APP" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname Daybook -srcfolder "$STAGE" -ov -format UDZO "$DMG" -quiet
  # The staging folder links to /Applications; don't leave it for tools that walk the repo.
  rm -rf "$STAGE"
fi

if [ -n "${DEVELOPER_ID:-}" ]; then
  codesign --sign "$DEVELOPER_ID" --timestamp "$DMG"
  # The script takes no arguments, so its own argument list holds notarytool's credentials.
  if [ -n "${NOTARY_PROFILE:-}" ]; then
    set -- --keychain-profile "$NOTARY_PROFILE"
  elif [ -n "${NOTARY_KEY:-}" ]; then
    set -- --key "$NOTARY_KEY" --key-id "${NOTARY_KEY_ID:?NOTARY_KEY needs NOTARY_KEY_ID}"
    if [ -n "${NOTARY_ISSUER:-}" ]; then set -- "$@" --issuer "$NOTARY_ISSUER"; fi
  elif [ -n "${NOTARY_APPLE_ID:-}" ]; then
    set -- --apple-id "$NOTARY_APPLE_ID" \
      --password "${NOTARY_PASSWORD:?NOTARY_APPLE_ID needs NOTARY_PASSWORD}" \
      --team-id "${NOTARY_TEAM_ID:?NOTARY_APPLE_ID needs NOTARY_TEAM_ID}"
  else
    set --
  fi
  if [ $# -gt 0 ]; then
    # notarytool can exit 0 for a rejected image, so read the verdict instead.
    xcrun notarytool submit "$DMG" "$@" --wait --output-format json > "$OUT/notary.json" || true
    STATUS=$(plutil -extract status raw -o - "$OUT/notary.json" 2>/dev/null || echo "no result")
    if [ "$STATUS" != Accepted ]; then
      echo "Notarization: $STATUS" >&2
      cat "$OUT/notary.json" >&2
      ID=$(plutil -extract id raw -o - "$OUT/notary.json" 2>/dev/null || true)
      if [ -n "$ID" ]; then xcrun notarytool log "$ID" "$@" >&2 || true; fi
      exit 1
    fi
    xcrun stapler staple "$DMG"
  fi
fi

shasum -a 256 "$DMG"
echo "Built $DMG ($(du -h "$DMG" | cut -f1)), version $(defaults read "$PWD/$APP/Contents/Info" CFBundleShortVersionString)"
