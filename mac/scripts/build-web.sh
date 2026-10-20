#!/bin/sh
# Builds the Mac app's own copy of the Daybook pages: the web app as static
# files with no server behind them (DAYBOOK_DEVICE=1, next.config.ts), every
# request answered on this Mac (lib/localApi.ts). The window serves them as
# daybook://app/ (DeviceScheme.swift), so a new Mac starts with no setup.
#
#   mac/scripts/build-web.sh
#
# Run it before building the app in Xcode; package-dmg.sh runs it for releases.
# Needs Node 20+ and pnpm, as the web app does.
set -eu

cd "$(dirname "$0")/../.."
WEB=mac/DaybookPackage/Sources/DaybookFeature/Web
[ -d node_modules ] || pnpm install --frozen-lockfile
rm -rf .next-device
DAYBOOK_LOCALE= pnpm build:device
find "$WEB" -mindepth 1 ! -name README.md -exec rm -rf {} +
cp -R .next-device/. "$WEB/"
echo "Built the Mac app's pages: $WEB ($(du -sh "$WEB" | cut -f1))"
