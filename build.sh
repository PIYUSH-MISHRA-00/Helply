#!/bin/bash

# Exit on error
set -e

# Clean previous builds
rm -rf dist
rm -rf node_modules/.cache

# Install dependencies
npm install

# Create empty directory for sox-bin to prevent build errors
mkdir -p node_modules/sox-bin/bin

# Rebuild native modules
echo "Rebuilding native modules..."
electron-rebuild

# Build without code signing and notarization for development
NOTARIZE=false CSC_IDENTITY_AUTO_DISCOVERY=false npm run build-mac

echo "Build completed successfully!"
echo "Note: This build is not code signed or notarized and is for development only."
echo "For production builds, you need to set up proper code signing certificates and environment variables."