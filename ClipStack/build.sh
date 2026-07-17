#!/bin/bash
# Build ClipStack.app — a menu-bar clipboard manager for macOS.
# Requires: macOS 13+, Xcode Command Line Tools (xcode-select --install)
set -euo pipefail
cd "$(dirname "$0")"

APP="build/ClipStack.app"
ARCH="$(uname -m)"   # arm64 on Apple Silicon, x86_64 on Intel

echo "Building ClipStack for ${ARCH}..."
rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -parse-as-library \
  -target "${ARCH}-apple-macos13.0" \
  ClipStack.swift \
  -o "$APP/Contents/MacOS/ClipStack"

cp Info.plist "$APP/Contents/Info.plist"

# Ad-hoc signature (required on Apple Silicon for local apps)
codesign --force --sign - "$APP"

echo ""
echo "Done: $PWD/$APP"
echo "Run it with:   open \"$APP\""
echo "Or install:    cp -R \"$APP\" /Applications/"
