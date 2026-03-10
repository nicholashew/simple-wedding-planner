#!/usr/bin/env bash
# build.sh — Copy deployable static files from wedding/ to dist/
# Usage: ./build.sh
# Upload the dist/ folder to Cloudflare Pages, Vercel, or any static host.

set -e

SRC="$(dirname "$0")/wedding"
DEST="$(dirname "$0")/dist"

echo "Cleaning dist/..."
rm -rf "$DEST"
mkdir -p "$DEST"

echo "Copying static files..."
rsync -av --progress "$SRC/" "$DEST/" \
  --exclude="node_modules/" \
  --exclude="package.json" \
  --exclude="package-lock.json" \
  --exclude="server.js"

echo ""
echo "Done. Static site ready in: dist/"
echo "Files:"
find "$DEST" -type f | sort | sed "s|$DEST/||"
