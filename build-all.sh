#!/bin/bash

# Exit on any error
set -e

# Function to print section headers
print_header() {
    echo "===================="
    echo "$1"
    echo "===================="
}

# Function to handle errors
handle_error() {
    echo "Error occurred in build-all.sh at line $1"
    exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

print_header "Starting Helply AI Meeting Assistant Build Process"

# Clean previous builds
print_header "Cleaning previous builds"
rm -rf dist/ release/ build-electron/ *.dmg *.exe *.zip *.AppImage

# Build for macOS Intel
print_header "Building for macOS Intel (x64)"
npm run build-mac -- --x64

# Build for macOS Apple Silicon
print_header "Building for macOS Apple Silicon (ARM64)"
npm run build-macarm

# Build for Windows
print_header "Building for Windows"
npm run build-win

# List output files
print_header "Build Complete! Output files:"
echo "- macOS Intel: dist/Helply AI Meeting Assistant-1.0.0-mac.zip"
echo "- macOS Intel: dist/Helply AI Meeting Assistant-1.0.0.dmg"
echo "- macOS Apple Silicon: dist/Helply AI Meeting Assistant-1.0.0-arm64-mac.zip"
echo "- macOS Apple Silicon: dist/Helply AI Meeting Assistant-1.0.0-arm64.dmg"
echo "- Windows: dist/Helply AI Meeting Assistant Setup 1.0.0.exe"
echo "- Windows: dist/Helply AI Meeting Assistant-1.0.0-win.zip"

print_header "All builds completed successfully!"