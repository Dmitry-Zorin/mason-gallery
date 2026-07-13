#!/usr/bin/env bash
# Build MasonGallery.app and install it into /Applications, then launch it.
# Local "Path 1" convenience: no DMG, no dragging, no auto-updater.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="MasonGallery"
BUILT="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
DEST="/Applications/${APP_NAME}.app"

echo "▶ Building ${APP_NAME}.app (app bundle only — skipping the DMG)…"
bunx tauri build --bundles app

echo "▶ Quitting ${APP_NAME} if it is running…"
osascript -e "quit app \"${APP_NAME}\"" 2>/dev/null || true
sleep 1

echo "▶ Replacing ${DEST}…"
rm -rf "${DEST}"
ditto "${BUILT}" "${DEST}"

echo "▶ Launching ${DEST}…"
open "${DEST}"

echo "✔ Installed and launched ${DEST}"
