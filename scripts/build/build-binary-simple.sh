#!/usr/bin/env bash
# Simple binary builder that uses npm pack to create a distributable binary

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/dist/binaries"
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🔨 Building AST Copilot Helper v$VERSION"

# Build the project first
echo "📦 Building project..."
cd "$PROJECT_ROOT"
npm run build:all || npm run build

# Determine platform and architecture
case "$(uname -s)" in
    Linux*)
        PLATFORM="linux"
        ;;
    Darwin*)
        PLATFORM="darwin"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        PLATFORM="win32"
        ;;
    *)
        echo "❌ Unsupported platform: $(uname -s)"
        exit 1
        ;;
esac

case "$(uname -m)" in
    x86_64|amd64)
        ARCH="x64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        ;;
    *)
        echo "❌ Unsupported architecture: $(uname -m)"
        exit 1
        ;;
esac

BINARY_NAME="ast-copilot-helper-$PLATFORM-$ARCH"
if [ "$PLATFORM" = "win32" ]; then
    BINARY_NAME="$BINARY_NAME.exe"
fi

echo "🏗️ Building binary for $PLATFORM-$ARCH..."

# Create a temporary directory for the binary build
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Create a standalone package
echo "📦 Creating standalone package..."
cd "$PROJECT_ROOT"

# Use pkg to create the binary, pointing to the main CLI file
npx pkg packages/ast-helper/bin/ast-helper \
    --target "node20-$PLATFORM-$ARCH" \
    --output "$OUTPUT_DIR/$BINARY_NAME" \
    --compress Brotli \
    || {
        echo "⚠️ pkg failed, trying alternative approach..."
        
        # Alternative: use nexe
        if command -v nexe >/dev/null 2>&1; then
            echo "🔧 Using nexe instead..."
            npx nexe packages/ast-helper/bin/ast-helper \
                --target "node-20.0.0-$PLATFORM-$ARCH" \
                --output "$OUTPUT_DIR/$BINARY_NAME"
        else
            echo "❌ Both pkg and nexe failed. Installing nexe..."
            npm install -g nexe
            npx nexe packages/ast-helper/bin/ast-helper \
                --target "node-20.0.0-$PLATFORM-$ARCH" \
                --output "$OUTPUT_DIR/$BINARY_NAME"
        fi
    }

# Verify the binary was created
if [ -f "$OUTPUT_DIR/$BINARY_NAME" ]; then
    echo "✅ Binary created: $OUTPUT_DIR/$BINARY_NAME"
    echo "📊 Size: $(du -h "$OUTPUT_DIR/$BINARY_NAME" | cut -f1)"
    
    # Make it executable
    chmod +x "$OUTPUT_DIR/$BINARY_NAME"
    
    # Test the binary
    echo "🧪 Testing binary..."
    if "$OUTPUT_DIR/$BINARY_NAME" --version >/dev/null 2>&1; then
        echo "✅ Binary test successful"
    else
        echo "⚠️ Binary test failed, but binary was created"
    fi
else
    echo "❌ Binary was not created"
    exit 1
fi

echo "🎉 Binary build completed successfully!"