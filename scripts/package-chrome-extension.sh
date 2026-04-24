#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$REPO_ROOT/chrome-extension"
OUT_DIR="$REPO_ROOT/build/chrome-extension"
ZIP_NAME="nexiflow-time-tracker.zip"

node "$REPO_ROOT/scripts/validate-chrome-extension.mjs" >/dev/null

mkdir -p "$OUT_DIR"

(
  cd "$EXT_DIR"
  rm -f "$OUT_DIR/$ZIP_NAME"
  zip -r "$OUT_DIR/$ZIP_NAME" . \
    -x "*.DS_Store" \
    -x "*/.DS_Store" \
    -x "node_modules/*" \
    -x "*.pem" \
    -x "*.crx"
)

echo "Created: $OUT_DIR/$ZIP_NAME"

