#!/bin/sh
# Backs up Daybook's signing files and gives them to GitHub, so
# .github/workflows/mac-release.yml can sign and notarize tagged builds.
#
#   NOTARY_ISSUER=<Issuer ID> mac/scripts/signing-secrets.sh
#
# 1. Exports the "Developer ID Application" certificate and its private key
#    from your keychain into a .p12 with a new random password. Only that
#    identity: others in the keychain are left out. macOS asks once to allow it.
# 2. Backs up the .p12, its password and the App Store Connect API key
#    (~/.appstoreconnect/private_keys/AuthKey_*.p8) to 1Password with the `op`
#    CLI. Without a signed-in `op`, they go to a folder on your Desktop for you
#    to drag into your password manager and then delete.
# 3. Sets the repository secrets the workflow reads (DEVELOPER_ID_P12,
#    DEVELOPER_ID_P12_PASSWORD, NOTARY_KEY_P8, NOTARY_KEY_ID, NOTARY_ISSUER)
#    with `gh`.
# 4. Sparkle's update key, which signs each release so installed copies take
#    it as an update: makes it in your login keychain with Sparkle's
#    generate_keys (the first time; later runs reuse it), backs it up like the
#    rest, sets SPARKLE_ED_PRIVATE_KEY, and writes the public half into
#    SUPublicEDKey in mac/Config/Info.plist for you to commit.
#
#   SPARKLE_ONLY=1 mac/scripts/signing-secrets.sh    # just step 4
#
# Nothing secret is printed or passed on a command line: it goes from files in
# a private temporary folder, deleted at the end, to 1Password and gh.
#
# Environment:
#   NOTARY_ISSUER   Issuer ID from App Store Connect → Users and Access →
#                   Integrations, for a team key. Leave unset for an individual key.
#   NOTARY_KEY      Path to the AuthKey_*.p8 (default: the only one in
#                   ~/.appstoreconnect/private_keys).
#   DEVELOPER_ID    The identity's name, when there is more than one.
#   OP_VAULT        1Password vault (default: your default vault).
#   BACKUP_DIR      Folder for the backup when 1Password isn't used
#                   (default: ~/Desktop/Daybook signing backup).
#   SKIP_1PASSWORD=1, SKIP_GITHUB=1, SKIP_SPARKLE=1   Leave out a step.
#   SPARKLE_ONLY=1  Only the Sparkle key (step 4).
#   SPARKLE_ACCOUNT Keychain account of the Sparkle key (default: daybook).
#   KEYCHAIN        Keychain to export from (default: your keychain search list).
set -eu

cd "$(dirname "$0")/../.."
say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

umask 077
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

# 4. Sparkle's update key. Its tools come with the Sparkle package: from a
# build's DerivedData, or from resolving the package.
sparkle_key() {
  BIN=
  for DD in mac/build/dd mac/.build/dd; do
    if [ -x "$DD/SourcePackages/artifacts/sparkle/Sparkle/bin/generate_keys" ]; then
      BIN="$DD/SourcePackages/artifacts/sparkle/Sparkle/bin"
      break
    fi
  done
  if [ -z "$BIN" ]; then
    say "Fetching Sparkle's tools…"
    swift package resolve --package-path mac/DaybookPackage > /dev/null
    BIN=mac/DaybookPackage/.build/artifacts/sparkle/Sparkle/bin
  fi
  [ -x "$BIN/generate_keys" ] || fail "Sparkle's generate_keys not found"
  ACCOUNT=${SPARKLE_ACCOUNT:-daybook}
  PLIST=mac/Config/Info.plist

  say "Sparkle update key (keychain account \"${ACCOUNT}\"; macOS may ask to allow access)…"
  # Makes the key the first time and keeps it after that; prints only the public key.
  "$BIN/generate_keys" --account "$ACCOUNT" > /dev/null
  PUBLIC=$("$BIN/generate_keys" --account "$ACCOUNT" -p)
  [ -n "$PUBLIC" ] || fail "generate_keys gave no public key"
  CURRENT=$(/usr/libexec/PlistBuddy -c 'Print :SUPublicEDKey' "$PLIST" 2> /dev/null || true)
  if [ -n "$CURRENT" ] && [ "$CURRENT" != "$PUBLIC" ]; then
    fail "$PLIST already has another SUPublicEDKey. Installed copies take only updates signed with the key they shipped with: set SPARKLE_ACCOUNT to that key's account (see Updates in mac/README.md before replacing it)."
  fi
  "$BIN/generate_keys" --account "$ACCOUNT" -x "$TMP/sparkle-key" > /dev/null
  [ -s "$TMP/sparkle-key" ] || fail "generate_keys exported nothing"

  if [ "${SKIP_1PASSWORD:-}" = 1 ]; then
    say "Skipping the backup (SKIP_1PASSWORD=1)."
  elif command -v op > /dev/null && op whoami > /dev/null 2>&1 \
    && op document create "$TMP/sparkle-key" --title "Daybook · Sparkle update key ($ACCOUNT)" --file-name sparkle-ed25519-key.txt ${OP_VAULT:+--vault "$OP_VAULT"} > /dev/null; then
    say "Backed up to 1Password: \"Daybook · Sparkle update key (${ACCOUNT})\"."
  else
    DIR=${BACKUP_DIR:-"$HOME/Desktop/Daybook signing backup"}
    [ ! -L "$DIR" ] || fail "$DIR is a symlink; choose another BACKUP_DIR"
    mkdir -p "$DIR"
    chmod 700 "$DIR"
    rm -f "$DIR/Sparkle update key.txt"
    cp "$TMP/sparkle-key" "$DIR/Sparkle update key.txt"
    say "1Password CLI isn't signed in (or failed): Sparkle's key is in $DIR. Move it into your password manager, then delete the folder."
  fi

  if [ "${SKIP_GITHUB:-}" = 1 ]; then
    say "Skipping GitHub (SKIP_GITHUB=1)."
  else
    SPARKLE_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
    tr -d ' \r\n' < "$TMP/sparkle-key" | gh secret set SPARKLE_ED_PRIVATE_KEY --repo "$SPARKLE_REPO"
    say "Set SPARKLE_ED_PRIVATE_KEY on ${SPARKLE_REPO}."
  fi

  if [ "$CURRENT" = "$PUBLIC" ]; then
    say "SUPublicEDKey in $PLIST is already this key."
  else
    # The line after <key>SUPublicEDKey</key> is its <string>; base64 has no "|".
    sed -i '' -e '/<key>SUPublicEDKey<\/key>/{' -e 'n' -e "s|<string>[^<]*</string>|<string>$PUBLIC</string>|" -e '}' "$PLIST"
    [ "$(/usr/libexec/PlistBuddy -c 'Print :SUPublicEDKey' "$PLIST")" = "$PUBLIC" ] || fail "couldn't write SUPublicEDKey into $PLIST"
    say "Wrote the public key into $PLIST (SUPublicEDKey). Commit it: builds made with it update from releases signed with this key."
  fi
}

if [ "${SPARKLE_ONLY:-}" = 1 ]; then
  sparkle_key
  exit 0
fi

# The App Store Connect API key.
if [ -z "${NOTARY_KEY:-}" ]; then
  set -- "$HOME"/.appstoreconnect/private_keys/AuthKey_*.p8
  [ -e "$1" ] || fail "no AuthKey_*.p8 in ~/.appstoreconnect/private_keys; set NOTARY_KEY"
  [ $# -eq 1 ] || fail "several keys in ~/.appstoreconnect/private_keys; set NOTARY_KEY to the notary one"
  NOTARY_KEY=$1
fi
[ -f "$NOTARY_KEY" ] || fail "$NOTARY_KEY not found"
KEY_ID=$(basename "$NOTARY_KEY" .p8)
KEY_ID=${KEY_ID#AuthKey_}

# The Developer ID identity.
LIST=$(security find-identity -v -p codesigning ${KEYCHAIN:+"$KEYCHAIN"})
if [ -n "${DEVELOPER_ID:-}" ]; then
  LINE=$(printf '%s\n' "$LIST" | grep -F "\"$DEVELOPER_ID\"" | head -n 1 || true)
else
  LINE=$(printf '%s\n' "$LIST" | grep '"Developer ID Application: ' || true)
  [ "$(printf '%s\n' "$LINE" | grep -c . || true)" -le 1 ] || fail "several Developer ID identities; set DEVELOPER_ID to one of them"
fi
[ -n "$LINE" ] || fail "no valid Developer ID Application identity in the keychain"
SHA1=$(printf '%s\n' "$LINE" | awk '{print $2}')
IDENTITY=$(printf '%s\n' "$LINE" | sed 's/^[^"]*"\([^"]*\)".*$/\1/')
TEAM=$(printf '%s\n' "$IDENTITY" | sed -n 's/.*(\([A-Z0-9]*\))$/\1/p')
say "Identity:  $IDENTITY"
say "API key:   $KEY_ID${NOTARY_ISSUER:+ (issuer $NOTARY_ISSUER)}"

# 1. Export.
say "Exporting the identity (macOS asks to allow it)…"
xcrun swiftc -O -suppress-warnings -o "$TMP/export-identity" mac/scripts/export-identity.swift
P12_PASSWORD=$(openssl rand -hex 24)
export P12_PASSWORD
"$TMP/export-identity" "$SHA1" "$TMP/DeveloperID.p12" ${KEYCHAIN:+"$KEYCHAIN"}
printf '%s' "$P12_PASSWORD" > "$TMP/p12-password.txt"
unset P12_PASSWORD

# Check it before handing it on: exactly one identity (one private key), and
# it's this one. LibreSSL reads the password from the file, not the command line.
SSL=/usr/bin/openssl
KEYS=$("$SSL" pkcs12 -in "$TMP/DeveloperID.p12" -passin file:"$TMP/p12-password.txt" -nocerts -nodes 2> /dev/null | grep -c 'BEGIN.*PRIVATE KEY' || true)
GOT=$("$SSL" pkcs12 -in "$TMP/DeveloperID.p12" -passin file:"$TMP/p12-password.txt" -clcerts -nokeys 2> /dev/null \
  | "$SSL" x509 -noout -fingerprint -sha1 2> /dev/null | sed 's/.*=//; s/://g')
[ "$KEYS" -eq 1 ] || fail "the export holds $KEYS private keys, expected 1"
[ "$GOT" = "$SHA1" ] || fail "the export doesn't hold $IDENTITY"
say "Exported and checked: one identity, with its private key."

# 2. Back up.
backup_to_folder() {
  DIR=${BACKUP_DIR:-"$HOME/Desktop/Daybook signing backup"}
  [ ! -L "$DIR" ] || fail "$DIR is a symlink; choose another BACKUP_DIR"
  mkdir -p "$DIR"
  chmod 700 "$DIR"
  # New files, not overwritten ones, so each is owner-only (umask 077) even if
  # an older, readable copy was there.
  P8_NAME=$(basename "$NOTARY_KEY")
  for f in DeveloperID.p12 "DeveloperID.p12 password.txt" "$P8_NAME" README.txt; do rm -f "$DIR/$f"; done
  cp "$TMP/DeveloperID.p12" "$DIR/DeveloperID.p12"
  cp "$TMP/p12-password.txt" "$DIR/DeveloperID.p12 password.txt"
  cp "$NOTARY_KEY" "$DIR/$P8_NAME"
  printf 'Identity: %s\nTeam ID: %s\nAPI key ID: %s\nIssuer ID: %s\n' \
    "$IDENTITY" "$TEAM" "$KEY_ID" "${NOTARY_ISSUER:-(individual key)}" > "$DIR/README.txt"
  say "Backup written to $DIR. Move it into your password manager, then delete the folder."
}

backup_to_1password() {
  # The item is built in a private file, so the password never reaches a command line.
  op document create "$TMP/DeveloperID.p12" --title "Daybook · Developer ID Application (.p12)" --file-name DeveloperID.p12 ${OP_VAULT:+--vault "$OP_VAULT"} > /dev/null || return 1
  op document create "$NOTARY_KEY" --title "Daybook · App Store Connect key $KEY_ID (.p8)" --file-name "AuthKey_$KEY_ID.p8" ${OP_VAULT:+--vault "$OP_VAULT"} > /dev/null || return 1
  python3 - "$TMP/p12-password.txt" "$TMP/item.json" "$IDENTITY" "$TEAM" "$KEY_ID" "${NOTARY_ISSUER:-}" <<'PY' || return 1
import json, sys
password_file, out, identity, team, key_id, issuer = sys.argv[1:]
fields = [
    {"id": "password", "type": "CONCEALED", "purpose": "PASSWORD", "label": "password", "value": open(password_file).read()},
    {"label": "identity", "type": "STRING", "value": identity},
    {"label": "team ID", "type": "STRING", "value": team},
    {"label": "API key ID", "type": "STRING", "value": key_id},
]
if issuer:
    fields.append({"label": "issuer ID", "type": "STRING", "value": issuer})
fields.append({"id": "notesPlain", "type": "STRING", "purpose": "NOTES", "label": "notesPlain",
               "value": "Password of the DeveloperID.p12 document. Used by mac/scripts/signing-secrets.sh and the GitHub secret DEVELOPER_ID_P12_PASSWORD."})
json.dump({"title": "Daybook · Developer ID .p12 password", "category": "PASSWORD", "fields": fields}, open(out, "w"))
PY
  op item create --template "$TMP/item.json" ${OP_VAULT:+--vault "$OP_VAULT"} > /dev/null || return 1
  say "Backed up to 1Password: the .p12, its password and the API key (titles start with \"Daybook ·\")."
}

if [ "${SKIP_1PASSWORD:-}" = 1 ]; then
  say "Skipping the backup (SKIP_1PASSWORD=1)."
elif command -v op > /dev/null && op whoami > /dev/null 2>&1 && backup_to_1password; then
  :
else
  say "1Password CLI isn't signed in (or failed), so writing the backup to a folder instead."
  backup_to_folder
fi

# 3. GitHub secrets.
if [ "${SKIP_GITHUB:-}" = 1 ]; then
  say "Skipping GitHub (SKIP_GITHUB=1)."
else
  REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
  say "Setting the secrets on ${REPO}…"
  base64 -i "$TMP/DeveloperID.p12" | gh secret set DEVELOPER_ID_P12 --repo "$REPO"
  gh secret set DEVELOPER_ID_P12_PASSWORD --repo "$REPO" < "$TMP/p12-password.txt"
  gh secret set NOTARY_KEY_P8 --repo "$REPO" < "$NOTARY_KEY"
  printf '%s' "$KEY_ID" | gh secret set NOTARY_KEY_ID --repo "$REPO"
  if [ -n "${NOTARY_ISSUER:-}" ]; then
    printf '%s' "$NOTARY_ISSUER" | gh secret set NOTARY_ISSUER --repo "$REPO"
  fi
  say "Done. A mac-v* tag now builds a signed, notarized Daybook.dmg (see mac/README.md)."
fi

# 4. Sparkle's update key.
if [ "${SKIP_SPARKLE:-}" = 1 ]; then
  say "Skipping Sparkle's update key (SKIP_SPARKLE=1)."
else
  sparkle_key
fi
