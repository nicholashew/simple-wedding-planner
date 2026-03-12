#!/usr/bin/env bash
# build.sh — Copy deployable static files from wedding/ and wedding-v2/ to dist/
# Usage: ./build.sh
# Upload the dist/ folder to Cloudflare Pages, Vercel, or any static host.

set -e

ROOT="$(dirname "$0")"
DEST="$ROOT/dist"

EXCLUDE=(
  --exclude="node_modules/"
  --exclude="package.json"
  --exclude="package-lock.json"
  --exclude="server.js"
)

echo "Cleaning dist/..."
rm -rf "$DEST"
mkdir -p "$DEST/wedding" "$DEST/wedding-v2"

echo "Copying wedding/..."
rsync -av --progress "$ROOT/wedding/" "$DEST/wedding/" "${EXCLUDE[@]}"

echo "Copying wedding-v2/..."
rsync -av --progress "$ROOT/wedding-v2/" "$DEST/wedding-v2/" "${EXCLUDE[@]}"

echo ""
echo "Done. Static site ready in: dist/"
echo "Files:"
find "$DEST" -type f | sort | sed "s|$DEST/||"
